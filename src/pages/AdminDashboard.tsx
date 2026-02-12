import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useAppState, type LatLng } from "@/contexts/AppStateContext";
import MapView from "@/components/MapView";
import AlertPanel from "@/components/AlertPanel";
import {
  LogOut, Plus, MapPin, Circle, Building2, Siren,
  ChevronDown, ChevronUp, Trash2, ArrowUp, ArrowRight, ArrowLeft,
} from "lucide-react";
import { motion } from "framer-motion";

type AddMode = "junction" | "geofence" | "hospital" | null;

const AdminDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const {
    junctions, geofences, hospitals, ambulances,
    addJunction, removeJunction,
    addGeofence, removeGeofence, updateGeofenceRadius,
    addHospital, removeHospital,
  } = useAppState();

  const [addMode, setAddMode] = useState<AddMode>(null);
  const [newName, setNewName] = useState("");
  const [newRadius, setNewRadius] = useState(500);
  const [panelOpen, setPanelOpen] = useState(true);

  const handleMapClick = (latlng: LatLng) => {
    if (!addMode || !newName.trim()) return;
    if (addMode === "junction") addJunction(latlng, newName.trim());
    else if (addMode === "geofence") addGeofence(latlng, newRadius, newName.trim());
    else if (addMode === "hospital") addHospital(latlng, newName.trim());
    setNewName("");
    setAddMode(null);
  };

  const activeAmbulances = ambulances.filter((a) => a.active).sort((a, b) => a.priority - b.priority);

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

            {addMode && (
              <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} className="space-y-2 overflow-hidden">
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder={`${addMode} name...`}
                  className="w-full px-2.5 py-1.5 bg-secondary border border-border rounded-md text-xs text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-primary/50 focus:outline-none"
                />
                {addMode === "geofence" && (
                  <div>
                    <label className="text-[10px] text-muted-foreground">Radius: {newRadius}m</label>
                    <input
                      type="range"
                      min={100}
                      max={2000}
                      step={50}
                      value={newRadius}
                      onChange={(e) => setNewRadius(Number(e.target.value))}
                      className="w-full accent-primary"
                    />
                  </div>
                )}
                <p className="text-[10px] text-muted-foreground">
                  {newName ? "Click on the map to place it" : "Enter a name first"}
                </p>
              </motion.div>
            )}
          </div>

          {/* Ambulances panel */}
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
                  <p className="text-[10px] text-muted-foreground text-center py-3">No active ambulances</p>
                ) : (
                  activeAmbulances.map((amb) => (
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
                          <span className="block opacity-60">Approach</span>
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
                        <div className="text-[10px] text-primary font-medium animate-pulse-glow">
                          ⚠ Inside geofence
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Items list */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {/* Junctions */}
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">
                Junctions ({junctions.length})
              </p>
              {junctions.map((j) => (
                <div key={j.id} className="flex items-center justify-between py-1 text-xs text-foreground">
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-3 h-3 text-warning" /> {j.name}
                  </span>
                  <button onClick={() => removeJunction(j.id)} className="text-muted-foreground hover:text-destructive">
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
                      {g.triggered && <span className="text-[9px] text-primary animate-pulse-glow">ACTIVE</span>}
                    </span>
                    <button onClick={() => removeGeofence(g.id)} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 pl-5">
                    <input
                      type="range"
                      min={100}
                      max={2000}
                      step={50}
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
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
              Alerts
            </p>
            <AlertPanel />
          </div>
        </aside>

        {/* Map */}
        <main className="flex-1 relative">
          <MapView onMapClick={addMode ? handleMapClick : undefined} showAmbulances />
          {addMode && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] bg-card border border-primary/30 rounded-lg px-4 py-2 text-xs text-primary font-medium shadow-lg">
              Click on map to add {addMode}: "{newName || "..."}"
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default AdminDashboard;
