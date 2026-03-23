import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthContext";

export interface LatLng {
  lat: number;
  lng: number;
}

export interface Junction {
  id: string;
  position: LatLng;
  name: string;
  signalStatus: "red" | "green";
}

export interface Geofence {
  id: string;
  center: LatLng;
  radius: number;
  name: string;
  triggered: boolean;
}

export interface Hospital {
  id: string;
  position: LatLng;
  name: string;
}

export type ExitDirection = "left" | "straight" | "right" | null;

export interface Ambulance {
  id: string;
  driverName: string;
  position: LatLng;
  speed: number;
  heading: number;
  exitDirection: ExitDirection;
  insideGeofenceId: string | null;
  eta: number | null;
  priority: number;
  active: boolean;
  isSimulated?: boolean; // true for admin-spawned, false for real GPS drivers
}

export interface Alert {
  id: string;
  message: string;
  type: "geofence" | "priority" | "info";
  timestamp: Date;
  ambulanceId?: string;
}

interface AppStateContextType {
  junctions: Junction[];
  geofences: Geofence[];
  hospitals: Hospital[];
  ambulances: Ambulance[];
  alerts: Alert[];
  addJunction: (position: LatLng, name: string) => Promise<void>;
  removeJunction: (id: string) => Promise<void>;
  addGeofence: (center: LatLng, radius: number, name: string) => Promise<void>;
  removeGeofence: (id: string) => Promise<void>;
  updateGeofenceRadius: (id: string, radius: number) => Promise<void>;
  addHospital: (position: LatLng, name: string) => Promise<void>;
  removeHospital: (id: string) => Promise<void>;
  activateAmbulance: (driverName: string) => Promise<string>;
  spawnSimulatedAmbulance: (driverName: string, position: LatLng) => Promise<string>;
  updateAmbulancePosition: (id: string, position: LatLng, heading: number) => void;
  setAmbulanceExitDirection: (id: string, dir: ExitDirection) => Promise<void>;
  addAlert: (message: string, type: Alert["type"], ambulanceId?: string) => void;
  dismissAlert: (id: string) => void;
  recommendedHospital: (ambulanceId: string) => Hospital | null;
}

const AppStateContext = createContext<AppStateContextType | null>(null);

export const useAppState = () => {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error("useAppState must be inside AppStateProvider");
  return ctx;
};

export function haversineDistance(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * sinLng * sinLng;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export const AppStateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, session } = useAuth();
  const [junctions, setJunctions] = useState<Junction[]>([]);
  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [ambulances, setAmbulances] = useState<Ambulance[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const alertedRef = useRef<Set<string>>(new Set());
  const myAmbulanceId = useRef<string | null>(null);

  // ── Loaders ──
  const loadJunctions = useCallback(async () => {
    const { data } = await supabase.from("junctions").select("*").order("name");
    if (data) setJunctions(data.map((j) => ({ id: j.id, position: { lat: j.lat, lng: j.lng }, name: j.name, signalStatus: j.signal_status as "red" | "green" })));
  }, []);

  const loadGeofences = useCallback(async () => {
    const { data } = await supabase.from("geofences").select("*");
    if (data) setGeofences(data.map((g) => ({ id: g.id, center: { lat: g.center_lat, lng: g.center_lng }, radius: g.radius, name: g.name, triggered: g.triggered })));
  }, []);

  const loadHospitals = useCallback(async () => {
    const { data } = await supabase.from("hospitals").select("*");
    if (data) setHospitals(data.map((h) => ({ id: h.id, position: { lat: h.lat, lng: h.lng }, name: h.name })));
  }, []);

  const loadAmbulances = useCallback(async () => {
    const { data } = await supabase.from("ambulances").select("*").eq("active", true);
    if (data) setAmbulances(data.map(dbToAmb));
  }, []);

  // ── Clear stale ambulances on session start ──
  useEffect(() => {
    if (!session || !user) return;
    // Deactivate all ambulances from previous sessions for this user
    supabase.from("ambulances").update({ active: false }).eq("driver_id", user.id).then(() => {
      loadJunctions(); loadGeofences(); loadHospitals(); loadAmbulances();
    });
  }, [session, user, loadJunctions, loadGeofences, loadHospitals, loadAmbulances]);

  // ── Realtime ──
  useEffect(() => {
    if (!session) return;
    const ambCh = supabase.channel("ambulances-rt").on("postgres_changes", { event: "*", schema: "public", table: "ambulances" }, () => loadAmbulances()).subscribe();
    const jCh = supabase.channel("junctions-rt").on("postgres_changes", { event: "*", schema: "public", table: "junctions" }, () => loadJunctions()).subscribe();
    const gCh = supabase.channel("geofences-rt").on("postgres_changes", { event: "*", schema: "public", table: "geofences" }, () => loadGeofences()).subscribe();
    return () => { supabase.removeChannel(ambCh); supabase.removeChannel(jCh); supabase.removeChannel(gCh); };
  }, [session, loadAmbulances, loadJunctions, loadGeofences]);

  // ── Helpers ──
  const addAlert = useCallback((message: string, type: Alert["type"], ambulanceId?: string) => {
    setAlerts((prev) => [{ id: crypto.randomUUID(), message, type, timestamp: new Date(), ambulanceId }, ...prev].slice(0, 50));
  }, []);

  const dismissAlert = useCallback((id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const clearAlertsForAmbulance = useCallback((ambulanceId: string) => {
    setAlerts((prev) => prev.filter((a) => a.ambulanceId !== ambulanceId));
  }, []);

  // ── CRUD ──
  const addJunction = useCallback(async (position: LatLng, name: string) => {
    await supabase.from("junctions").insert({ name, lat: position.lat, lng: position.lng });
  }, []);
  const removeJunction = useCallback(async (id: string) => { await supabase.from("junctions").delete().eq("id", id); }, []);

  const addGeofence = useCallback(async (center: LatLng, radius: number, name: string) => {
    await supabase.from("geofences").insert({ name, center_lat: center.lat, center_lng: center.lng, radius });
  }, []);
  const removeGeofence = useCallback(async (id: string) => { await supabase.from("geofences").delete().eq("id", id); }, []);
  const updateGeofenceRadius = useCallback(async (id: string, radius: number) => {
    await supabase.from("geofences").update({ radius }).eq("id", id);
    setGeofences((prev) => prev.map((g) => (g.id === id ? { ...g, radius } : g)));
  }, []);

  const addHospital = useCallback(async (position: LatLng, name: string) => {
    await supabase.from("hospitals").insert({ name, lat: position.lat, lng: position.lng });
  }, []);
  const removeHospital = useCallback(async (id: string) => { await supabase.from("hospitals").delete().eq("id", id); }, []);

  // Driver activates their own ambulance (GPS-tracked, NOT simulated)
  const activateAmbulance = useCallback(async (driverName: string): Promise<string> => {
    if (!user) throw new Error("Not authenticated");

    const { data, error } = await supabase.from("ambulances").insert({
      driver_id: user.id, driver_name: driverName,
      lat: 0, lng: 0, // Will be updated by GPS
      speed: 0, heading: 0, active: true,
    }).select().single();

    if (error || !data) throw new Error("Failed to activate ambulance");
    myAmbulanceId.current = data.id;
    addAlert(`🚑 ${driverName} is now active`, "info", data.id);
    return data.id;
  }, [user, addAlert]);

  // Admin spawns a simulated ambulance
  const spawnSimulatedAmbulance = useCallback(async (driverName: string, position: LatLng): Promise<string> => {
    if (!user) throw new Error("Not authenticated");

    const { data, error } = await supabase.from("ambulances").insert({
      driver_id: user.id, driver_name: driverName,
      lat: position.lat, lng: position.lng,
      speed: 40 + Math.random() * 40, heading: Math.random() * 360, active: true,
    }).select().single();

    if (error || !data) throw new Error("Failed to spawn ambulance");
    addAlert(`🚑 Simulated ${driverName} spawned`, "info", data.id);
    return data.id;
  }, [user, addAlert]);

  const updateAmbulancePosition = useCallback((id: string, position: LatLng, heading: number) => {
    setAmbulances((prev) => prev.map((a) => (a.id === id ? { ...a, position, heading } : a)));
    supabase.from("ambulances").update({ lat: position.lat, lng: position.lng, heading }).eq("id", id);
  }, []);

  const setAmbulanceExitDirection = useCallback(async (id: string, dir: ExitDirection) => {
    setAmbulances((prev) => prev.map((a) => (a.id === id ? { ...a, exitDirection: dir } : a)));
    await supabase.from("ambulances").update({ exit_direction: dir }).eq("id", id);
  }, []);

  const recommendedHospital = useCallback((ambulanceId: string): Hospital | null => {
    const amb = ambulances.find((a) => a.id === ambulanceId);
    if (!amb || hospitals.length === 0) return null;
    let closest: Hospital | null = null;
    let minDist = Infinity;
    for (const h of hospitals) {
      const d = haversineDistance(amb.position, h.position);
      if (d < minDist) { minDist = d; closest = h; }
    }
    return closest;
  }, [ambulances, hospitals]);

  // ── Geofence detection — runs every 3 seconds for responsiveness ──
  useEffect(() => {
    const interval = setInterval(() => {
      setAmbulances((prev) => {
        const updated = prev.map((amb) => {
          if (!amb.active) return amb;
          let insideId: string | null = null;
          for (const gf of geofences) {
            const dist = haversineDistance(amb.position, gf.center);
            if (dist <= gf.radius) {
              insideId = gf.id;
              const key = `${amb.id}-${gf.id}`;
              if (!alertedRef.current.has(key)) {
                alertedRef.current.add(key);
                addAlert(`🚨 ${amb.driverName} entered "${gf.name}"`, "geofence", amb.id);
                supabase.from("geofences").update({ triggered: true }).eq("id", gf.id);
                setGeofences((gfs) => gfs.map((g) => (g.id === gf.id ? { ...g, triggered: true } : g)));
              }
              break;
            }
          }

          // Auto-clear on exit
          if (!insideId && amb.insideGeofenceId) {
            const key = `${amb.id}-${amb.insideGeofenceId}`;
            alertedRef.current.delete(key);
            clearAlertsForAmbulance(amb.id);
            supabase.from("geofences").update({ triggered: false }).eq("id", amb.insideGeofenceId);
            setGeofences((gfs) => gfs.map((g) => (g.id === amb.insideGeofenceId ? { ...g, triggered: false } : g)));
            supabase.from("ambulances").update({ exit_direction: null }).eq("id", amb.id);
          }

          let minEta: number | null = null;
          for (const j of junctions) {
            const dist = haversineDistance(amb.position, j.position);
            const etaSeconds = amb.speed > 0 ? dist / ((amb.speed * 1000) / 3600) : null;
            if (etaSeconds !== null && (minEta === null || etaSeconds < minEta)) minEta = etaSeconds;
          }

          return {
            ...amb,
            insideGeofenceId: insideId,
            eta: minEta,
            exitDirection: !insideId && amb.insideGeofenceId ? null : amb.exitDirection,
          };
        });

        const active = updated.filter((a) => a.active && a.eta !== null).sort((a, b) => (a.eta ?? Infinity) - (b.eta ?? Infinity));
        active.forEach((a, i) => { a.priority = i + 1; });
        return updated;
      });

      // Junction signal updates
      setJunctions((prevJ) =>
        prevJ.map((j) => {
          const hasNearby = ambulances.some((amb) => amb.active && haversineDistance(amb.position, j.position) <= 800);
          const newStatus = hasNearby ? "red" : "green";
          if (j.signalStatus !== newStatus) {
            supabase.from("junctions").update({ signal_status: newStatus }).eq("id", j.id);
            return { ...j, signalStatus: newStatus };
          }
          return j;
        })
      );
    }, 3000); // Check every 3 seconds for responsive geofence detection
    return () => clearInterval(interval);
  }, [geofences, junctions, ambulances, addAlert, clearAlertsForAmbulance]);

  // ── Simulate movement ONLY for admin-spawned ambulances (not driver GPS-tracked ones) ──
  useEffect(() => {
    const interval = setInterval(() => {
      setAmbulances((prev) =>
        prev.map((amb) => {
          if (!amb.active) return amb;
          // Skip the current user's own ambulance (GPS-tracked)
          if (amb.id === myAmbulanceId.current) return amb;
          const speedMs = (amb.speed * 1000) / 3600;
          const rad = (amb.heading * Math.PI) / 180;
          const dLat = (speedMs * Math.cos(rad)) / 111320;
          const dLng = (speedMs * Math.sin(rad)) / (111320 * Math.cos((amb.position.lat * Math.PI) / 180));
          const newHeading = amb.heading + (Math.random() - 0.5) * 10;
          return { ...amb, position: { lat: amb.position.lat + dLat, lng: amb.position.lng + dLng }, heading: newHeading % 360 };
        })
      );
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <AppStateContext.Provider value={{
      junctions, geofences, hospitals, ambulances, alerts,
      addJunction, removeJunction, addGeofence, removeGeofence, updateGeofenceRadius,
      addHospital, removeHospital, activateAmbulance, spawnSimulatedAmbulance,
      updateAmbulancePosition, setAmbulanceExitDirection,
      addAlert, dismissAlert, recommendedHospital,
    }}>
      {children}
    </AppStateContext.Provider>
  );
};

function dbToAmb(row: any): Ambulance {
  return {
    id: row.id, driverName: row.driver_name, position: { lat: row.lat, lng: row.lng },
    speed: row.speed, heading: row.heading, exitDirection: row.exit_direction as ExitDirection,
    insideGeofenceId: row.inside_geofence_id, eta: row.eta, priority: row.priority, active: row.active,
  };
}
