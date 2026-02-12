import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";

export interface LatLng {
  lat: number;
  lng: number;
}

export interface Junction {
  id: string;
  position: LatLng;
  name: string;
}

export interface Geofence {
  id: string;
  center: LatLng;
  radius: number; // meters
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
  speed: number; // km/h
  heading: number; // degrees
  exitDirection: ExitDirection;
  insideGeofenceId: string | null;
  eta: number | null; // seconds
  priority: number;
  active: boolean;
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
  addJunction: (position: LatLng, name: string) => void;
  removeJunction: (id: string) => void;
  addGeofence: (center: LatLng, radius: number, name: string) => void;
  removeGeofence: (id: string) => void;
  updateGeofenceRadius: (id: string, radius: number) => void;
  addHospital: (position: LatLng, name: string) => void;
  removeHospital: (id: string) => void;
  activateAmbulance: (driverName: string) => string;
  updateAmbulancePosition: (id: string, position: LatLng, heading: number) => void;
  setAmbulanceExitDirection: (id: string, dir: ExitDirection) => void;
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

function haversineDistance(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * sinLng * sinLng;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

// Default data for demo
const DEFAULT_CENTER: LatLng = { lat: 12.9716, lng: 77.5946 }; // Bangalore

const DEFAULT_JUNCTIONS: Junction[] = [
  { id: "j1", position: { lat: 12.9716, lng: 77.5946 }, name: "MG Road Junction" },
  { id: "j2", position: { lat: 12.9780, lng: 77.5900 }, name: "Cubbon Park Junction" },
  { id: "j3", position: { lat: 12.9650, lng: 77.6000 }, name: "Richmond Circle" },
  { id: "j4", position: { lat: 12.9352, lng: 77.6245 }, name: "Silk Board Junction" },
  { id: "j5", position: { lat: 12.9698, lng: 77.7500 }, name: "Marathahalli Junction" },
  { id: "j6", position: { lat: 12.9783, lng: 77.6408 }, name: "Indiranagar 100ft Road" },
  { id: "j7", position: { lat: 12.9563, lng: 77.6010 }, name: "Lalbagh Gate Junction" },
  { id: "j8", position: { lat: 12.9850, lng: 77.5533 }, name: "Rajajinagar Junction" },
  { id: "j9", position: { lat: 13.0070, lng: 77.5650 }, name: "Yeshwanthpur Circle" },
  { id: "j10", position: { lat: 12.9906, lng: 77.5712 }, name: "Majestic Junction" },
  { id: "j11", position: { lat: 13.0358, lng: 77.5970 }, name: "Hebbal Flyover Junction" },
  { id: "j12", position: { lat: 12.9121, lng: 77.6446 }, name: "BTM Layout Junction" },
  { id: "j13", position: { lat: 12.9344, lng: 77.6101 }, name: "Jayanagar 4th Block" },
  { id: "j14", position: { lat: 12.9540, lng: 77.5730 }, name: "Basavanagudi Circle" },
  { id: "j15", position: { lat: 12.9260, lng: 77.5830 }, name: "Banashankari Junction" },
  { id: "j16", position: { lat: 12.9568, lng: 77.7010 }, name: "HSR Layout Junction" },
  { id: "j17", position: { lat: 12.9165, lng: 77.6101 }, name: "Bommanahalli Junction" },
  { id: "j18", position: { lat: 13.0200, lng: 77.6440 }, name: "KR Puram Junction" },
  { id: "j19", position: { lat: 12.9950, lng: 77.6170 }, name: "CV Raman Nagar Junction" },
  { id: "j20", position: { lat: 12.9450, lng: 77.5620 }, name: "Bull Temple Road Junction" },
];

const DEFAULT_HOSPITALS: Hospital[] = [
  { id: "h1", position: { lat: 12.9600, lng: 77.5850 }, name: "City General Hospital" },
  { id: "h2", position: { lat: 12.9800, lng: 77.6050 }, name: "Metro Emergency Center" },
];

const DEFAULT_GEOFENCES: Geofence[] = [
  { id: "g1", center: { lat: 12.9716, lng: 77.5946 }, radius: 500, name: "MG Road Zone", triggered: false },
];

export const AppStateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [junctions, setJunctions] = useState<Junction[]>(DEFAULT_JUNCTIONS);
  const [geofences, setGeofences] = useState<Geofence[]>(DEFAULT_GEOFENCES);
  const [hospitals, setHospitals] = useState<Hospital[]>(DEFAULT_HOSPITALS);
  const [ambulances, setAmbulances] = useState<Ambulance[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const alertedRef = useRef<Set<string>>(new Set());

  const addJunction = useCallback((position: LatLng, name: string) => {
    setJunctions((prev) => [...prev, { id: crypto.randomUUID(), position, name }]);
  }, []);

  const removeJunction = useCallback((id: string) => {
    setJunctions((prev) => prev.filter((j) => j.id !== id));
  }, []);

  const addGeofence = useCallback((center: LatLng, radius: number, name: string) => {
    setGeofences((prev) => [...prev, { id: crypto.randomUUID(), center, radius, name, triggered: false }]);
  }, []);

  const removeGeofence = useCallback((id: string) => {
    setGeofences((prev) => prev.filter((g) => g.id !== id));
  }, []);

  const updateGeofenceRadius = useCallback((id: string, radius: number) => {
    setGeofences((prev) => prev.map((g) => (g.id === id ? { ...g, radius } : g)));
  }, []);

  const addHospital = useCallback((position: LatLng, name: string) => {
    setHospitals((prev) => [...prev, { id: crypto.randomUUID(), position, name }]);
  }, []);

  const removeHospital = useCallback((id: string) => {
    setHospitals((prev) => prev.filter((h) => h.id !== id));
  }, []);

  const addAlert = useCallback((message: string, type: Alert["type"], ambulanceId?: string) => {
    setAlerts((prev) => [
      { id: crypto.randomUUID(), message, type, timestamp: new Date(), ambulanceId },
      ...prev,
    ].slice(0, 50));
  }, []);

  const dismissAlert = useCallback((id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const activateAmbulance = useCallback((driverName: string): string => {
    const id = crypto.randomUUID();
    // Start near a random junction
    const startJunction = DEFAULT_JUNCTIONS[Math.floor(Math.random() * DEFAULT_JUNCTIONS.length)];
    const offset = { lat: (Math.random() - 0.5) * 0.01, lng: (Math.random() - 0.5) * 0.01 };
    setAmbulances((prev) => [
      ...prev,
      {
        id,
        driverName,
        position: { lat: startJunction.position.lat + offset.lat, lng: startJunction.position.lng + offset.lng },
        speed: 40 + Math.random() * 40,
        heading: Math.random() * 360,
        exitDirection: null,
        insideGeofenceId: null,
        eta: null,
        priority: 0,
        active: true,
      },
    ]);
    addAlert(`Ambulance ${driverName} is now active`, "info", id);
    return id;
  }, [addAlert]);

  const updateAmbulancePosition = useCallback((id: string, position: LatLng, heading: number) => {
    setAmbulances((prev) => prev.map((a) => (a.id === id ? { ...a, position, heading } : a)));
  }, []);

  const setAmbulanceExitDirection = useCallback((id: string, dir: ExitDirection) => {
    setAmbulances((prev) => prev.map((a) => (a.id === id ? { ...a, exitDirection: dir } : a)));
  }, []);

  const recommendedHospital = useCallback(
    (ambulanceId: string): Hospital | null => {
      const amb = ambulances.find((a) => a.id === ambulanceId);
      if (!amb || hospitals.length === 0) return null;
      let closest: Hospital | null = null;
      let minDist = Infinity;
      for (const h of hospitals) {
        const d = haversineDistance(amb.position, h.position);
        if (d < minDist) {
          minDist = d;
          closest = h;
        }
      }
      return closest;
    },
    [ambulances, hospitals]
  );

  // Geofence detection & ETA calculation
  useEffect(() => {
    const interval = setInterval(() => {
      setAmbulances((prev) => {
        const updated = prev.map((amb) => {
          if (!amb.active) return amb;

          // Check geofences
          let insideId: string | null = null;
          for (const gf of geofences) {
            const dist = haversineDistance(amb.position, gf.center);
            if (dist <= gf.radius) {
              insideId = gf.id;
              const key = `${amb.id}-${gf.id}`;
              if (!alertedRef.current.has(key)) {
                alertedRef.current.add(key);
                addAlert(
                  `🚨 Ambulance ${amb.driverName} entered Geofence "${gf.name}" — Prepare clearance`,
                  "geofence",
                  amb.id
                );
                // Trigger geofence
                setGeofences((gfs) => gfs.map((g) => (g.id === gf.id ? { ...g, triggered: true } : g)));
              }
              break;
            }
          }

          // Reset triggered if left
          if (!insideId && amb.insideGeofenceId) {
            const key = `${amb.id}-${amb.insideGeofenceId}`;
            alertedRef.current.delete(key);
            setGeofences((gfs) => gfs.map((g) => (g.id === amb.insideGeofenceId ? { ...g, triggered: false } : g)));
          }

          // Calculate ETA to nearest junction
          let minEta: number | null = null;
          for (const j of junctions) {
            const dist = haversineDistance(amb.position, j.position);
            const etaSeconds = (dist / ((amb.speed * 1000) / 3600));
            if (minEta === null || etaSeconds < minEta) {
              minEta = etaSeconds;
            }
          }

          return { ...amb, insideGeofenceId: insideId, eta: minEta };
        });

        // Priority ranking
        const active = updated.filter((a) => a.active && a.eta !== null).sort((a, b) => (a.eta ?? Infinity) - (b.eta ?? Infinity));
        active.forEach((a, i) => {
          a.priority = i + 1;
        });

        return updated;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [geofences, junctions, addAlert]);

  // Simulate ambulance movement
  useEffect(() => {
    const interval = setInterval(() => {
      setAmbulances((prev) =>
        prev.map((amb) => {
          if (!amb.active) return amb;
          const speedMs = (amb.speed * 1000) / 3600;
          const dt = 1;
          const rad = (amb.heading * Math.PI) / 180;
          const dLat = (speedMs * dt * Math.cos(rad)) / 111320;
          const dLng = (speedMs * dt * Math.sin(rad)) / (111320 * Math.cos((amb.position.lat * Math.PI) / 180));

          // Slight random heading drift
          const newHeading = amb.heading + (Math.random() - 0.5) * 10;

          return {
            ...amb,
            position: {
              lat: amb.position.lat + dLat,
              lng: amb.position.lng + dLng,
            },
            heading: newHeading % 360,
          };
        })
      );
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <AppStateContext.Provider
      value={{
        junctions, geofences, hospitals, ambulances, alerts,
        addJunction, removeJunction,
        addGeofence, removeGeofence, updateGeofenceRadius,
        addHospital, removeHospital,
        activateAmbulance, updateAmbulancePosition, setAmbulanceExitDirection,
        addAlert, dismissAlert, recommendedHospital,
      }}
    >
      {children}
    </AppStateContext.Provider>
  );
};
