import React, { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";

const JUNCTION_RADIUS = 2.2;
const ROAD_WIDTH = 1.0;
const ROAD_LENGTH = 6;

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

// Direction labels on road ends
const DirectionLabel: React.FC<{ label: string; position: [number, number, number] }> = ({ label, position }) => (
  <Html position={position} center>
    <div style={{
      background: "hsl(220,16%,14%)", color: "hsl(215,20%,75%)", fontSize: "11px",
      fontWeight: 700, fontFamily: "Inter, sans-serif", padding: "2px 8px",
      borderRadius: "4px", border: "1px solid rgba(255,255,255,0.15)",
      whiteSpace: "nowrap", pointerEvents: "none",
    }}>
      {label}
    </div>
  </Html>
);

// Road segment
const Road: React.FC<{ rotation?: [number, number, number]; isActive?: boolean }> = ({
  rotation = [0, 0, 0], isActive = false,
}) => (
  <mesh rotation={rotation as any} receiveShadow={false}>
    <boxGeometry args={[ROAD_WIDTH, 0.05, ROAD_LENGTH]} />
    <meshStandardMaterial
      color={isActive ? "#3b82f6" : "#2a2f3a"}
      emissive={isActive ? "#1e3a5f" : "#111827"}
      emissiveIntensity={isActive ? 0.6 : 0.1}
      roughness={0.9} metalness={0}
    />
  </mesh>
);

// Junction center
const JunctionCenter: React.FC<{ signalRed: boolean }> = ({ signalRed }) => (
  <mesh position={[0, 0.03, 0]}>
    <boxGeometry args={[ROAD_WIDTH, 0.04, ROAD_WIDTH]} />
    <meshStandardMaterial
      color={signalRed ? "#7f1d1d" : "#14532d"}
      emissive={signalRed ? "#ef4444" : "#22c55e"}
      emissiveIntensity={0.5} roughness={0.8}
    />
  </mesh>
);

// Geofence ring
const GeofenceRing: React.FC<{ triggered: boolean }> = ({ triggered }) => {
  const meshRef = useRef<THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>>(null);
  useFrame(({ clock }) => {
    if (meshRef.current) {
      const t = clock.getElapsedTime();
      meshRef.current.material.opacity = triggered
        ? 0.35 + Math.sin(t * 3) * 0.2 : 0.18 + Math.sin(t * 1.5) * 0.06;
    }
  });
  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]}>
      <ringGeometry args={[JUNCTION_RADIUS - 0.08, JUNCTION_RADIUS, 64]} />
      <meshBasicMaterial color={triggered ? "#ef4444" : "#f59e0b"} transparent opacity={0.25} side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
  );
};

const Ground: React.FC = () => (
  <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow={false}>
    <planeGeometry args={[20, 20]} />
    <meshStandardMaterial color="#111318" roughness={1} metalness={0} />
  </mesh>
);

// L-shaped path connecting approach and exit directions
const LShapedPath: React.FC<{ approach: string; exit: string | null }> = ({ approach, exit }) => {
  if (!exit) return null;

  // Map direction to position on the road
  const dirPos: Record<string, [number, number]> = {
    north: [0, -ROAD_LENGTH / 2],
    south: [0, ROAD_LENGTH / 2],
    east: [ROAD_LENGTH / 2, 0],
    west: [-ROAD_LENGTH / 2, 0],
  };

  // Map exit direction relative to approach to absolute direction
  const getAbsoluteExit = (approach: string, relExit: string): string => {
    const dirs = ["north", "east", "south", "west"];
    const approachIdx = dirs.indexOf(approach);
    // "straight" = opposite of approach
    // "left" = 90° left from travel direction
    // "right" = 90° right from travel direction
    // Travel direction is opposite of approach
    const travelIdx = (approachIdx + 2) % 4;
    if (relExit === "straight") return dirs[travelIdx];
    if (relExit === "right") return dirs[(travelIdx + 1) % 4];
    if (relExit === "left") return dirs[(travelIdx + 3) % 4];
    return dirs[travelIdx];
  };

  const absExit = getAbsoluteExit(approach, exit);
  const approachPos = dirPos[approach];
  const exitPos = dirPos[absExit];

  if (!approachPos || !exitPos) return null;

  // Build L-shaped path: approach -> center -> exit
  const pathSegments: { from: [number, number]; to: [number, number] }[] = [
    { from: approachPos, to: [0, 0] },
    { from: [0, 0], to: exitPos },
  ];

  return (
    <group>
      {pathSegments.map((seg, i) => {
        const dx = seg.to[0] - seg.from[0];
        const dz = seg.to[1] - seg.from[1];
        const length = Math.sqrt(dx * dx + dz * dz);
        const angle = Math.atan2(dx, dz);
        const cx = (seg.from[0] + seg.to[0]) / 2;
        const cz = (seg.from[1] + seg.to[1]) / 2;

        return (
          <mesh key={i} position={[cx, 0.08, cz]} rotation={[0, angle, 0]}>
            <boxGeometry args={[0.3, 0.04, length]} />
            <meshStandardMaterial
              color="#3b82f6" emissive="#1e3a5f" emissiveIntensity={0.8}
              transparent opacity={0.85}
            />
          </mesh>
        );
      })}
      {/* Arrow at exit end */}
      <mesh position={[exitPos[0], 0.12, exitPos[1]]} rotation={[0, Math.atan2(exitPos[0], exitPos[1]), 0]}>
        <coneGeometry args={[0.2, 0.35, 8]} />
        <meshStandardMaterial color="#22c55e" emissive="#14532d" emissiveIntensity={0.8} />
      </mesh>
    </group>
  );
};

// Single Ambulance 3D
const Ambulance3D: React.FC<{
  x: number; z: number; priority: number; driverName: string;
  insideGeofence: boolean; isFirst: boolean;
}> = ({ x, z, priority, driverName, insideGeofence, isFirst }) => {
  const bodyRef = useRef<THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>>(null);
  useFrame(({ clock }) => {
    if (bodyRef.current) {
      bodyRef.current.material.emissiveIntensity = insideGeofence
        ? 0.6 + Math.sin(clock.getElapsedTime() * 4) * 0.3 : 0.3;
    }
  });

  return (
    <group position={[x, 0.1, z]}>
      <mesh ref={bodyRef} position={[0, 0.18, 0]}>
        <boxGeometry args={[0.38, 0.28, 0.6]} />
        <meshStandardMaterial
          color={insideGeofence ? "#dc2626" : "#e2e8f0"}
          emissive={insideGeofence ? "#7f1d1d" : "#1e3a5f"}
          emissiveIntensity={0.3} roughness={0.4} metalness={0.2}
        />
      </mesh>
      <mesh position={[0, 0.35, 0]}>
        <boxGeometry args={[0.36, 0.06, 0.58]} />
        <meshStandardMaterial color="#dc2626" emissive="#7f1d1d" emissiveIntensity={0.5} />
      </mesh>
      <Html position={[0, 0.85, 0]} center>
        <div style={{
          background: isFirst ? "hsl(0,72%,51%)" : "hsl(220,16%,18%)",
          color: "white", fontSize: "11px", fontWeight: 700,
          fontFamily: "JetBrains Mono, monospace", padding: "2px 6px",
          borderRadius: "4px", border: "1px solid rgba(255,255,255,0.2)",
          whiteSpace: "nowrap", pointerEvents: "none", lineHeight: 1.4,
          boxShadow: isFirst ? "0 0 8px rgba(220,38,38,0.6)" : "none",
        }}>
          #{priority} {driverName.split(" ")[0]}
        </div>
      </Html>
    </group>
  );
};

// Scene
const JunctionScene: React.FC<{
  signalRed: boolean; geofenceTriggered: boolean;
  ambulances: JunctionSceneProps["ambulances"]; junctionName?: string;
}> = ({ signalRed, geofenceTriggered, ambulances = [], junctionName }) => {
  const activeAmbs = useMemo(() => [...ambulances].sort((a, b) => a.priority - b.priority), [ambulances]);
  const insideAmb = activeAmbs.find((a) => a.insideGeofenceId);

  // Get approach direction from heading
  const approachDir = useMemo(() => {
    if (!insideAmb) return null;
    const h = insideAmb.heading % 360;
    if (h >= 315 || h < 45) return "south";   // heading north = approaching from south
    if (h >= 45 && h < 135) return "west";    // heading east = approaching from west
    if (h >= 135 && h < 225) return "north";  // heading south = approaching from north
    return "east";                             // heading west = approaching from east
  }, [insideAmb]);

  const exitDir = insideAmb?.exitDirection ?? null;

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

      {/* 4-way roads - not individually highlighted */}
      <Road rotation={[0, 0, 0]} />
      <Road rotation={[0, Math.PI / 2, 0]} />

      <JunctionCenter signalRed={signalRed} />
      <GeofenceRing triggered={geofenceTriggered} />

      {/* L-shaped green path for approach + exit */}
      {approachDir && <LShapedPath approach={approachDir} exit={exitDir} />}

      {/* Direction labels at road ends */}
      <DirectionLabel label="N" position={[0, 0.3, -(ROAD_LENGTH / 2 + 0.8)]} />
      <DirectionLabel label="S" position={[0, 0.3, ROAD_LENGTH / 2 + 0.8]} />
      <DirectionLabel label="E" position={[ROAD_LENGTH / 2 + 0.8, 0.3, 0]} />
      <DirectionLabel label="W" position={[-(ROAD_LENGTH / 2 + 0.8), 0.3, 0]} />

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

      {junctionName && (
        <Html position={[0, 0.3, ROAD_LENGTH / 2 + 1.5]} center>
          <div style={{
            background: "hsl(220,16%,14%)", color: "hsl(215,20%,75%)",
            fontSize: "12px", fontWeight: 700, fontFamily: "Inter, sans-serif",
            padding: "3px 10px", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.1)",
            whiteSpace: "nowrap", pointerEvents: "none",
          }}>
            {junctionName}
          </div>
        </Html>
      )}

      {placedAmbs.map((amb) => (
        <Ambulance3D key={amb.id} x={amb.sx} z={amb.sz}
          priority={amb.priority} driverName={amb.driverName}
          insideGeofence={!!amb.insideGeofenceId} isFirst={amb.priority === 1}
        />
      ))}

      {activeAmbs.length === 0 && (
        <Html center position={[0, 0.5, 0]}>
          <div style={{ color: "hsl(215,12%,55%)", fontSize: "11px", fontFamily: "Inter, sans-serif", textAlign: "center", pointerEvents: "none" }}>
            No active ambulances
          </div>
        </Html>
      )}
    </>
  );
};

const JunctionScene3D: React.FC<JunctionSceneProps> = ({
  className, junctionName, signalRed = false, geofenceTriggered = false, ambulances = [],
}) => (
  <div className={className} style={{ background: "hsl(220,20%,8%)" }}>
    <Canvas
      camera={{ position: [0, 9, 6], fov: 45 }}
      gl={{ antialias: true, powerPreference: "low-power" }}
      dpr={[1, 1.5]} frameloop="always"
    >
      <JunctionScene signalRed={signalRed} geofenceTriggered={geofenceTriggered}
        ambulances={ambulances} junctionName={junctionName} />
    </Canvas>
  </div>
);

export default JunctionScene3D;
