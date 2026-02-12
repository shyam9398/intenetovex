import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useAppState, type ExitDirection } from "@/contexts/AppStateContext";
import MapView from "@/components/MapView";
import AlertPanel from "@/components/AlertPanel";
import {
  LogOut, ArrowLeft, ArrowUp, ArrowRight, Building2, Siren, Navigation,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const DriverDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const {
    ambulances, activateAmbulance, setAmbulanceExitDirection, recommendedHospital,
  } = useAppState();

  const [ambulanceId, setAmbulanceId] = useState<string | null>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current && user) {
      initialized.current = true;
      const id = activateAmbulance(user.name);
      setAmbulanceId(id);
    }
  }, [user, activateAmbulance]);

  const myAmbulance = ambulances.find((a) => a.id === ambulanceId);
  const recHospital = ambulanceId ? recommendedHospital(ambulanceId) : null;

  const headingToLabel = (deg: number) => {
    if (deg >= 315 || deg < 45) return "North";
    if (deg >= 45 && deg < 135) return "East";
    if (deg >= 135 && deg < 225) return "South";
    return "West";
  };

  const exitOptions: { dir: ExitDirection; icon: React.ReactNode; label: string }[] = [
    { dir: "left", icon: <ArrowLeft className="w-5 h-5" />, label: "Left" },
    { dir: "straight", icon: <ArrowUp className="w-5 h-5" />, label: "Straight" },
    { dir: "right", icon: <ArrowRight className="w-5 h-5" />, label: "Right" },
  ];

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2.5 bg-card border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <Siren className="w-5 h-5 text-primary" />
          <div>
            <h1 className="text-sm font-bold text-foreground">Driver Dashboard</h1>
            <p className="text-[10px] text-muted-foreground">Field Operations</p>
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
        {/* Map */}
        <main className="flex-1 relative">
          <MapView driverAmbulanceId={ambulanceId} showAmbulances={false} />

          {/* Geofence alert overlay */}
          <AnimatePresence>
            {myAmbulance?.insideGeofenceId && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] bg-primary/90 text-primary-foreground rounded-lg px-5 py-2.5 text-sm font-bold shadow-lg flex items-center gap-2"
              >
                <Siren className="w-4 h-4 animate-pulse-glow" />
                GEOFENCE ENTERED — Select exit direction
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* Side panel */}
        <aside className="w-72 bg-card border-l border-border flex flex-col overflow-hidden shrink-0">
          {/* Status */}
          <div className="p-3 border-b border-border space-y-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Status</p>
            {myAmbulance ? (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-secondary rounded-lg p-2">
                    <p className="text-[10px] text-muted-foreground">Speed</p>
                    <p className="text-lg font-bold font-mono text-foreground">{myAmbulance.speed.toFixed(0)}<span className="text-[10px] text-muted-foreground ml-0.5">km/h</span></p>
                  </div>
                  <div className="bg-secondary rounded-lg p-2">
                    <p className="text-[10px] text-muted-foreground">ETA</p>
                    <p className="text-lg font-bold font-mono text-foreground">
                      {myAmbulance.eta ? Math.round(myAmbulance.eta) : "—"}
                      <span className="text-[10px] text-muted-foreground ml-0.5">sec</span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 bg-secondary rounded-lg p-2">
                  <Navigation className="w-4 h-4 text-info" style={{ transform: `rotate(${myAmbulance.heading}deg)` }} />
                  <div>
                    <p className="text-[10px] text-muted-foreground">Approach Direction</p>
                    <p className="text-xs font-semibold text-foreground">{headingToLabel(myAmbulance.heading)}</p>
                  </div>
                </div>
                {myAmbulance.insideGeofenceId && (
                  <div className="bg-primary/10 border border-primary/30 rounded-lg p-2 text-xs text-primary font-semibold animate-pulse-glow">
                    ⚠ Inside Geofence — Clearance active
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Initializing...</p>
            )}
          </div>

          {/* Exit Direction */}
          <div className="p-3 border-b border-border space-y-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Exit Direction</p>
            <div className="grid grid-cols-3 gap-2">
              {exitOptions.map(({ dir, icon, label }) => (
                <button
                  key={dir}
                  onClick={() => ambulanceId && setAmbulanceExitDirection(ambulanceId, dir)}
                  className={`flex flex-col items-center gap-1 py-3 rounded-lg border-2 transition-all ${
                    myAmbulance?.exitDirection === dir
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-secondary text-muted-foreground hover:border-muted-foreground/30"
                  }`}
                >
                  {icon}
                  <span className="text-[10px] font-semibold">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Recommended Hospital */}
          <div className="p-3 border-b border-border space-y-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Recommended Hospital</p>
            {recHospital ? (
              <div className="flex items-center gap-2 bg-success/10 border border-success/20 rounded-lg p-2.5">
                <Building2 className="w-4 h-4 text-success shrink-0" />
                <span className="text-xs font-semibold text-foreground">{recHospital.name}</span>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No hospitals nearby</p>
            )}
          </div>

          {/* Alerts */}
          <div className="flex-1 overflow-y-auto p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Alerts</p>
            <AlertPanel />
          </div>
        </aside>
      </div>
    </div>
  );
};

export default DriverDashboard;
