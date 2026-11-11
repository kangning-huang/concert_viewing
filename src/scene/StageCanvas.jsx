import { useCallback, useMemo, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { EffectComposer, Bloom, Vignette, ToneMapping } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import * as THREE from "three";
import { ProcBowl } from "./venue/ProcBowl.jsx";
import { tickAtmo } from "./atmo.js";
import { StandLights, FloorCrowd, NearSeats } from "./Crowd.jsx";
import { CameraRig } from "./CameraRig.jsx";
import { JokerXueStage, CUES } from "../stage/JokerXueStage.jsx";
import { TIERS, initialQuality, stepDown, fpsMonitor } from "../quality.js";

function Barriers({ bars }) {
  return bars.map(([x, z, w, d], i) => (
    <mesh key={i} position={[x, 0.65, z]}>
      <boxGeometry args={[w, 1.3, d]} />
      <meshStandardMaterial color="#060608" roughness={0.8} />
    </mesh>
  ));
}

function SeatMarker({ section, visible }) {
  if (!section || !visible) return null;
  return (
    <mesh position={[section.seat.x, section.seat.y - 1, section.seat.z]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[2.2, 3.4, 40]} />
      <meshBasicMaterial color={new THREE.Color("#6fffd2").multiplyScalar(2.5)} toneMapped={false} transparent opacity={0.9} side={THREE.DoubleSide} />
    </mesh>
  );
}

function Atmosphere({ cue }) {
  useFrame(({ clock }, dt) => tickAtmo(clock.elapsedTime, dt, CUES[cue]));
  return null;
}

function QualityWatch({ onDrop }) {
  const mon = useMemo(() => fpsMonitor(), []);
  useFrame((_, dt) => {
    const steps = mon.sample(dt * 1000);
    if (steps) onDrop(steps);
  });
  return null;
}

// HDR pipeline: scene → bloom on values above 1.0 only (LED walls, bulbs, lasers, light
// sticks are the only things that bright) → ACES filmic → vignette.
function Post({ tier }) {
  const q = TIERS[tier];
  if (q.post === "none") return null;
  return (
    <EffectComposer multisampling={0}>
      {q.bloom > 0 && <Bloom mipmapBlur intensity={q.bloom} luminanceThreshold={1} luminanceSmoothing={0.15} />}
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      {q.post === "full" && <Vignette eskil={false} offset={0.28} darkness={0.62} />}
    </EffectComposer>
  );
}

// ?raycheck exposes the R3F state so scripts/mascot_raycheck.mjs can ray-test the real meshes.
const exposeForRaycheck = (st) => {
  if (new URLSearchParams(window.location.search).has("raycheck")) window.__r3f = st;
};

const dprRange =(max) => ((typeof window < "u" ? window.innerWidth : 1024) < 720 ? [1, Math.min(max, 1.25)] : [1, max]);

export function StageCanvas({ venue, phase, section, cue, onArrived, onReturned }) {
  const [{ tier, adaptive }, setQ] = useState(initialQuality);
  const q = TIERS[tier];
  const onDrop = useCallback(
    (n) => {
      if (adaptive)
        setQ((cur) => {
          const next = stepDown(cur.tier, n);
          return next === cur.tier ? cur : { ...cur, tier: next };
        });
    },
    [adaptive]
  );
  const dpr = useMemo(() => dprRange(q.dpr), [q.dpr]);
  const glOpts = useMemo(() => ({ antialias: q.msaa > 0, powerPreference: "high-performance", toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 0.9 }), [q.msaa]);
  return (
    <Canvas className="stage-canvas" dpr={dpr} gl={glOpts} camera={{ position: [0, 300, 0.01], near: 0.15, far: 1600 }} onCreated={exposeForRaycheck}>
      <color attach="background" args={["#04050b"]} />
      <hemisphereLight args={["#6f7f9e", "#141018", 0.75]} />
      <directionalLight position={[60, 150, 40]} intensity={0.45} color="#9fb2d6" />
      <Atmosphere cue={cue} />
      <ProcBowl venue={venue} bowl={q.bowl} />
      <JokerXueStage cue={cue} quality={q.stage} />
      <StandLights venue={venue} density={q.crowd} />
      <NearSeats venue={venue} section={section} enabled={q.bowl !== "stub"} />
      <FloorCrowd sections={venue.sections} density={q.crowd} />
      <Barriers bars={venue.barriers} />
      <SeatMarker section={section} visible={phase === "flyin" || phase === "flyout"} />
      <CameraRig phase={phase} section={section} onArrived={onArrived} onReturned={onReturned} lookEnabled={phase === "pov"} />
      <Post tier={tier} />
      {adaptive && <QualityWatch onDrop={onDrop} />}
    </Canvas>
  );
}
