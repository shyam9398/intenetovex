import React, { useState, useMemo, lazy, Suspense } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useAppState, type LatLng, haversineDistance } from "@/contexts/AppStateContext";
import MapView from "@/components/MapView";
import AlertPanel from "@/components/AlertPanel";
import {
  LogOut, Plus, MapPin, Circle, Building2, Siren,
  Trash2, ArrowUp, ArrowRight, ArrowLeft, Search, X, Box, XCircle,
  Menu, RefreshCw, ChevronRight,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const JunctionScene3D = lazy(() => import("@/components/JunctionScene3D"));

type AddMode = "junction" | "geofence" | "hospital" | null;

const AdminDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const {
    junctions, geofences, hospitals, ambulances,
    addJunction, removeJunction,
    addGeofence, removeGeofence, updateGeofenceRadius,
    addHospital, removeHospital,
    spawnSimulatedAmbulance,
    refreshMapData,
    adminCity,
  } = useAppState();

  // Center map on admin's city on first load
  const adminCityCenter = React.useMemo(() => {
    try {
      const raw = sessionStorage.getItem("admin_initial_position");
      if (raw) return JSON.parse(raw) as LatLng;
    } catch {}
    return { lat: 12.9716, lng: 77.5946 };
  }, []);

  const [addMode, setAddMode] = useState<AddMode>(null);
  const [newName, setNewName] = useState("");
  const [newRadius, setNewRadius] = useState(500);
  const [selectedJunctionId, setSelectedJunctionId] = useState<string | null>(null);
  const [selectedJunctionForGeofence, setSelectedJunctionForGeofence] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [flyToCenter, setFlyToCenter] = useState<LatLng | null>(null);
  const [searchFocused, setSearchFocused] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [addMapSubmenu, setAddMapSubmenu] = useState(false);

  const [spawnName, setSpawnName] = useState("");
  const [spawning, setSpawning] = useState(false);
  const [geoLat, setGeoLat] = useState("");
  const [geoLng, setGeoLng] = useState("");
  const [geoMode, setGeoMode] = useState<"junction" | "latlng">("junction");

  const filteredJunctions = useMemo(() => {
    if (!searchQuery.trim()) return junctions;
    const q = searchQuery.toLowerCase();
    return junctions.filter((j) => j.name.toLowerCase().includes(q));
  }, [junctions, searchQuery]);

  const handleSelectSearchResult = (junction: typeof junctions[0]) => {
    setFlyToCenter({ ...junction.position });
    setSearchQuery(junction.name);
    setSearchFocused(false);
  };

  const handleMapClick = (latlng: LatLng) => {
    if (!addMode || !newName.trim()) return;
    if (addMode === "junction") addJunction(latlng, newName.trim());
    else if (addMode === "hospital") addHospital(latlng, newName.trim());
    setNewName("");
    setAddMode(null);
  };

  const handleAddGeofenceAtJunction = () => {
    const junction = junctions.find(j => j.id === selectedJunctionForGeofence);
    if (!junction) return;
    addGeofence(junction.position, newRadius, `${junction.name} Geofence`);
    setSelectedJunctionForGeofence(null);
    setAddMode(null);
  };

  const handleSpawnAmbulance = async () => {
    if (!spawnName.trim()) return;
    setSpawning(true);
    try {
      const center = junctions.length > 0
        ? { lat: junctions[0].position.lat + (Math.random() - 0.5) * 0.01, lng: junctions[0].position.lng + (Math.random() - 0.5) * 0.01 }
        : { lat: 12.9716 + (Math.random() - 0.5) * 0.01, lng: 77.5946 + (Math.random() - 0.5) * 0.01 };
      await spawnSimulatedAmbulance(spawnName.trim(), center);
      setSpawnName("");
    } finally {
      setSpawning(false);
    }
  };

  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshMapData();
    setRefreshing(false);
  };

  const selectedJunction = junctions.find((j) => j.id === selectedJunctionId);
  const activeAmbulances = ambulances.filter((a) => a.active).sort((a, b) => a.priority - b.priority);
  const ambulancesInsideGeofence = activeAmbulances.filter((a) => a.insideGeofenceId);

  const selectedJunctionGeofence = useMemo(() => {
    if (!selectedJunction) return null;
    return geofences.find((g) => {
      const dist = haversineDistance(
        { lat: g.center.lat, lng: g.center.lng },
        selectedJunction.position
      );
      return dist <= g.radius;
    });
  }, [selectedJunction, geofences]);

  const ambulancesFor3D = useMemo(() => {
    // Show ambulances inside THIS junction's geofence with their data intact
    const gfId = selectedJunctionGeofence?.id;
    if (!gfId) return [];
    return activeAmbulances
      .filter((a) => a.insideGeofenceId === gfId)
      .map((a) => ({
        id: a.id, driverName: a.driverName, heading: a.heading,
        exitDirection: a.exitDirection, insideGeofenceId: a.insideGeofenceId,
        priority: a.priority, speed: a.speed, eta: a.eta,
      }));
  }, [activeAmbulances, selectedJunctionGeofence]);

  const exitDirIcon = (dir: string | null) => {
    if (dir === "left") return <ArrowLeft className="w-3 h-3" />;
    if (dir === "right") return <ArrowRight className="w-3 h-3" />;
    if (dir === "straight") return <ArrowUp className="w-3 h-3" />;
    return <span className="text-[10px]">—</span>;
  };

  const headingToLabel = (deg: number) => {
    if (deg >= 315 || deg < 45) return "N";
    if (deg >= 45 && deg < 135) return "E";
    if (deg >= 135 && deg < 225) return "S";
    return "W";
  };

  const showDropdown = searchFocused && searchQuery.trim() && filteredJunctions.length > 0;

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Minimal header: hamburger + title + refresh + logout */}
      <header className="flex items-center justify-between px-3 py-2 bg-card border-b border-border shrink-0 z-[1100]">
        <div className="flex items-center gap-2">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
            <Menu className="w-5 h-5" />
          </button>
          <Siren className="w-4 h-4 text-primary" />
          <span className="text-sm font-bold text-foreground">Admin</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground hidden sm:block">{user?.name}</span>
          <button onClick={handleRefresh} disabled={refreshing} className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors" title="Refresh Map Data">
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>
          <button onClick={logout} className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Sidebar overlay */}
        <AnimatePresence>
          {sidebarOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/40 z-[1050]"
                onClick={() => setSidebarOpen(false)}
              />
              <motion.aside
                initial={{ x: -320 }} animate={{ x: 0 }} exit={{ x: -320 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="absolute left-0 top-0 bottom-0 w-80 bg-card border-r border-border z-[1060] flex flex-col overflow-hidden"
              >
                <div className="p-3 border-b border-border flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground uppercase tracking-wider">Controls</span>
                  <button onClick={() => setSidebarOpen(false)} className="text-muted-foreground hover:text-foreground">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Search */}
                <div className="p-3 border-b border-border">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onFocus={() => setSearchFocused(true)}
                      onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
                      placeholder="Search junction..."
                      className="w-full pl-8 pr-8 py-2 bg-secondary border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-primary/50 focus:outline-none"
                    />
                    {searchQuery && (
                      <button onClick={() => setSearchQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <AnimatePresence>
                    {showDropdown && (
                      <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                        className="mt-1 bg-card border border-border rounded-lg shadow-lg overflow-hidden max-h-40 overflow-y-auto">
                        {filteredJunctions.map((j) => (
                          <button key={j.id} onMouseDown={() => handleSelectSearchResult(j)}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-foreground hover:bg-secondary transition-colors text-left">
                            <MapPin className="w-3 h-3 text-warning shrink-0" />
                            <span className="truncate">{j.name}</span>
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                  {/* Spawn Ambulance */}
                  <div className="space-y-2">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Spawn Ambulance</p>
                    <div className="flex gap-2">
                      <input value={spawnName} onChange={(e) => setSpawnName(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSpawnAmbulance()}
                        placeholder="Driver name..."
                        className="flex-1 px-2.5 py-1.5 bg-secondary border border-border rounded-md text-xs text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-primary/50 focus:outline-none" />
                      <button onClick={handleSpawnAmbulance} disabled={!spawnName.trim() || spawning}
                        className="px-3 py-1.5 bg-primary text-primary-foreground text-xs font-semibold rounded-md hover:bg-primary/90 disabled:opacity-40 transition-colors flex items-center gap-1">
                        <Plus className="w-3.5 h-3.5" /> {spawning ? "..." : "Add"}
                      </button>
                    </div>
                  </div>

                  {/* Add Map → Submenu */}
                  <div className="space-y-2">
                    <button onClick={() => setAddMapSubmenu(!addMapSubmenu)}
                      className="w-full flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground font-semibold hover:text-foreground transition-colors">
                      <span>Add to Map</span>
                      <ChevronRight className={`w-3 h-3 transition-transform ${addMapSubmenu ? "rotate-90" : ""}`} />
                    </button>
                    <AnimatePresence>
                      {addMapSubmenu && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden space-y-2">
                          <div className="flex gap-1.5">
                            {([
                              { mode: "junction" as AddMode, icon: MapPin, label: "Junction", color: "text-warning" },
                              { mode: "geofence" as AddMode, icon: Circle, label: "Geofence", color: "text-primary" },
                              { mode: "hospital" as AddMode, icon: Building2, label: "Hospital", color: "text-success" },
                            ]).map(({ mode, icon: Icon, label, color }) => (
                              <button key={mode} onClick={() => setAddMode(addMode === mode ? null : mode)}
                                className={`flex-1 flex flex-col items-center gap-1 py-2 px-1 rounded-lg text-[10px] font-medium transition-all border ${
                                  addMode === mode ? "border-primary bg-primary/10 text-primary" : "border-border bg-secondary text-muted-foreground hover:text-foreground"
                                }`}>
                                <Icon className={`w-3.5 h-3.5 ${addMode === mode ? "text-primary" : color}`} />
                                {label}
                              </button>
                            ))}
                          </div>

                          {addMode && addMode !== "geofence" && (
                            <div className="space-y-2">
                              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={`${addMode} name...`}
                                className="w-full px-2.5 py-1.5 bg-secondary border border-border rounded-md text-xs text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-primary/50 focus:outline-none" />
                              <p className="text-[10px] text-muted-foreground">{newName ? "Click on the map to place it" : "Enter a name first"}</p>
                            </div>
                          )}

                          {addMode === "geofence" && (
                            <div className="space-y-2">
                              <div className="flex gap-1">
                                <button onClick={() => setGeoMode("junction")}
                                  className={`flex-1 py-1 text-[10px] font-semibold rounded-md border transition-colors ${geoMode === "junction" ? "bg-primary/10 border-primary text-primary" : "bg-secondary border-border text-muted-foreground"}`}>
                                  At Junction
                                </button>
                                <button onClick={() => setGeoMode("latlng")}
                                  className={`flex-1 py-1 text-[10px] font-semibold rounded-md border transition-colors ${geoMode === "latlng" ? "bg-primary/10 border-primary text-primary" : "bg-secondary border-border text-muted-foreground"}`}>
                                  Lat/Lng
                                </button>
                              </div>

                              {geoMode === "junction" ? (
                                <select value={selectedJunctionForGeofence ?? ""} onChange={(e) => setSelectedJunctionForGeofence(e.target.value || null)}
                                  className="w-full px-2.5 py-1.5 bg-secondary border border-border rounded-md text-xs text-foreground focus:ring-1 focus:ring-primary/50 focus:outline-none">
                                  <option value="">— Choose junction —</option>
                                  {junctions.map((j) => <option key={j.id} value={j.id}>{j.name}</option>)}
                                </select>
                              ) : (
                                <div className="space-y-1.5">
                                  <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Geofence name..."
                                    className="w-full px-2.5 py-1.5 bg-secondary border border-border rounded-md text-xs text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-primary/50 focus:outline-none" />
                                  <div className="grid grid-cols-2 gap-1.5">
                                    <input type="number" step="any" value={geoLat} onChange={(e) => setGeoLat(e.target.value)} placeholder="Latitude"
                                      className="px-2.5 py-1.5 bg-secondary border border-border rounded-md text-xs text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-primary/50 focus:outline-none" />
                                    <input type="number" step="any" value={geoLng} onChange={(e) => setGeoLng(e.target.value)} placeholder="Longitude"
                                      className="px-2.5 py-1.5 bg-secondary border border-border rounded-md text-xs text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-primary/50 focus:outline-none" />
                                  </div>
                                </div>
                              )}

                              <div>
                                <label className="text-[10px] text-muted-foreground">Radius: {newRadius}m</label>
                                <input type="range" min={100} max={2000} step={50} value={newRadius}
                                  onChange={(e) => setNewRadius(Number(e.target.value))} className="w-full accent-primary" />
                              </div>
                              <button onClick={() => {
                                if (geoMode === "junction") {
                                  handleAddGeofenceAtJunction();
                                } else {
                                  const lat = parseFloat(geoLat);
                                  const lng = parseFloat(geoLng);
                                  if (!isNaN(lat) && !isNaN(lng) && newName.trim()) {
                                    addGeofence({ lat, lng }, newRadius, newName.trim());
                                    setGeoLat(""); setGeoLng(""); setNewName(""); setAddMode(null);
                                  }
                                }
                              }} disabled={geoMode === "junction" ? !selectedJunctionForGeofence : (!geoLat || !geoLng || !newName.trim())}
                                className="w-full py-1.5 bg-primary text-primary-foreground font-semibold rounded-md text-xs hover:bg-primary/90 transition-colors disabled:opacity-40">
                                Add Geofence
                              </button>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Active Ambulances */}
                  <div className="space-y-2">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                      Active Ambulances ({activeAmbulances.length})
                    </p>
                    {activeAmbulances.length === 0 ? (
                      <p className="text-[10px] text-muted-foreground text-center py-2">No active ambulances</p>
                    ) : (
                      activeAmbulances.slice(0, 4).map((amb) => (
                        <div key={amb.id} className="p-2 bg-secondary rounded-lg border border-border space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-foreground">🚑 {amb.driverName}</span>
                            <span className="text-[10px] font-mono text-muted-foreground">P{amb.priority || "—"}</span>
                          </div>
                          <div className="grid grid-cols-3 gap-1 text-[10px] text-muted-foreground">
                            <div><span className="block opacity-60">Dir</span><span className="text-foreground">{headingToLabel(amb.heading)}</span></div>
                            <div><span className="block opacity-60">Exit</span><span className="text-foreground flex items-center gap-0.5">{exitDirIcon(amb.exitDirection)} {amb.exitDirection ?? "—"}</span></div>
                            <div><span className="block opacity-60">ETA</span><span className="text-foreground font-mono">{amb.eta ? `${Math.round(amb.eta)}s` : "—"}</span></div>
                          </div>
                          {amb.insideGeofenceId && (
                            <div className="text-[10px] text-primary font-medium animate-pulse">⚠ Inside geofence</div>
                          )}
                        </div>
                      ))
                    )}
                  </div>

                  {/* Junctions list */}
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">Junctions ({junctions.length})</p>
                    {filteredJunctions.map((j) => (
                      <div key={j.id} className="flex items-center justify-between py-1 text-xs text-foreground">
                        <button onClick={() => { setSelectedJunctionId(j.id); setSidebarOpen(false); }}
                          className="flex items-center gap-1.5 hover:text-primary transition-colors flex-1 text-left">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${j.signalStatus === "red" ? "bg-destructive animate-pulse" : "bg-green-500"}`} />
                          <span className="truncate">{j.name}</span>
                        </button>
                        <button onClick={() => removeJunction(j.id)} className="text-muted-foreground hover:text-destructive ml-1 shrink-0">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Geofences list */}
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">Geofences ({geofences.length})</p>
                    {geofences.map((g) => (
                      <div key={g.id} className="py-1.5 space-y-1">
                        <div className="flex items-center justify-between text-xs text-foreground">
                          <span className="flex items-center gap-1.5">
                            <Circle className={`w-3 h-3 ${g.triggered ? "text-primary" : "text-warning"}`} />
                            {g.name}
                            {g.triggered && <span className="text-[9px] text-primary animate-pulse">ACTIVE</span>}
                          </span>
                          <button onClick={() => removeGeofence(g.id)} className="text-muted-foreground hover:text-destructive">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                        <div className="flex items-center gap-2 pl-5">
                          <input type="range" min={100} max={2000} step={50} value={g.radius}
                            onChange={(e) => updateGeofenceRadius(g.id, Number(e.target.value))} className="flex-1 accent-primary h-1" />
                          <span className="text-[10px] text-muted-foreground font-mono w-10 text-right">{g.radius}m</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Hospitals list */}
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">Hospitals ({hospitals.length})</p>
                    {hospitals.map((h) => (
                      <div key={h.id} className="flex items-center justify-between py-1 text-xs text-foreground">
                        <span className="flex items-center gap-1.5"><Building2 className="w-3 h-3 text-success" /> {h.name}</span>
                        <button onClick={() => removeHospital(h.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="w-3 h-3" /></button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Alerts at bottom */}
                <div className="border-t border-border p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Alerts</p>
                  <AlertPanel />
                </div>
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        {/* Main: full map or 3D view */}
        <main className="flex-1 relative flex flex-col overflow-hidden">
          {selectedJunction ? (
            <div className="flex-1 relative">
              <button onClick={() => setSelectedJunctionId(null)}
                className="absolute top-3 right-3 z-10 flex items-center gap-1.5 px-3 py-1.5 bg-card/90 border border-border rounded-lg text-xs font-medium text-foreground hover:bg-secondary transition-colors backdrop-blur-sm">
                <XCircle className="w-3.5 h-3.5" /> Back to Map
              </button>
              <div className="absolute top-3 left-3 z-10 flex items-center gap-2 px-3 py-1.5 bg-card/90 border border-border rounded-lg backdrop-blur-sm">
                <Box className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs font-semibold text-foreground">{selectedJunction.name}</span>
                <span className={`w-2 h-2 rounded-full ${selectedJunction.signalStatus === "red" ? "bg-destructive animate-pulse" : "bg-green-500"}`} />
              </div>
              <Suspense fallback={<div className="w-full h-full flex items-center justify-center bg-background"><div className="text-xs text-muted-foreground animate-pulse">Loading 3D…</div></div>}>
                <JunctionScene3D className="w-full h-full" junctionName={selectedJunction.name}
                  signalRed={selectedJunction.signalStatus === "red"} geofenceTriggered={selectedJunctionGeofence?.triggered ?? false} ambulances={ambulancesFor3D} />
              </Suspense>
              <div className="absolute bottom-3 left-3 bg-card/90 border border-border rounded-lg p-2.5 text-[10px] text-muted-foreground space-y-1 backdrop-blur-sm">
                <p className="text-foreground font-semibold mb-1">Legend</p>
                <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-destructive inline-block" />Signal RED</div>
                <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-success inline-block" />Signal GREEN</div>
                <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-blue-500 inline-block" />Approach/Exit path</div>
                <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-warning inline-block" />Geofence boundary</div>
              </div>
            </div>
          ) : (
            <div className="flex-1 relative">
              <MapView
                onMapClick={addMode && addMode !== "geofence" ? handleMapClick : undefined}
                onJunctionClick={(id) => setSelectedJunctionId(id)}
                showAmbulances
                searchQuery={searchQuery}
                flyToCenter={flyToCenter}
              />
              {addMode && (
                <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] bg-card border border-primary/30 rounded-lg px-4 py-2 text-xs text-primary font-medium shadow-lg">
                  Click map to add {addMode}: "{newName || "..."}"
                </div>
              )}

              {/* Live geofence entry alerts overlay */}
              <AnimatePresence>
                {ambulancesInsideGeofence.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute top-3 right-3 z-[1000] space-y-2 max-w-xs"
                  >
                    {ambulancesInsideGeofence.map((amb) => {
                      const gf = geofences.find((g) => g.id === amb.insideGeofenceId);
                      return (
                        <motion.div
                          key={amb.id}
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 20 }}
                          className="flex items-center gap-2 px-4 py-2.5 bg-destructive/90 text-destructive-foreground rounded-lg shadow-lg border border-destructive/50 backdrop-blur-sm"
                        >
                          <Siren className="w-4 h-4 animate-pulse shrink-0" />
                          <div className="text-xs">
                            <p className="font-bold">🚑 {amb.driverName} entered zone</p>
                            <p className="opacity-80">{gf?.name ?? "Geofence"} • Exit: {amb.exitDirection ?? "not set"}</p>
                          </div>
                        </motion.div>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default AdminDashboard;
