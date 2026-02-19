import React, { useRef, useMemo, useEffect, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Html, Line } from "@react-three/drei";
import * as THREE from "three";
import { useAppState, type Ambulance } from "@/contexts/AppStateContext";

// ── Constants ─────────────────────────────────────────────────────────────────
const ROAD_WIDTH = 1.1;
const ROAD_ARM = 7;          // how long each road arm extends
const GEOFENCE_R = 2.5;      // visual geofence radius in scene units
const SPEED = 0.028;         // movement per frame
const TRAIL_MAX = 60;        // max trail points

// Map heading → which arm to arrive from, and start/end positions
// 4 arms: North (z- = negative z), South (z+), East (x+), West (x-)
const ARMS: Record<string, { start: [number, number, number]; dir: [number, number, number] }> = {
  north: { start: [0, 0.15, ROAD_ARM],   dir: [0, 0, -1] },
  south: { start: [0, 0.15, -ROAD_ARM],  dir: [0, 0,  1] },
  east:  { start: [-ROAD_ARM, 0.15, 0],  dir: [1, 0,  0] },
  west:  { start: [ROAD_ARM, 0.15, 0],   dir: [-1, 0, 0] },
};

const EXIT_DIR_TO_ARM: Record<string, string> = {
  straight: "north",
  left: "west",
  right: "east",
};

// Assign approach arms round-robin for ambulances without heading info
const APPROACH_ARMS = ["north", "south", "east", "west"];

// Color palette for multi-ambulance distinction
const AMB_COLORS = [
  { body: "#e53e3e", emissive: "#7f1d1d", trail: "#ef4444" },
  { body: "#3b82f6", emissive: "#1e3a8a", trail: "#60a5fa" },
  { body: "#f59e0b", emissive: "#78350f", trail: "#fbbf24" },
  { body: "#8b5cf6", emissive: "#4c1d95", trail: "#a78bfa" },
  { body: "#10b981", emissive: "#064e3b", trail: "#34d399" },
];

function headingToArm(heading: number): string {
  const h = ((heading % 360) + 360) % 360;
  if (h >= 315 || h < 45) return "north";
  if (h >= 45 && h < 135) return "east";
  if (h >= 135 && h < 225) return "south";
  return "west";
}

function oppositeArm(arm: string): string {
  const map: Record<string, string> = { north: "south", south: "north", east: "west", west: "east" };
  return map[arm] ?? "south";
}

// ── Ground ─────────────────────────────────────────────────────────────────────
const Ground: React.FC = () => (
  <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
    <planeGeometry args={[22, 22]} />
    <meshStandardMaterial color="#0d1117" roughness={1} metalness={0} />
  </mesh>
);

// ── Road arm mesh ──────────────────────────────────────────────────────────────
interface RoadArmProps {
  arm: string;
  ambulancesOnArm: { color: string; isExit: boolean; isApproach: boolean }[];
}

const RoadArm: React.FC<RoadArmProps> = ({ arm, ambulancesOnArm }) => {
  const isApproach = ambulancesOnArm.some((a) => a.isApproach);
  const isExit = ambulancesOnArm.some((a) => a.isExit);

  const approachColor = ambulancesOnArm.find((a) => a.isApproach)?.color ?? "#ef4444";
  const exitColor = "#22c55e";

  const roadColor = isExit ? exitColor : isApproach ? approachColor : "#1e2330";
  const emissive = isExit ? "#14532d" : isApproach ? "#450a0a" : "#0a0d12";
  const intensity = isExit || isApproach ? 0.55 : 0.08;

  const geo: [number, number, number] =
    arm === "north" || arm === "south"
      ? [ROAD_WIDTH, 0.06, ROAD_ARM]
      : [ROAD_ARM, 0.06, ROAD_WIDTH];

  const posZ = arm === "north" ? ROAD_ARM / 2 : arm === "south" ? -ROAD_ARM / 2 : 0;
  const posX = arm === "east" ? ROAD_ARM / 2 : arm === "west" ? -ROAD_ARM / 2 : 0;

  return (
    <mesh position={[posX, 0, posZ]}>
      <boxGeometry args={geo} />
      <meshStandardMaterial
        color={roadColor}
        emissive={emissive}
        emissiveIntensity={intensity}
        roughness={0.9}
        metalness={0}
      />
    </mesh>
  );
};

// ── Junction center pad ────────────────────────────────────────────────────────
const JunctionCenter: React.FC<{ signalRed: boolean }> = ({ signalRed }) => (
  <mesh position={[0, 0.04, 0]}>
    <boxGeometry args={[ROAD_WIDTH, 0.06, ROAD_WIDTH]} />
    <meshStandardMaterial
      color={signalRed ? "#450a0a" : "#052e16"}
      emissive={signalRed ? "#dc2626" : "#16a34a"}
      emissiveIntensity={0.6}
      roughness={0.8}
    />
  </mesh>
);

// ── Geofence ring ──────────────────────────────────────────────────────────────
const GeofenceRing: React.FC<{ triggered: boolean; numInside: number }> = ({ triggered, numInside }) => {
  const meshRef = useRef<THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>>(null);
  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = clock.getElapsedTime();
    const base = triggered ? 0.4 : 0.15;
    const amp = triggered ? 0.2 : 0.05;
    const freq = triggered ? 3 + numInside : 1.2;
    meshRef.current.material.opacity = base + Math.sin(t * freq) * amp;
  });

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.07, 0]}>
      <ringGeometry args={[GEOFENCE_R - 0.1, GEOFENCE_R + 0.05, 72]} />
      <meshBasicMaterial
        color={triggered ? "#ef4444" : "#f59e0b"}
        transparent
        opacity={0.2}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
};

// ── Signal poles ───────────────────────────────────────────────────────────────
const SignalPoles: React.FC<{ red: boolean }> = ({ red }) => (
  <>
    {([[0.85, 0.85], [-0.85, 0.85], [0.85, -0.85], [-0.85, -0.85]] as [number, number][]).map(([px, pz], i) => (
      <group key={i} position={[px, 0, pz]}>
        <mesh position={[0, 0.45, 0]}>
          <cylinderGeometry args={[0.028, 0.028, 0.9, 6]} />
          <meshStandardMaterial color="#374151" roughness={0.8} />
        </mesh>
        <mesh position={[0, 0.95, 0]}>
          <sphereGeometry args={[0.075, 8, 8]} />
          <meshStandardMaterial
            color={red ? "#dc2626" : "#22c55e"}
            emissive={red ? "#dc2626" : "#22c55e"}
            emissiveIntensity={1.0}
          />
        </mesh>
      </group>
    ))}
  </>
);

// ── Lane markings ─────────────────────────────────────────────────────────────
const LaneMarkings: React.FC = () => (
  <>
    {[-2, -1, 0, 1, 2].map((z) => (
      <mesh key={`ns-${z}`} position={[0, 0.05, z * 1.2]}>
        <boxGeometry args={[0.05, 0.01, 0.38]} />
        <meshBasicMaterial color="#2d3748" />
      </mesh>
    ))}
    {[-2, -1, 0, 1, 2].map((x) => (
      <mesh key={`ew-${x}`} position={[x * 1.2, 0.05, 0]}>
        <boxGeometry args={[0.38, 0.01, 0.05]} />
        <meshBasicMaterial color="#2d3748" />
      </mesh>
    ))}
  </>
);

// ── Ambulance trail ───────────────────────────────────────────────────────────
const AmbulanceTrail: React.FC<{ points: THREE.Vector3[]; color: string }> = ({ points, color }) => {
  if (points.length < 2) return null;
  return (
    <Line
      points={points}
      color={color}
      lineWidth={1.5}
      transparent
      opacity={0.55}
      dashed={false}
    />
  );
};

// ── Local per-ambulance state ─────────────────────────────────────────────────
interface AmbLocalState {
  pos: THREE.Vector3;
  phase: "approach" | "inside" | "exit" | "done";
  arm: string;
  exitArm: string;
  trail: THREE.Vector3[];
  colorIdx: number;
}

// ── Moving ambulance ──────────────────────────────────────────────────────────
interface MovingAmbProps {
  ambId: string;
  driverName: string;
  priority: number;
  isFirst: boolean;
  insideGeofence: boolean;
  exitDirection: string | null;
  approachArm: string;
  colorIdx: number;
  onStateChange: (id: string, phase: AmbLocalState["phase"], pos: THREE.Vector3, trail: THREE.Vector3[]) => void;
}

const MovingAmb: React.FC<MovingAmbProps> = ({
  ambId, driverName, priority, isFirst, insideGeofence, exitDirection, approachArm, colorIdx, onStateChange,
}) => {
  const pal = AMB_COLORS[colorIdx % AMB_COLORS.length];
  const bodyRef = useRef<THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>>(null);
  const groupRef = useRef<THREE.Group>(null);

  // Local motion state
  const motionRef = useRef<{
    pos: THREE.Vector3;
    phase: "approach" | "inside" | "exit" | "done";
    exitArm: string;
    trail: THREE.Vector3[];
    framesSinceTrail: number;
  }>({
    pos: new THREE.Vector3(...ARMS[approachArm].start),
    phase: "approach",
    exitArm: oppositeArm(approachArm),
    trail: [],
    framesSinceTrail: 0,
  });

  // When exitDirection changes, recalculate exit arm
  useEffect(() => {
    if (!exitDirection) return;
    const approachOpp = oppositeArm(approachArm);
    let exitArm = approachOpp;
    if (exitDirection === "left") {
      const leftMap: Record<string, string> = { north: "east", east: "south", south: "west", west: "north" };
      exitArm = leftMap[approachArm] ?? approachOpp;
    } else if (exitDirection === "right") {
      const rightMap: Record<string, string> = { north: "west", west: "south", south: "east", east: "north" };
      exitArm = rightMap[approachArm] ?? approachOpp;
    }
    motionRef.current.exitArm = exitArm;
  }, [exitDirection, approachArm]);

  useFrame(() => {
    const m = motionRef.current;
    const arm = ARMS[approachArm];
    const exitArm = ARMS[m.exitArm];

    let moved = false;
    if (m.phase === "approach") {
      // Move toward center
      const dir = new THREE.Vector3(...arm.dir);
      m.pos.addScaledVector(dir, SPEED);
      // Check if reached geofence boundary
      if (m.pos.distanceTo(new THREE.Vector3(0, 0.15, 0)) <= GEOFENCE_R) {
        m.phase = "inside";
      }
      moved = true;
    } else if (m.phase === "inside") {
      // Drift toward center
      const center = new THREE.Vector3(0, 0.15, 0);
      const toCenter = center.clone().sub(m.pos);
      if (toCenter.length() > 0.15) {
        m.pos.addScaledVector(toCenter.normalize(), SPEED * 0.7);
      } else {
        // Move to exit phase once geofence is entered and exit direction is known
        m.phase = "exit";
      }
      moved = true;
    } else if (m.phase === "exit") {
      // Move toward exit arm end
      const exitStart = new THREE.Vector3(...exitArm.start);
      const toExit = exitStart.clone().sub(new THREE.Vector3(0, 0.15, 0));
      const exitDir3 = toExit.normalize();
      m.pos.addScaledVector(exitDir3, SPEED);
      if (m.pos.distanceTo(exitStart) < 0.3) {
        m.phase = "done";
      }
      moved = true;
    } else if (m.phase === "done") {
      // Loop back: reset to approach start
      m.pos.set(...ARMS[approachArm].start);
      m.phase = "approach";
      m.trail = [];
    }

    // Update mesh position
    if (groupRef.current) {
      groupRef.current.position.copy(m.pos);
    }

    // Pulse body if inside geofence
    if (bodyRef.current) {
      const t = performance.now() / 1000;
      bodyRef.current.material.emissiveIntensity = insideGeofence
        ? 0.6 + Math.sin(t * 5) * 0.35
        : 0.25;
    }

    // Record trail every 3 frames
    if (moved) {
      m.framesSinceTrail++;
      if (m.framesSinceTrail >= 3) {
        m.framesSinceTrail = 0;
        m.trail = [...m.trail.slice(-TRAIL_MAX + 1), m.pos.clone()];
      }
    }

    // Notify parent of state (for road highlighting etc.)
    onStateChange(ambId, m.phase, m.pos.clone(), m.trail);
  });

  return (
    <group ref={groupRef} position={[...ARMS[approachArm].start] as [number, number, number]}>
      {/* Body */}
      <mesh ref={bodyRef} position={[0, 0.18, 0]}>
        <boxGeometry args={[0.42, 0.26, 0.64]} />
        <meshStandardMaterial
          color={pal.body}
          emissive={pal.emissive}
          emissiveIntensity={0.25}
          roughness={0.35}
          metalness={0.15}
        />
      </mesh>
      {/* Roof stripe */}
      <mesh position={[0, 0.33, 0]}>
        <boxGeometry args={[0.4, 0.07, 0.62]} />
        <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.3} />
      </mesh>
      {/* Red cross */}
      <mesh position={[0, 0.38, 0.1]}>
        <boxGeometry args={[0.08, 0.04, 0.22]} />
        <meshStandardMaterial color="#dc2626" emissive="#dc2626" emissiveIntensity={0.6} />
      </mesh>
      <mesh position={[0, 0.38, 0.1]}>
        <boxGeometry args={[0.22, 0.04, 0.08]} />
        <meshStandardMaterial color="#dc2626" emissive="#dc2626" emissiveIntensity={0.6} />
      </mesh>

      {/* Priority label */}
      <Html position={[0, 0.9, 0]} center>
        <div style={{
          background: isFirst ? pal.body : "rgba(15,20,30,0.85)",
          color: "white",
          fontSize: "10px",
          fontWeight: 700,
          fontFamily: "monospace",
          padding: "2px 7px",
          borderRadius: "4px",
          border: `1px solid ${pal.trail}55`,
          whiteSpace: "nowrap",
          pointerEvents: "none",
          lineHeight: 1.5,
          boxShadow: isFirst ? `0 0 10px ${pal.trail}88` : "none",
        }}>
          #{priority} {driverName.split(" ")[0]}
        </div>
      </Html>

      {/* Geofence badge */}
      {insideGeofence && (
        <Html position={[0, 1.35, 0]} center>
          <div style={{
            background: "#dc2626",
            color: "white",
            fontSize: "9px",
            fontWeight: 700,
            fontFamily: "monospace",
            padding: "1px 5px",
            borderRadius: "3px",
            whiteSpace: "nowrap",
            pointerEvents: "none",
            border: "1px solid #fca5a5",
          }}>
            ⚠ IN GEOFENCE
          </div>
        </Html>
      )}
    </group>
  );
};

// ── Scene ─────────────────────────────────────────────────────────────────────
const JunctionScene: React.FC = () => {
  const { ambulances, junctions, geofences } = useAppState();

  const activeAmbs = useMemo(
    () => ambulances.filter((a) => a.active).sort((a, b) => a.priority - b.priority),
    [ambulances]
  );

  const focusGeofence = geofences[0] ?? null;
  const signalRed = junctions.some((j) => j.signalStatus === "red");
  const geofenceTriggered = focusGeofence?.triggered ?? false;
  const numInside = activeAmbs.filter((a) => !!a.insideGeofenceId).length;

  // Per-ambulance local state: phase, pos, trail
  const [ambStates, setAmbStates] = useState<Record<string, {
    phase: AmbLocalState["phase"]; pos: THREE.Vector3; trail: THREE.Vector3[];
  }>>({});

  const handleStateChange = (
    id: string,
    phase: AmbLocalState["phase"],
    pos: THREE.Vector3,
    trail: THREE.Vector3[]
  ) => {
    setAmbStates((prev) => ({ ...prev, [id]: { phase, pos, trail } }));
  };

  // Assign approach arms deterministically (round-robin)
  const ambArms = useMemo(() => {
    const result: Record<string, string> = {};
    activeAmbs.forEach((amb, i) => {
      // Try to use real heading if available, otherwise round-robin
      const arm = amb.heading !== 0 ? headingToArm(amb.heading) : APPROACH_ARMS[i % APPROACH_ARMS.length];
      result[amb.id] = arm;
    });
    return result;
  }, [activeAmbs.map((a) => a.id).join(",")]);

  // Compute per-arm highlight state for roads
  const armHighlights = useMemo(() => {
    const result: Record<string, { color: string; isApproach: boolean; isExit: boolean }[]> = {
      north: [], south: [], east: [], west: [],
    };
    activeAmbs.forEach((amb, i) => {
      const arm = ambArms[amb.id] ?? APPROACH_ARMS[i % 4];
      const pal = AMB_COLORS[i % AMB_COLORS.length];
      const state = ambStates[amb.id];
      const phase = state?.phase ?? "approach";

      if (phase === "approach" || phase === "inside") {
        result[arm].push({ color: pal.trail, isApproach: true, isExit: false });
      }
      if (phase === "exit") {
        // get exit arm from state - derive from exitDirection
        let exitArm = oppositeArm(arm);
        if (amb.exitDirection === "left") {
          const leftMap: Record<string, string> = { north: "east", east: "south", south: "west", west: "north" };
          exitArm = leftMap[arm] ?? exitArm;
        } else if (amb.exitDirection === "right") {
          const rightMap: Record<string, string> = { north: "west", west: "south", south: "east", east: "north" };
          exitArm = rightMap[arm] ?? exitArm;
        }
        result[exitArm].push({ color: "#22c55e", isApproach: false, isExit: true });
      }
    });
    return result;
  }, [activeAmbs, ambArms, ambStates]);

  return (
    <>
      {/* Lights */}
      <ambientLight intensity={0.5} color="#b0c0e0" />
      <directionalLight position={[6, 10, 6]} intensity={0.6} color="#dde8ff" castShadow={false} />
      <pointLight position={[0, 4, 0]} intensity={0.35} color="#ffffff" distance={14} />

      <Ground />
      <LaneMarkings />

      {/* Road arms */}
      {(["north", "south", "east", "west"] as const).map((arm) => (
        <RoadArm key={arm} arm={arm} ambulancesOnArm={armHighlights[arm] ?? []} />
      ))}

      <JunctionCenter signalRed={signalRed} />
      <GeofenceRing triggered={geofenceTriggered} numInside={numInside} />
      <SignalPoles red={signalRed} />

      {/* Multi-ambulance geofence alert overlay */}
      {numInside >= 2 && (
        <Html position={[0, 3.5, 0]} center>
          <div style={{
            background: "rgba(127,29,29,0.92)",
            color: "#fca5a5",
            fontSize: "11px",
            fontWeight: 700,
            fontFamily: "monospace",
            padding: "4px 12px",
            borderRadius: "6px",
            border: "1px solid #ef4444",
            whiteSpace: "nowrap",
            pointerEvents: "none",
            boxShadow: "0 0 16px rgba(239,68,68,0.5)",
          }}>
            🚨 {numInside} AMBULANCES IN GEOFENCE — PRIORITY CLEARANCE
          </div>
        </Html>
      )}

      {/* Ambulances + trails */}
      {activeAmbs.map((amb, i) => {
        const arm = ambArms[amb.id] ?? APPROACH_ARMS[i % 4];
        const trail = ambStates[amb.id]?.trail ?? [];
        const pal = AMB_COLORS[i % AMB_COLORS.length];
        return (
          <React.Fragment key={amb.id}>
            <AmbulanceTrail points={trail} color={pal.trail} />
            <MovingAmb
              ambId={amb.id}
              driverName={amb.driverName}
              priority={amb.priority || i + 1}
              isFirst={amb.priority === 1 || i === 0}
              insideGeofence={!!amb.insideGeofenceId}
              exitDirection={amb.exitDirection}
              approachArm={arm}
              colorIdx={i}
              onStateChange={handleStateChange}
            />
          </React.Fragment>
        );
      })}

      {/* No ambulances hint */}
      {activeAmbs.length === 0 && (
        <Html center position={[0, 0.6, 0]}>
          <div style={{
            color: "hsl(215,12%,50%)",
            fontSize: "11px",
            fontFamily: "monospace",
            textAlign: "center",
            pointerEvents: "none",
          }}>
            No active ambulances.<br />Spawn one from the Admin panel.
          </div>
        </Html>
      )}
    </>
  );
};

// ── Exported wrapper ─────────────────────────────────────────────────────────
const JunctionScene3D: React.FC<{ className?: string }> = ({ className }) => (
  <div className={className} style={{ background: "hsl(220,20%,7%)" }}>
    <Canvas
      camera={{ position: [0, 10, 7], fov: 42 }}
      gl={{ antialias: true, powerPreference: "low-power" }}
      dpr={[1, 1.5]}
      frameloop="always"
    >
      <JunctionScene />
    </Canvas>
  </div>
);

export default JunctionScene3D;
