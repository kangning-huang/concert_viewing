import { useCallback, useEffect, useMemo, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { EffectComposer, Bloom, Vignette, ToneMapping } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import * as THREE from "three";
import { ProcBowl } from "./venue/ProcBowl.jsx";
import { ATMO, tickAtmo } from "./atmo.js";
import { StandLights, FloorCrowd, NearSeats } from "./Crowd.jsx";
import { silhouetteAtlas } from "./silhouettes.js";
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

// Night sky: dark zenith, faint city glow at the horizon, show light scattered into the haze.
const SKY_FS = /* glsl */ `
uniform vec3 uCue; varying vec3 vDir;
void main(){
  vec3 d = normalize(vDir);
  float up = max(d.y, 0.);
  vec3 c = mix(vec3(.030,.022,.030), vec3(.004,.006,.014), pow(up,.45));
  c += uCue*.05*pow(1.-up, 3.);
  gl_FragColor = vec4(c,1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
function Atmosphere({ cue }) {
  const sky = useMemo(() => new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, uniforms: { uCue: ATMO.uCue }, vertexShader: "varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }", fragmentShader: SKY_FS }), []);
  useFrame(({ clock }, dt) => tickAtmo(clock.elapsedTime, dt, CUES[cue]));
  return (
    <mesh material={sky} renderOrder={-10} frustumCulled={false}>
      <sphereGeometry args={[1400, 24, 12]} />
    </mesh>
  );
}

// Warm-up: for the first few frames (hidden behind the 2D map) nothing is frustum-culled,
// so every shader program and buffer is created before the first fly-in can need it.
function Warmup({ frames = 4 }) {
  const scene = useThree((st) => st.scene);
  const left = useMemo(() => ({ n: frames, culled: null }), [frames]);
  useFrame(() => {
    if (left.n < 0) return;
    if (!left.culled) {
      left.culled = [];
      scene.traverse((o) => {
        if ((o.isMesh || o.isPoints || o.isLine || o.isSprite) && o.frustumCulled) left.culled.push(o), (o.frustumCulled = false);
      });
    }
    if (left.n-- === 0) left.culled.forEach((o) => (o.frustumCulled = true));
  });
  return null;
}

// Upload the crowd atlas as soon as it is decoded, so the first fly-in never waits for it.
function CrowdAtlas() {
  const gl = useThree((st) => st.gl);
  useEffect(() => {
    let live = true;
    silhouetteAtlas().userData.ready.then((t) => live && t && gl.initTexture(t));
    return () => {
      live = false;
    };
  }, [gl]);
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
    <EffectComposer multisampling={q.msaa}>
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

const dprRange = (max) => ((typeof window < "u" ? window.innerWidth : 1024) < 720 ? [1, Math.min(max, max >= 1.5 ? 1.5 : 1.25)] : [1, max]);

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
      <FloorCrowd venue={venue} density={q.crowd} />
      <Barriers bars={venue.barriers} />
      <SeatMarker section={section} visible={phase === "flyin" || phase === "flyout"} />
      <CameraRig phase={phase} section={section} onArrived={onArrived} onReturned={onReturned} lookEnabled={phase === "pov"} />
      <Post tier={tier} />
      <CrowdAtlas />
      <Warmup />
      {adaptive && <QualityWatch onDrop={onDrop} />}
    </Canvas>
  );
}
