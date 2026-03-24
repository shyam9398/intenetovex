import React, { useEffect, useRef, useState, useCallback, lazy, Suspense } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useAppState, type ExitDirection, haversineDistance } from "@/contexts/AppStateContext";
import MapView from "@/components/MapView";
import {
  LogOut, ArrowLeft, ArrowUp, ArrowRight, Building2, Siren, Navigation, MapPin, Locate,
  RefreshCw, Box, XCircle, Hospital, AlertTriangle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const JunctionScene3D = lazy(() => import("@/components/JunctionScene3D"));

const MIN_ACCURACY_METERS = 35;
const MIN_MOVEMENT_METERS = 3;
const GPS_SEND_INTERVAL_MS = 3000;

const DriverDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const {
    ambulances,
    geofences,
    junctions,
    activateAmbulance,
    setAmbulanceExitDirection,
    recommendedHospital,
    updateAmbulancePosition,
    refreshMapData,
  } = useAppState();

  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshMapData();
    setRefreshing(false);
  };

  const [ambulanceId, setAmbulanceId] = useState<string | null>(null);
  const [gpsStatus, setGpsStatus] = useState<"off" | "tracking" | "error" | "unavailable">("off");
  const [gpsMessage, setGpsMessage] = useState<string>("");
  const [geofenceStatus, setGeofenceStatus] = useState<"outside" | "inside">("outside");
  const [mapCenter, setMapCenter] = useState({ lat: 12.9716, lng: 77.5946 });
  const [flyTo, setFlyTo] = useState<{ lat: number; lng: number } | null>(null);
  const [showDriverAlert, setShowDriverAlert] = useState(false);
  const [selected3DJunctionId, setSelected3DJunctionId] = useState<string | null>(null);
  const initialized = useRef(false);
  const watchIdRef = useRef<number | null>(null);
  const lastGoodPos = useRef<{ lat: number; lng: number } | null>(null);
  const lastSentTime = useRef(0);
  const lastHeadingRef = useRef(0);
  const gpsOverrodeCity = useRef(false);

  useEffect(() => {
    if (!initialized.current && user) {
      initialized.current = true;
      const cityPos = (() => {
        try {
          const raw = sessionStorage.getItem("driver_initial_position");
          if (raw) return JSON.parse(raw) as { lat: number; lng: number };
        } catch {}
        return null;
      })();

      if (cityPos) {
        setMapCenter(cityPos);
        setFlyTo(cityPos);
      }

      activateAmbulance(user.name).then((id) => {
        setAmbulanceId(id);
        if (cityPos) {
          updateAmbulancePosition(id, cityPos, 0, 0);
        }
      }).catch(console.error);
    }
  }, [user, activateAmbulance, updateAmbulancePosition]);

  const myAmbulance = ambulances.find((a) => a.id === ambulanceId);
  const recHospital = ambulanceId ? recommendedHospital(ambulanceId) : null;

  const applyGpsUpdate = useCallback((position: GeolocationPosition) => {
    if (!Number.isFinite(position.coords.latitude) || !Number.isFinite(position.coords.longitude)) {
      setGpsStatus("error");
      setGpsMessage("Invalid GPS reading received. Retrying...");
      return;
    }

    if (position.coords.accuracy > MIN_ACCURACY_METERS) {
      setGpsMessage(`Weak GPS signal (${Math.round(position.coords.accuracy)}m). Waiting for better accuracy.`);
      return;
    }

    const nextPosition = {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
    };

    if (lastGoodPos.current) {
      const drift = haversineDistance(lastGoodPos.current, nextPosition);
      if (drift < MIN_MOVEMENT_METERS) return;
    }

    const heading = position.coords.heading != null && !Number.isNaN(position.coords.heading)
      ? position.coords.heading
      : myAmbulance?.heading ?? lastHeadingRef.current;
    const speed = position.coords.speed != null && position.coords.speed >= 0
      ? position.coords.speed * 3.6
      : myAmbulance?.speed ?? 0;

    lastGoodPos.current = nextPosition;
    lastHeadingRef.current = heading;
    gpsOverrodeCity.current = true;
    setGpsStatus("tracking");
    setGpsMessage(`GPS locked • accuracy ${Math.round(position.coords.accuracy)}m • live tracking`);
    setMapCenter(nextPosition);
    setFlyTo(nextPosition);

    const now = Date.now();
    if (!ambulanceId) return;

    if (lastSentTime.current === 0 || now - lastSentTime.current >= GPS_SEND_INTERVAL_MS) {
      lastSentTime.current = now;
      updateAmbulancePosition(ambulanceId, nextPosition, heading, speed);
    }
  }, [ambulanceId, myAmbulance?.heading, myAmbulance?.speed, updateAmbulancePosition]);

  const startGPSTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsStatus("unavailable");
      setGpsMessage("GPS is not supported on this device/browser.");
      return;
    }

    setGpsStatus("tracking");
    setGpsMessage("Requesting high-accuracy GPS...");

    navigator.geolocation.getCurrentPosition(
      applyGpsUpdate,
      (error) => {
        if (error.code === 1) {
          setGpsStatus("error");
          setGpsMessage("Location permission denied. Please allow access and try again.");
          return;
        }
        if (error.code === 2) {
          setGpsStatus("unavailable");
          setGpsMessage("GPS signal unavailable. Move outdoors or near a window.");
          return;
        }
        setGpsStatus("error");
        setGpsMessage("Unable to get current location.");
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 }
    );

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      applyGpsUpdate,
      (error) => {
        if (error.code === 1) {
          setGpsStatus("error");
          setGpsMessage("Location permission denied. Please allow access and try again.");
          return;
        }
        if (error.code === 2) {
          setGpsStatus("unavailable");
          setGpsMessage("GPS signal unavailable. Move outdoors or near a window.");
          return;
        }
        setGpsStatus("error");
        setGpsMessage("GPS tracking interrupted. Retrying with high accuracy...");
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 25000 }
    );
  }, [applyGpsUpdate]);

  const stopGPSTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setGpsStatus("off");
    setGpsMessage("");
    lastGoodPos.current = null;
    lastSentTime.current = 0;
  }, []);

  useEffect(() => () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }
  }, []);

  useEffect(() => {
    if (!myAmbulance) return;

    let inside = false;
    for (const gf of geofences) {
      if (haversineDistance(myAmbulance.position, gf.center) <= gf.radius) {
        inside = true;
        break;
      }
    }

    const nextStatus = inside ? "inside" : "outside";
    if (geofenceStatus !== nextStatus) {
      setGeofenceStatus(nextStatus);
      if (inside) setShowDriverAlert(true);
      if (!inside) setShowDriverAlert(false);
    }
  }, [myAmbulance?.position, geofences, geofenceStatus]);

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

  const nearestJunction = myAmbulance
    ? junctions.reduce<typeof junctions[0] | null>((best, junction) => {
        const distance = haversineDistance(myAmbulance.position, junction.position);
        if (!best) return junction;
        return distance < haversineDistance(myAmbulance.position, best.position) ? junction : best;
      }, null)
    : null;

  const selected3DJunction = junctions.find((junction) => junction.id === selected3DJunctionId);
  const selected3DGeofence = selected3DJunction
    ? geofences.find((geofence) => haversineDistance(geofence.center, selected3DJunction.position) <= Math.max(geofence.radius, 50))
    : null;

  return (
    <div className="h-screen flex flex-col bg-background">
      <header className="flex items-center justify-between px-3 py-2 bg-card border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <Siren className="w-4 h-4 text-primary" />
          <span className="text-sm font-bold text-foreground">Driver</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={gpsStatus === "tracking" ? stopGPSTracking : startGPSTracking}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
              gpsStatus === "tracking"
                ? "border-primary/40 bg-primary/10 text-primary"
                : gpsStatus === "error" || gpsStatus === "unavailable"
                  ? "border-destructive/50 bg-destructive/10 text-destructive"
                  : "border-border bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            <Locate className={`w-3.5 h-3.5 ${gpsStatus === "tracking" ? "animate-pulse" : ""}`} />
            {gpsStatus === "tracking" ? "GPS Active" : gpsStatus === "error" ? "GPS Error" : gpsStatus === "unavailable" ? "No GPS" : "Start GPS"}
          </button>

          <span className="text-xs text-muted-foreground hidden sm:block">{user?.name}</span>

          <button onClick={handleRefresh} disabled={refreshing} className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors" title="Refresh Map Data">
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>

          <button onClick={logout} className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 relative">
          {selected3DJunction ? (
            <div className="w-full h-full relative">
              <button
                onClick={() => setSelected3DJunctionId(null)}
                className="absolute top-3 right-3 z-10 flex items-center gap-1.5 px-3 py-1.5 bg-card/90 border border-border rounded-lg text-xs font-medium text-foreground hover:bg-secondary transition-colors backdrop-blur-sm"
              >
                <XCircle className="w-3.5 h-3.5" /> Back to Map
              </button>

              <Suspense fallback={<div className="w-full h-full flex items-center justify-center bg-background"><div className="text-xs text-muted-foreground animate-pulse">Loading 3D…</div></div>}>
                <JunctionScene3D
                  className="w-full h-full"
                  junctionName={selected3DJunction.name}
                  signalRed={selected3DJunction.signalStatus === "red"}
                  geofenceTriggered={selected3DGeofence?.triggered ?? false}
                  ambulances={myAmbulance && selected3DGeofence && myAmbulance.insideGeofenceId === selected3DGeofence.id ? [{
                    id: myAmbulance.id,
                    driverName: myAmbulance.driverName,
                    heading: myAmbulance.heading,
                    exitDirection: myAmbulance.exitDirection,
                    insideGeofenceId: myAmbulance.insideGeofenceId,
                    priority: myAmbulance.priority,
                    speed: myAmbulance.speed,
                    eta: myAmbulance.eta,
                  }] : []}
                />
              </Suspense>
            </div>
          ) : (
            <>
              <MapView driverAmbulanceId={ambulanceId} showAmbulances={false} center={mapCenter} flyToCenter={flyTo} />

              {gpsMessage && (
                <div className="absolute bottom-3 left-3 z-[1000]">
                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium shadow border backdrop-blur-sm ${
                    gpsStatus === "error" || gpsStatus === "unavailable"
                      ? "bg-destructive/90 text-destructive-foreground border-destructive/50"
                      : "bg-card/90 text-muted-foreground border-border"
                  }`}>
                    {(gpsStatus === "error" || gpsStatus === "unavailable") && <AlertTriangle className="w-3.5 h-3.5" />}
                    {gpsMessage}
                  </div>
                </div>
              )}

              <div className="absolute top-3 left-3 z-[1000]">
                <div className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold shadow-lg border ${
                  isInsideGeofence ? "bg-primary/90 text-primary-foreground border-primary/50" : "bg-card/90 text-muted-foreground border-border backdrop-blur-sm"
                }`}>
                  <MapPin className={`w-4 h-4 ${isInsideGeofence ? "animate-pulse" : ""}`} />
                  {isInsideGeofence ? "🔴 Inside Junction Zone" : "🟢 Outside Zone"}
                </div>
              </div>

              <AnimatePresence>
                {showDriverAlert && isInsideGeofence && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    className="absolute top-14 left-1/2 -translate-x-1/2 z-[1000] bg-primary/90 text-primary-foreground rounded-lg px-5 py-2.5 text-sm font-bold shadow-lg flex items-center gap-2"
                  >
                    <Siren className="w-4 h-4 animate-pulse" />
                    Select Exit Direction
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </main>

        <aside className="w-72 bg-card border-l border-border flex flex-col overflow-hidden shrink-0">
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
                  <Navigation className="w-4 h-4 text-primary" style={{ transform: `rotate(${myAmbulance.heading}deg)` }} />
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

          <div className="p-3 border-b border-border space-y-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Exit Direction</p>
            {!isInsideGeofence && (
              <p className="text-[10px] text-muted-foreground bg-secondary rounded-lg p-2 text-center">🔒 Enter a geofence to select exit</p>
            )}

            <div className={`grid grid-cols-3 gap-2 ${!isInsideGeofence ? "opacity-40 pointer-events-none" : ""}`}>
              {exitOptions.map(({ dir, icon, label }) => (
                <button
                  key={dir}
                  onClick={() => ambulanceId && isInsideGeofence && setAmbulanceExitDirection(ambulanceId, dir)}
                  disabled={!isInsideGeofence}
                  className={`flex flex-col items-center gap-1 py-3 rounded-lg border-2 transition-all ${
                    myAmbulance?.exitDirection === dir ? "border-primary bg-primary/10 text-primary" : "border-border bg-secondary text-muted-foreground hover:border-muted-foreground/30"
                  } disabled:cursor-not-allowed`}
                >
                  {icon}
                  <span className="text-[10px] font-semibold">{label}</span>
                </button>
              ))}
            </div>

            <button
              onClick={handleRecommendHospital}
              disabled={!isInsideGeofence || !recHospital}
              className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border-2 text-xs font-semibold transition-all ${
                !isInsideGeofence ? "opacity-40 pointer-events-none border-border bg-secondary text-muted-foreground" : "border-primary/40 bg-primary/10 text-primary hover:bg-primary/15"
              } disabled:cursor-not-allowed`}
            >
              <Hospital className="w-4 h-4" />
              Don&apos;t know — Nearest Hospital
            </button>
          </div>

          <div className="p-3 border-b border-border space-y-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Nearest Hospital</p>
            {recHospital ? (
              <div className="flex items-center gap-2 bg-secondary border border-border rounded-lg p-2.5">
                <Building2 className="w-4 h-4 text-primary shrink-0" />
                <span className="text-xs font-semibold text-foreground">{recHospital.name}</span>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No hospitals nearby</p>
            )}
          </div>

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

          <div className="flex-1" />
        </aside>
      </div>
    </div>
  );
};

export default DriverDashboard;
