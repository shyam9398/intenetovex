import React, { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";

// ── Constants ─────────────────────────────────────────────────────────────────
const JUNCTION_RADIUS = 2.2;
const ROAD_WIDTH = 1.0;
const ROAD_LENGTH = 6;

// ── Types ─────────────────────────────────────────────────────────────────────
export interface JunctionSceneProps {
  className?: string;
  junctionName?: string;
  signalRed?: boolean;
  geofenceTriggered?: boolean;
  ambulances?: {
    id: string;
    driverName: string;
    heading: number;
    exitDirection: string | null;
    insideGeofenceId: string | null;
    priority: number;
    speed: number;
    eta: number | null;
  }[];
}

// ── Road ─────────────────────────────────────────────────────────────────────
const Road: React.FC<{ rotation?: [number, number, number]; isActive?: boolean }> = ({
  rotation = [0, 0, 0],
  isActive = false,
}) => {
  const color = isActive ? "#22c55e" : "#2a2f3a";
  const emissive = isActive ? "#14532d" : "#111827";

  return (
    <mesh rotation={rotation as any} receiveShadow={false}>
      <boxGeometry args={[ROAD_WIDTH, 0.05, ROAD_LENGTH]} />
      <meshStandardMaterial
        color={color}
        emissive={emissive}
        emissiveIntensity={isActive ? 0.6 : 0.1}
        roughness={0.9}
        metalness={0}
      />
    </mesh>
  );
};

// ── Junction center ───────────────────────────────────────────────────────────
const JunctionCenter: React.FC<{ signalRed: boolean }> = ({ signalRed }) => (
  <mesh position={[0, 0.03, 0]}>
    <boxGeometry args={[ROAD_WIDTH, 0.04, ROAD_WIDTH]} />
    <meshStandardMaterial
      color={signalRed ? "#7f1d1d" : "#14532d"}
      emissive={signalRed ? "#ef4444" : "#22c55e"}
      emissiveIntensity={0.5}
      roughness={0.8}
    />
  </mesh>
);

// ── Geofence ring ────────────────────────────────────────────────────────────
const GeofenceRing: React.FC<{ triggered: boolean }> = ({ triggered }) => {
  const meshRef = useRef<THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>>(null);
  useFrame(({ clock }) => {
    if (meshRef.current) {
      const t = clock.getElapsedTime();
      meshRef.current.material.opacity = triggered
        ? 0.35 + Math.sin(t * 3) * 0.2
        : 0.18 + Math.sin(t * 1.5) * 0.06;
    }
  });

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]}>
      <ringGeometry args={[JUNCTION_RADIUS - 0.08, JUNCTION_RADIUS, 64]} />
      <meshBasicMaterial
        color={triggered ? "#ef4444" : "#f59e0b"}
        transparent
        opacity={0.25}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
};

// ── Ground plate ──────────────────────────────────────────────────────────────
const Ground: React.FC = () => (
  <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow={false}>
    <planeGeometry args={[20, 20]} />
    <meshStandardMaterial color="#111318" roughness={1} metalness={0} />
  </mesh>
);

// ── Exit arrow ────────────────────────────────────────────────────────────────
const ExitArrow: React.FC<{ direction: string | null }> = ({ direction }) => {
  if (!direction) return null;

  const rotMap: Record<string, number> = {
    straight: 0,
    left: -Math.PI / 2,
    right: Math.PI / 2,
  };
  const offsetMap: Record<string, [number, number, number]> = {
    straight: [0, 0.12, -(ROAD_LENGTH / 2 + 0.5)],
    left: [-(ROAD_LENGTH / 2 + 0.5), 0.12, 0],
    right: [(ROAD_LENGTH / 2 + 0.5), 0.12, 0],
  };

  const rot = rotMap[direction] ?? 0;
  const pos = offsetMap[direction] ?? [0, 0.12, 0];

  return (
    <group position={pos as any} rotation={[0, rot, 0]}>
      <mesh position={[0, 0, 0.2]}>
        <boxGeometry args={[0.15, 0.06, 0.6]} />
        <meshStandardMaterial color="#22c55e" emissive="#14532d" emissiveIntensity={0.8} />
      </mesh>
      <mesh position={[0, 0, -0.1]} rotation={[0, 0, 0]}>
        <coneGeometry args={[0.25, 0.4, 8]} />
        <meshStandardMaterial color="#22c55e" emissive="#14532d" emissiveIntensity={0.8} />
      </mesh>
    </group>
  );
};

// ── Single Ambulance ──────────────────────────────────────────────────────────
interface AmbulanceProps {
  x: number;
  z: number;
  priority: number;
  driverName: string;
  insideGeofence: boolean;
  exitDirection: string | null;
  isFirst: boolean;
}

const Ambulance3D: React.FC<AmbulanceProps> = ({
  x, z, priority, driverName, insideGeofence, exitDirection, isFirst,
}) => {
  const bodyRef = useRef<THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>>(null);

  useFrame(({ clock }) => {
    if (bodyRef.current && insideGeofence) {
      bodyRef.current.material.emissiveIntensity = 0.6 + Math.sin(clock.getElapsedTime() * 4) * 0.3;
    } else if (bodyRef.current) {
      bodyRef.current.material.emissiveIntensity = 0.3;
    }
  });

  return (
    <group position={[x, 0.1, z]}>
      <mesh ref={bodyRef} position={[0, 0.18, 0]}>
        <boxGeometry args={[0.38, 0.28, 0.6]} />
        <meshStandardMaterial
          color={insideGeofence ? "#dc2626" : "#e2e8f0"}
          emissive={insideGeofence ? "#7f1d1d" : "#1e3a5f"}
          emissiveIntensity={0.3}
          roughness={0.4}
          metalness={0.2}
        />
      </mesh>
      <mesh position={[0, 0.35, 0]}>
        <boxGeometry args={[0.36, 0.06, 0.58]} />
        <meshStandardMaterial color="#dc2626" emissive="#7f1d1d" emissiveIntensity={0.5} />
      </mesh>

      <Html position={[0, 0.85, 0]} center>
        <div
          style={{
            background: isFirst ? "hsl(0,72%,51%)" : "hsl(220,16%,18%)",
            color: "white",
            fontSize: "11px",
            fontWeight: 700,
            fontFamily: "JetBrains Mono, monospace",
            padding: "2px 6px",
            borderRadius: "4px",
            border: "1px solid rgba(255,255,255,0.2)",
            whiteSpace: "nowrap",
            pointerEvents: "none",
            lineHeight: 1.4,
            boxShadow: isFirst ? "0 0 8px rgba(220,38,38,0.6)" : "none",
          }}
        >
          #{priority} {driverName.split(" ")[0]}
        </div>
      </Html>

      {insideGeofence && (
        <Html position={[0, 1.2, 0]} center>
          <div
            style={{
              background: "hsl(0,72%,51%)",
              color: "white",
              fontSize: "9px",
              fontWeight: 600,
              fontFamily: "Inter, sans-serif",
              padding: "1px 5px",
              borderRadius: "3px",
              whiteSpace: "nowrap",
              pointerEvents: "none",
            }}
          >
            ⚠ GEOFENCE
          </div>
        </Html>
      )}
    </group>
  );
};

// ── Scene ─────────────────────────────────────────────────────────────────────
const JunctionScene: React.FC<{
  signalRed: boolean;
  geofenceTriggered: boolean;
  ambulances: JunctionSceneProps["ambulances"];
  junctionName?: string;
}> = ({ signalRed, geofenceTriggered, ambulances = [], junctionName }) => {
  const activeAmbs = useMemo(
    () => [...ambulances].sort((a, b) => a.priority - b.priority),
    [ambulances]
  );

  // Determine exit direction from highest-priority ambulance inside geofence
  const insideAmb = activeAmbs.find((a) => a.insideGeofenceId);
  const exitDir = insideAmb?.exitDirection ?? null;

  // Approach road: which direction is the ambulance coming from?
  const approachRoad = useMemo(() => {
    if (!insideAmb) return null;
    const h = insideAmb.heading % 360;
    if (h >= 315 || h < 45) return "north";
    if (h >= 45 && h < 135) return "east";
    if (h >= 135 && h < 225) return "south";
    return "west";
  }, [insideAmb]);

  // Determine which roads should be green (approach + exit)
  const nsActive = useMemo(() => {
    if (!approachRoad) return false;
    // N-S road is active if approach is from north/south
    const approachOnNS = approachRoad === "north" || approachRoad === "south";
    // Or if exit goes straight on the same axis
    const exitOnNS = exitDir === "straight" && approachOnNS;
    // Or if exit is left/right and that maps to N-S
    // If approaching from east/west, left/right exits go to N-S
    const exitTurnsToNS =
      (approachRoad === "east" || approachRoad === "west") &&
      (exitDir === "left" || exitDir === "right");
    return approachOnNS || exitOnNS || exitTurnsToNS;
  }, [approachRoad, exitDir]);

  const ewActive = useMemo(() => {
    if (!approachRoad) return false;
    const approachOnEW = approachRoad === "east" || approachRoad === "west";
    const exitOnEW = exitDir === "straight" && approachOnEW;
    const exitTurnsToEW =
      (approachRoad === "north" || approachRoad === "south") &&
      (exitDir === "left" || exitDir === "right");
    return approachOnEW || exitOnEW || exitTurnsToEW;
  }, [approachRoad, exitDir]);

  // Place ambulances in a circle around junction
  const placedAmbs = useMemo(() => {
    return activeAmbs.map((amb, i) => {
      const angle = (i / Math.max(activeAmbs.length, 1)) * Math.PI * 2;
      const r = JUNCTION_RADIUS * 0.55;
      return { ...amb, sx: Math.cos(angle) * r, sz: Math.sin(angle) * r };
    });
  }, [activeAmbs]);

  return (
    <>
      <ambientLight intensity={0.55} color="#c8d0e0" />
      <directionalLight position={[5, 8, 5]} intensity={0.7} color="#e0e8ff" castShadow={false} />
      <pointLight position={[0, 3, 0]} intensity={0.3} color="#ffffff" distance={12} />

      <Ground />

      {/* 4-way cross roads */}
      <Road rotation={[0, 0, 0]} isActive={nsActive} />
      <Road rotation={[0, Math.PI / 2, 0]} isActive={ewActive} />

      <JunctionCenter signalRed={signalRed} />
      <GeofenceRing triggered={geofenceTriggered} />
      <ExitArrow direction={exitDir} />

      {/* Lane markings */}
      {[-1.5, 0, 1.5].map((z) => (
        <mesh key={`lm-ns-${z}`} position={[0, 0.04, z]}>
          <boxGeometry args={[0.06, 0.01, 0.4]} />
          <meshBasicMaterial color="#4b5563" />
        </mesh>
      ))}
      {[-1.5, 0, 1.5].map((x) => (
        <mesh key={`lm-ew-${x}`} position={[x, 0.04, 0]}>
          <boxGeometry args={[0.4, 0.01, 0.06]} />
          <meshBasicMaterial color="#4b5563" />
        </mesh>
      ))}

      {/* Signal poles */}
      {[[0.8, 0.8], [-0.8, 0.8], [0.8, -0.8], [-0.8, -0.8]].map(([px, pz], i) => (
        <group key={i} position={[px, 0, pz]}>
          <mesh position={[0, 0.4, 0]}>
            <cylinderGeometry args={[0.03, 0.03, 0.8, 8]} />
            <meshStandardMaterial color="#374151" roughness={0.8} />
          </mesh>
          <mesh position={[0, 0.85, 0]}>
            <sphereGeometry args={[0.08, 8, 8]} />
            <meshStandardMaterial
              color={signalRed ? "#dc2626" : "#22c55e"}
              emissive={signalRed ? "#dc2626" : "#22c55e"}
              emissiveIntensity={0.9}
            />
          </mesh>
        </group>
      ))}

      {/* Junction name label */}
      {junctionName && (
        <Html position={[0, 0.3, ROAD_LENGTH / 2 + 1]} center>
          <div
            style={{
              background: "hsl(220,16%,14%)",
              color: "hsl(215,20%,75%)",
              fontSize: "12px",
              fontWeight: 700,
              fontFamily: "Inter, sans-serif",
              padding: "3px 10px",
              borderRadius: "6px",
              border: "1px solid rgba(255,255,255,0.1)",
              whiteSpace: "nowrap",
              pointerEvents: "none",
            }}
          >
            {junctionName}
          </div>
        </Html>
      )}

      {/* Ambulances */}
      {placedAmbs.map((amb) => (
        <Ambulance3D
          key={amb.id}
          x={amb.sx}
          z={amb.sz}
          priority={amb.priority}
          driverName={amb.driverName}
          insideGeofence={!!amb.insideGeofenceId}
          exitDirection={amb.exitDirection}
          isFirst={amb.priority === 1}
        />
      ))}

      {activeAmbs.length === 0 && (
        <Html center position={[0, 0.5, 0]}>
          <div style={{
            color: "hsl(215,12%,55%)",
            fontSize: "11px",
            fontFamily: "Inter, sans-serif",
            textAlign: "center",
            pointerEvents: "none",
          }}>
            No active ambulances
          </div>
        </Html>
      )}
    </>
  );
};

// ── Exported wrapper ─────────────────────────────────────────────────────────
const JunctionScene3D: React.FC<JunctionSceneProps> = ({
  className,
  junctionName,
  signalRed = false,
  geofenceTriggered = false,
  ambulances = [],
}) => {
  return (
    <div className={className} style={{ background: "hsl(220,20%,8%)" }}>
      <Canvas
        camera={{ position: [0, 9, 6], fov: 45 }}
        gl={{ antialias: true, powerPreference: "low-power" }}
        dpr={[1, 1.5]}
        frameloop="always"
      >
        <JunctionScene
          signalRed={signalRed}
          geofenceTriggered={geofenceTriggered}
          ambulances={ambulances}
          junctionName={junctionName}
        />
      </Canvas>
    </div>
  );
};

export default JunctionScene3D;