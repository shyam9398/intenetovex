import React, { useState, useMemo, lazy, Suspense } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useAppState, type LatLng } from "@/contexts/AppStateContext";
import MapView from "@/components/MapView";
import AlertPanel from "@/components/AlertPanel";
import {
  LogOut, Plus, MapPin, Circle, Building2, Siren,
  ChevronDown, ChevronUp, Trash2, ArrowUp, ArrowRight, ArrowLeft, Search, X, Box, Map, XCircle,
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
    activateAmbulance,
  } = useAppState();

  const [addMode, setAddMode] = useState<AddMode>(null);
  const [newName, setNewName] = useState("");
  const [newRadius, setNewRadius] = useState(500);
  const [panelOpen, setPanelOpen] = useState(true);
  const [selectedJunctionId, setSelectedJunctionId] = useState<string | null>(null);
  const [selectedJunctionForGeofence, setSelectedJunctionForGeofence] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [flyToCenter, setFlyToCenter] = useState<LatLng | null>(null);
  const [searchFocused, setSearchFocused] = useState(false);

  // Multi-ambulance spawn
  const [spawnName, setSpawnName] = useState("");
  const [spawning, setSpawning] = useState(false);

  const filteredJunctions = useMemo(() => {
    if (!searchQuery.trim()) return junctions;
    const q = searchQuery.toLowerCase();
    return junctions.filter((j) => j.name.toLowerCase().includes(q));
  }, [junctions, searchQuery]);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

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
      await activateAmbulance(spawnName.trim());
      setSpawnName("");
    } finally {
      setSpawning(false);
    }
  };

  // Click on junction to open 3D view
  const handleJunctionClick = (junctionId: string) => {
    setSelectedJunctionId(junctionId);
  };

  const selectedJunction = junctions.find((j) => j.id === selectedJunctionId);
  const activeAmbulances = ambulances.filter((a) => a.active).sort((a, b) => a.priority - b.priority);
  // Show max 2 ambulances in the list
  const displayedAmbulances = activeAmbulances.slice(0, 2);

  // Get geofence associated with selected junction
  const selectedJunctionGeofence = useMemo(() => {
    if (!selectedJunction) return null;
    return geofences.find((g) => {
      const dist = Math.sqrt(
        Math.pow(g.center.lat - selectedJunction.position.lat, 2) +
        Math.pow(g.center.lng - selectedJunction.position.lng, 2)
      );
      return dist < 0.001; // nearby geofence
    });
  }, [selectedJunction, geofences]);

  // Ambulances for 3D view (active ones)
  const ambulancesFor3D = useMemo(() => {
    return activeAmbulances.map((a) => ({
      id: a.id,
      driverName: a.driverName,
      heading: a.heading,
      exitDirection: a.exitDirection,
      insideGeofenceId: a.insideGeofenceId,
      priority: a.priority,
      speed: a.speed,
      eta: a.eta,
    }));
  }, [activeAmbulances]);

  const headingToLabel = (deg: number) => {
    if (deg >= 315 || deg < 45) return "North";
    if (deg >= 45 && deg < 135) return "East";
    if (deg >= 135 && deg < 225) return "South";
    return "West";
  };

  const exitDirIcon = (dir: string | null) => {
    if (dir === "left") return <ArrowLeft className="w-3 h-3" />;
    if (dir === "right") return <ArrowRight className="w-3 h-3" />;
    if (dir === "straight") return <ArrowUp className="w-3 h-3" />;
    return <span className="text-[10px]">—</span>;
  };

  const showDropdown = searchFocused && searchQuery.trim() && filteredJunctions.length > 0;

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2.5 bg-card border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <Siren className="w-5 h-5 text-primary" />
          <div>
            <h1 className="text-sm font-bold text-foreground">Admin Dashboard</h1>
            <p className="text-[10px] text-muted-foreground">Smart Ambulance Control</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">{user?.name}</span>
          <button onClick={logout} className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-80 bg-card border-r border-border flex flex-col overflow-hidden shrink-0">
          {/* Search with junction dropdown */}
          <div className="p-3 border-b border-border">
            <div className="relative">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
                  placeholder="Search location / junction..."
                  className="w-full pl-8 pr-8 py-2 bg-secondary border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-primary/50 focus:outline-none"
                />
                {searchQuery && (
                  <button
                    onClick={() => { setSearchQuery(""); setSearchFocused(false); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Search results dropdown */}
              <AnimatePresence>
                {showDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="absolute top-full left-0 right-0 z-50 mt-1 bg-card border border-border rounded-lg shadow-lg overflow-hidden max-h-56 overflow-y-auto"
                  >
                    <div className="px-2 py-1.5 border-b border-border">
                      <p className="text-[10px] text-muted-foreground font-medium">
                        {filteredJunctions.length} junction{filteredJunctions.length !== 1 ? "s" : ""} found
                      </p>
                    </div>
                    {filteredJunctions.map((j) => (
                      <button
                        key={j.id}
                        onMouseDown={() => handleSelectSearchResult(j)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-foreground hover:bg-secondary transition-colors text-left"
                      >
                        <span className={`w-2 h-2 rounded-full shrink-0 ${j.signalStatus === "red" ? "bg-destructive animate-pulse" : "bg-green-500"}`} />
                        <MapPin className="w-3 h-3 text-warning shrink-0" />
                        <span className="flex-1 truncate">{j.name}</span>
                        <span className="text-[9px] text-muted-foreground font-mono">
                          {j.position.lat.toFixed(3)}, {j.position.lng.toFixed(3)}
                        </span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {searchQuery && !showDropdown && (
              <p className="text-[10px] text-muted-foreground mt-1.5">
                {filteredJunctions.length === 0
                  ? `No junctions match "${searchQuery}"`
                  : `${filteredJunctions.length} junction${filteredJunctions.length !== 1 ? "s" : ""} matching "${searchQuery}"`}
              </p>
            )}
          </div>

          {/* Spawn Multiple Ambulances */}
          <div className="p-3 border-b border-border space-y-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Spawn Ambulance</p>
            <div className="flex gap-2">
              <input
                value={spawnName}
                onChange={(e) => setSpawnName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSpawnAmbulance()}
                placeholder="Driver name..."
                className="flex-1 px-2.5 py-1.5 bg-secondary border border-border rounded-md text-xs text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-primary/50 focus:outline-none"
              />
              <button
                onClick={handleSpawnAmbulance}
                disabled={!spawnName.trim() || spawning}
                className="px-3 py-1.5 bg-primary text-primary-foreground text-xs font-semibold rounded-md hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                {spawning ? "..." : "Add"}
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground">Type a driver name and click Add to spawn a new ambulance on the map</p>
          </div>

          {/* Add controls */}
          <div className="p-3 border-b border-border space-y-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Add to Map</p>
            <div className="flex gap-1.5">
              {([
                { mode: "junction" as AddMode, icon: MapPin, label: "Junction", color: "text-warning" },
                { mode: "geofence" as AddMode, icon: Circle, label: "Geofence", color: "text-primary" },
                { mode: "hospital" as AddMode, icon: Building2, label: "Hospital", color: "text-success" },
              ]).map(({ mode, icon: Icon, label, color }) => (
                <button
                  key={mode}
                  onClick={() => setAddMode(addMode === mode ? null : mode)}
                  className={`flex-1 flex flex-col items-center gap-1 py-2 px-1 rounded-lg text-[10px] font-medium transition-all border ${
                    addMode === mode
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-secondary text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${addMode === mode ? "text-primary" : color}`} />
                  {label}
                </button>
              ))}
            </div>

            {addMode && addMode !== "geofence" && (
              <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} className="space-y-2 overflow-hidden">
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder={`${addMode} name...`}
                  className="w-full px-2.5 py-1.5 bg-secondary border border-border rounded-md text-xs text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-primary/50 focus:outline-none"
                />
                <p className="text-[10px] text-muted-foreground">
                  {newName ? "Click on the map to place it" : "Enter a name first"}
                </p>
              </motion.div>
            )}

            {addMode === "geofence" && (
              <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} className="space-y-2 overflow-hidden">
                <label className="text-[10px] text-muted-foreground">Select Junction</label>
                <select
                  value={selectedJunctionForGeofence ?? ""}
                  onChange={(e) => setSelectedJunctionForGeofence(e.target.value || null)}
                  className="w-full px-2.5 py-1.5 bg-secondary border border-border rounded-md text-xs text-foreground focus:ring-1 focus:ring-primary/50 focus:outline-none"
                >
                  <option value="">— Choose a junction —</option>
                  {junctions.map((j) => (
                    <option key={j.id} value={j.id}>{j.name}</option>
                  ))}
                </select>
                <div>
                  <label className="text-[10px] text-muted-foreground">Radius: {newRadius}m</label>
                  <input
                    type="range" min={100} max={2000} step={50}
                    value={newRadius}
                    onChange={(e) => setNewRadius(Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                </div>
                <button
                  onClick={handleAddGeofenceAtJunction}
                  disabled={!selectedJunctionForGeofence}
                  className="w-full py-1.5 bg-primary text-primary-foreground font-semibold rounded-md text-xs hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Add Geofence at Junction
                </button>
              </motion.div>
            )}
          </div>

          {/* Active Ambulances - show max 2 */}
          <div className="border-b border-border">
            <button
              onClick={() => setPanelOpen(!panelOpen)}
              className="w-full flex items-center justify-between px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold hover:bg-secondary/50"
            >
              <span>Active Ambulances ({activeAmbulances.length})</span>
              {panelOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
            {panelOpen && (
              <div className="px-3 pb-3 space-y-2 max-h-48 overflow-y-auto">
                {activeAmbulances.length === 0 ? (
                  <p className="text-[10px] text-muted-foreground text-center py-3">No active ambulances — spawn one above</p>
                ) : (
                  <>
                    {displayedAmbulances.map((amb) => (
                      <div key={amb.id} className="p-2 bg-secondary rounded-lg border border-border space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-foreground">🚑 {amb.driverName}</span>
                          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                            amb.priority === 1 ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground"
                          }`}>
                            P{amb.priority || "—"}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-1 text-[10px] text-muted-foreground">
                          <div>
                            <span className="block opacity-60">Dir</span>
                            <span className="text-foreground">{headingToLabel(amb.heading)}</span>
                          </div>
                          <div>
                            <span className="block opacity-60">Exit</span>
                            <span className="text-foreground flex items-center gap-0.5">
                              {exitDirIcon(amb.exitDirection)} {amb.exitDirection ?? "—"}
                            </span>
                          </div>
                          <div>
                            <span className="block opacity-60">ETA</span>
                            <span className="text-foreground font-mono">{amb.eta ? `${Math.round(amb.eta)}s` : "—"}</span>
                          </div>
                        </div>
                        {amb.insideGeofenceId && (
                          <div className="text-[10px] text-primary font-medium animate-pulse">⚠ Inside geofence</div>
                        )}
                      </div>
                    ))}
                    {activeAmbulances.length > 2 && (
                      <p className="text-[10px] text-muted-foreground text-center">
                        +{activeAmbulances.length - 2} more ambulance{activeAmbulances.length - 2 > 1 ? "s" : ""}
                      </p>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Items list */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {/* Junctions filtered by search — click to open 3D */}
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">
                Junctions ({filteredJunctions.length}{searchQuery ? ` / ${junctions.length}` : ""})
              </p>
              <p className="text-[9px] text-muted-foreground mb-1">Click a junction to view 3D</p>
              {filteredJunctions.map((j) => (
                <div key={j.id} className="flex items-center justify-between py-1 text-xs text-foreground">
                  <button
                    onClick={() => handleJunctionClick(j.id)}
                    className={`flex items-center gap-1.5 hover:text-primary transition-colors flex-1 text-left ${
                      selectedJunctionId === j.id ? "text-primary font-semibold" : ""
                    }`}
                  >
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${j.signalStatus === "red" ? "bg-destructive animate-pulse" : "bg-green-500"}`} />
                    {selectedJunctionId === j.id ? (
                      <Box className="w-3 h-3 text-primary shrink-0" />
                    ) : (
                      <MapPin className="w-3 h-3 text-warning shrink-0" />
                    )}
                    <span className="truncate">{j.name}</span>
                  </button>
                  <button onClick={() => removeJunction(j.id)} className="text-muted-foreground hover:text-destructive ml-1 shrink-0">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>

            {/* Geofences */}
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">
                Geofences ({geofences.length})
              </p>
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
                    <input
                      type="range" min={100} max={2000} step={50}
                      value={g.radius}
                      onChange={(e) => updateGeofenceRadius(g.id, Number(e.target.value))}
                      className="flex-1 accent-primary h-1"
                    />
                    <span className="text-[10px] text-muted-foreground font-mono w-10 text-right">{g.radius}m</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Hospitals */}
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">
                Hospitals ({hospitals.length})
              </p>
              {hospitals.map((h) => (
                <div key={h.id} className="flex items-center justify-between py-1 text-xs text-foreground">
                  <span className="flex items-center gap-1.5">
                    <Building2 className="w-3 h-3 text-success" /> {h.name}
                  </span>
                  <button onClick={() => removeHospital(h.id)} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Alerts */}
          <div className="border-t border-border p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Alerts</p>
            <AlertPanel />
          </div>
        </aside>

        {/* Main view area */}
        <main className="flex-1 relative flex flex-col overflow-hidden">
          {/* 3D Junction overlay when a junction is selected */}
          {selectedJunction ? (
            <div className="flex-1 relative">
              {/* Close button */}
              <button
                onClick={() => setSelectedJunctionId(null)}
                className="absolute top-3 right-3 z-10 flex items-center gap-1.5 px-3 py-1.5 bg-card/90 border border-border rounded-lg text-xs font-medium text-foreground hover:bg-secondary transition-colors backdrop-blur-sm"
              >
                <XCircle className="w-3.5 h-3.5" />
                Back to Map
              </button>

              {/* Junction info bar */}
              <div className="absolute top-3 left-3 z-10 flex items-center gap-2 px-3 py-1.5 bg-card/90 border border-border rounded-lg backdrop-blur-sm">
                <Box className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs font-semibold text-foreground">{selectedJunction.name}</span>
                <span className={`w-2 h-2 rounded-full ${selectedJunction.signalStatus === "red" ? "bg-destructive animate-pulse" : "bg-green-500"}`} />
              </div>

              <Suspense
                fallback={
                  <div className="w-full h-full flex items-center justify-center bg-background">
                    <div className="text-xs text-muted-foreground animate-pulse">Loading 3D scene…</div>
                  </div>
                }
              >
                <JunctionScene3D
                  className="w-full h-full"
                  junctionName={selectedJunction.name}
                  signalRed={selectedJunction.signalStatus === "red"}
                  geofenceTriggered={selectedJunctionGeofence?.triggered ?? false}
                  ambulances={ambulancesFor3D}
                />
              </Suspense>

              {/* Legend overlay */}
              <div className="absolute bottom-3 left-3 bg-card/90 border border-border rounded-lg p-2.5 text-[10px] text-muted-foreground space-y-1 backdrop-blur-sm">
                <p className="text-foreground font-semibold mb-1">Legend</p>
                <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-destructive inline-block" />Signal RED — ambulance nearby</div>
                <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-success inline-block" />Signal GREEN — clear</div>
                <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-success inline-block" />Approach / Exit road</div>
                <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-warning inline-block" />Geofence boundary</div>
                <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-foreground inline-block" />Ambulance unit</div>
              </div>
            </div>
          ) : (
            <>
              {/* Map View */}
              <div className="flex-1 relative">
                <MapView
                  onMapClick={addMode && addMode !== "geofence" ? handleMapClick : undefined}
                  onJunctionClick={handleJunctionClick}
                  showAmbulances
                  searchQuery={searchQuery}
                  flyToCenter={flyToCenter}
                />
                {addMode && (
                  <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] bg-card border border-primary/30 rounded-lg px-4 py-2 text-xs text-primary font-medium shadow-lg">
                    Click on map to add {addMode}: "{newName || "..."}"
                  </div>
                )}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default AdminDashboard;