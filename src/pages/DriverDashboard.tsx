import React, { useEffect, useRef, useState, useCallback, lazy, Suspense } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useAppState, type ExitDirection, haversineDistance } from "@/contexts/AppStateContext";
import MapView from "@/components/MapView";
import {
  LogOut, ArrowLeft, ArrowUp, ArrowRight, Building2, Siren, Navigation, MapPin, Locate,
  RefreshCw, Box, XCircle, Hospital,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const JunctionScene3D = lazy(() => import("@/components/JunctionScene3D"));

const MIN_ACCURACY_METERS = 50;

const DriverDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const {
    ambulances, geofences, junctions, hospitals,
    activateAmbulance, setAmbulanceExitDirection, recommendedHospital,
    updateAmbulancePosition,
  } = useAppState();

  const [ambulanceId, setAmbulanceId] = useState<string | null>(null);
  const [gpsStatus, setGpsStatus] = useState<"off" | "tracking" | "error">("off");
  const [geofenceStatus, setGeofenceStatus] = useState<"outside" | "inside">("outside");
  const [mapCenter, setMapCenter] = useState({ lat: 12.9716, lng: 77.5946 });
  const [flyTo, setFlyTo] = useState<{ lat: number; lng: number } | null>(null);
  const [showDriverAlert, setShowDriverAlert] = useState(false);
  const [selected3DJunctionId, setSelected3DJunctionId] = useState<string | null>(null);
  const initialized = useRef(false);
  const watchIdRef = useRef<number | null>(null);
  const lastGoodPos = useRef<{ lat: number; lng: number } | null>(null);

  // Initialize ambulance
  useEffect(() => {
    if (!initialized.current && user) {
      initialized.current = true;
      activateAmbulance(user.name).then((id) => setAmbulanceId(id)).catch(console.error);
    }
  }, [user, activateAmbulance]);

  const myAmbulance = ambulances.find((a) => a.id === ambulanceId);
  const recHospital = ambulanceId ? recommendedHospital(ambulanceId) : null;

  // GPS tracking with accuracy filtering
  const startGPSTracking = useCallback(() => {
    if (!navigator.geolocation) { setGpsStatus("error"); return; }
    setGpsStatus("tracking");
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        // Filter inaccurate readings
        if (pos.coords.accuracy > MIN_ACCURACY_METERS) return;
        const newPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        // Filter drift: ignore tiny movements when likely stationary
        if (lastGoodPos.current) {
          const drift = haversineDistance(lastGoodPos.current, newPos);
          if (drift < 3) return; // ignore < 3m movements
        }
        lastGoodPos.current = newPos;
        const heading = pos.coords.heading ?? 0;
        if (ambulanceId) updateAmbulancePosition(ambulanceId, newPos, heading);
        setMapCenter(newPos);
        setFlyTo(newPos);
      },
      (err) => { console.warn("GPS error:", err.message); setGpsStatus("error"); },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 }
    );
  }, [ambulanceId, updateAmbulancePosition]);

  useEffect(() => {
    return () => { if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current); };
  }, []);

  // Geofence detection
  useEffect(() => {
    if (!myAmbulance) return;
    let inside = false;
    for (const gf of geofences) {
      if (haversineDistance(myAmbulance.position, gf.center) <= gf.radius) { inside = true; break; }
    }
    const prev = geofenceStatus;
    setGeofenceStatus(inside ? "inside" : "outside");
    if (inside && prev === "outside") setShowDriverAlert(true);
    if (!inside && prev === "inside") setShowDriverAlert(false);
  }, [myAmbulance?.position, geofences]);

  // Auto-select exit based on nearest hospital
  const handleRecommendHospital = useCallback(() => {
    if (!ambulanceId || !recHospital || !myAmbulance) return;
    const dx = recHospital.position.lng - myAmbulance.position.lng;
    const dy = recHospital.position.lat - myAmbulance.position.lat;
    const angle = (Math.atan2(dx, dy) * 180) / Math.PI;
    const heading = myAmbulance.heading % 360;
    const relative = ((angle - heading + 540) % 360) - 180;
    let dir: ExitDirection;
    if (relative > 30) dir = "right";
    else if (relative < -30) dir = "left";
    else dir = "straight";
    setAmbulanceExitDirection(ambulanceId, dir);
  }, [ambulanceId, recHospital, myAmbulance, setAmbulanceExitDirection]);

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

  const isInsideGeofence = geofenceStatus === "inside";

  // Find nearest junction for 3D view
  const nearestJunction = myAmbulance ? junctions.reduce<typeof junctions[0] | null>((best, j) => {
    const d = haversineDistance(myAmbulance.position, j.position);
    if (!best) return j;
    return d < haversineDistance(myAmbulance.position, best.position) ? j : best;
  }, null) : null;

  const selected3DJunction = junctions.find(j => j.id === selected3DJunctionId);
  const sel3DGeofence = selected3DJunction ? geofences.find(g => {
    const dist = Math.sqrt(Math.pow(g.center.lat - selected3DJunction.position.lat, 2) + Math.pow(g.center.lng - selected3DJunction.position.lng, 2));
    return dist < 0.001;
  }) : null;

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-3 py-2 bg-card border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <Siren className="w-4 h-4 text-primary" />
          <span className="text-sm font-bold text-foreground">Driver</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={startGPSTracking} disabled={gpsStatus === "tracking"}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
              gpsStatus === "tracking" ? "border-success/50 bg-success/10 text-success"
              : gpsStatus === "error" ? "border-destructive/50 bg-destructive/10 text-destructive"
              : "border-border bg-secondary text-muted-foreground hover:text-foreground"
            }`}>
            <Locate className={`w-3.5 h-3.5 ${gpsStatus === "tracking" ? "animate-pulse" : ""}`} />
            {gpsStatus === "tracking" ? "GPS Active" : gpsStatus === "error" ? "GPS Error" : "Start GPS"}
          </button>
          <span className="text-xs text-muted-foreground hidden sm:block">{user?.name}</span>
          <button onClick={() => window.location.reload()} className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors" title="Refresh">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={logout} className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Map or 3D */}
        <main className="flex-1 relative">
          {selected3DJunction ? (
            <div className="w-full h-full relative">
              <button onClick={() => setSelected3DJunctionId(null)}
                className="absolute top-3 right-3 z-10 flex items-center gap-1.5 px-3 py-1.5 bg-card/90 border border-border rounded-lg text-xs font-medium text-foreground hover:bg-secondary transition-colors backdrop-blur-sm">
                <XCircle className="w-3.5 h-3.5" /> Back to Map
              </button>
              <Suspense fallback={<div className="w-full h-full flex items-center justify-center bg-background"><div className="text-xs text-muted-foreground animate-pulse">Loading 3D…</div></div>}>
                <JunctionScene3D className="w-full h-full" junctionName={selected3DJunction.name}
                  signalRed={selected3DJunction.signalStatus === "red"} geofenceTriggered={sel3DGeofence?.triggered ?? false}
                  ambulances={myAmbulance ? [{ id: myAmbulance.id, driverName: myAmbulance.driverName, heading: myAmbulance.heading,
                    exitDirection: myAmbulance.exitDirection, insideGeofenceId: myAmbulance.insideGeofenceId, priority: myAmbulance.priority,
                    speed: myAmbulance.speed, eta: myAmbulance.eta }] : []} />
              </Suspense>
            </div>
          ) : (
            <>
              <MapView driverAmbulanceId={ambulanceId} showAmbulances={false} center={mapCenter} flyToCenter={flyTo} />

              {/* Geofence status overlay */}
              <div className="absolute top-3 left-3 z-[1000]">
                <div className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold shadow-lg border ${
                  isInsideGeofence ? "bg-primary/90 text-primary-foreground border-primary/50"
                  : "bg-card/90 text-muted-foreground border-border backdrop-blur-sm"
                }`}>
                  <MapPin className={`w-4 h-4 ${isInsideGeofence ? "animate-pulse" : ""}`} />
                  {isInsideGeofence ? "🔴 Inside Junction Zone" : "🟢 Outside Zone"}
                </div>
              </div>

              {/* Driver-only geofence alert */}
              <AnimatePresence>
                {showDriverAlert && isInsideGeofence && (
                  <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                    className="absolute top-14 left-1/2 -translate-x-1/2 z-[1000] bg-primary/90 text-primary-foreground rounded-lg px-5 py-2.5 text-sm font-bold shadow-lg flex items-center gap-2">
                    <Siren className="w-4 h-4 animate-pulse" />
                    Select Exit Direction
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
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
                    <p className="text-lg font-bold font-mono text-foreground">{myAmbulance.eta ? Math.round(myAmbulance.eta) : "—"}<span className="text-[10px] text-muted-foreground ml-0.5">sec</span></p>
                  </div>
                </div>
                <div className="flex items-center gap-2 bg-secondary rounded-lg p-2">
                  <Navigation className="w-4 h-4 text-info" style={{ transform: `rotate(${myAmbulance.heading}deg)` }} />
                  <div>
                    <p className="text-[10px] text-muted-foreground">Direction</p>
                    <p className="text-xs font-semibold text-foreground">{headingToLabel(myAmbulance.heading)}</p>
                  </div>
                </div>
                <div className={`rounded-lg p-2 text-xs font-semibold border ${
                  isInsideGeofence ? "bg-primary/10 border-primary/30 text-primary animate-pulse" : "bg-secondary border-border text-muted-foreground"
                }`}>
                  {isInsideGeofence ? "⚠ Inside Junction Zone" : "✓ Outside zone"}
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Initializing...</p>
            )}
          </div>

          {/* Exit Direction */}
          <div className="p-3 border-b border-border space-y-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Exit Direction</p>
            {!isInsideGeofence && (
              <p className="text-[10px] text-muted-foreground bg-secondary rounded-lg p-2 text-center">
                🔒 Enter a geofence to select exit
              </p>
            )}
            <div className={`grid grid-cols-3 gap-2 ${!isInsideGeofence ? "opacity-40 pointer-events-none" : ""}`}>
              {exitOptions.map(({ dir, icon, label }) => (
                <button key={dir}
                  onClick={() => ambulanceId && isInsideGeofence && setAmbulanceExitDirection(ambulanceId, dir)}
                  disabled={!isInsideGeofence}
                  className={`flex flex-col items-center gap-1 py-3 rounded-lg border-2 transition-all ${
                    myAmbulance?.exitDirection === dir ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-secondary text-muted-foreground hover:border-muted-foreground/30"
                  } disabled:cursor-not-allowed`}>
                  {icon}
                  <span className="text-[10px] font-semibold">{label}</span>
                </button>
              ))}
            </div>
            {/* Hospital recommendation button */}
            <button
              onClick={handleRecommendHospital}
              disabled={!isInsideGeofence || !recHospital}
              className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border-2 text-xs font-semibold transition-all ${
                !isInsideGeofence ? "opacity-40 pointer-events-none border-border bg-secondary text-muted-foreground"
                : "border-info/50 bg-info/10 text-info hover:bg-info/20"
              } disabled:cursor-not-allowed`}
            >
              <Hospital className="w-4 h-4" />
              Don't know — Nearest Hospital
            </button>
          </div>

          {/* Recommended Hospital */}
          <div className="p-3 border-b border-border space-y-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Nearest Hospital</p>
            {recHospital ? (
              <div className="flex items-center gap-2 bg-success/10 border border-success/20 rounded-lg p-2.5">
                <Building2 className="w-4 h-4 text-success shrink-0" />
                <span className="text-xs font-semibold text-foreground">{recHospital.name}</span>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No hospitals nearby</p>
            )}
          </div>

          {/* 3D View button */}
          {nearestJunction && (
            <div className="p-3 border-b border-border">
              <button
                onClick={() => setSelected3DJunctionId(nearestJunction.id)}
                className="w-full flex items-center justify-center gap-2 py-2 bg-secondary border border-border rounded-lg text-xs font-semibold text-foreground hover:bg-muted transition-colors"
              >
                <Box className="w-4 h-4 text-primary" />
                View 3D Junction
              </button>
            </div>
          )}

          {/* Spacer */}
          <div className="flex-1" />
        </aside>
      </div>
    </div>
  );
};

export default DriverDashboard;
