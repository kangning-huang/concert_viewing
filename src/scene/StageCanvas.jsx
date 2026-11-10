import { useCallback, useMemo, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";
import { Bowl } from "./venue/Bowl.jsx";
import { CameraRig } from "./CameraRig.jsx";
import { JokerXueStage, CUES } from "../stage/JokerXueStage.jsx";
import { TIERS, initialQuality, stepDown, fpsMonitor } from "../quality.js";

// Twinkling phone-light crowd in the stands.
function StandCrowd({ bands, tint, density = 1 }) {
  const { geo, mat } = useMemo(() => {
    const pos = [], seeds = [], d = Math.max(0.05, Math.min(1, density));
    for (const b of bands)
      for (let r = 0; r < b.rows; r++) {
        const f = r / b.rows, n = b.count(f);
        for (let i = 0; i < n; i++) {
          if (Math.random() < 0.14 || Math.random() > d) continue;
          const a = ((i + Math.random() * 0.5) / n) * Math.PI * 2;
          pos.push(...b.at(f, a));
          seeds.push(Math.random());
        }
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("aSeed", new THREE.Float32BufferAttribute(seeds, 1));
    const m = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uT: { value: 0 }, uTint: { value: new THREE.Color() } },
      vertexShader: `attribute float aSeed; uniform float uT; varying float vA; varying float vS;
        void main(){ vec4 mv = modelViewMatrix*vec4(position,1.); gl_Position = projectionMatrix*mv; vS = aSeed;
        vA = .35 + .65*pow(max(0.,.5+.5*sin(uT*(1.+aSeed*3.)+aSeed*40.)),3.); gl_PointSize = clamp(420./-mv.z,1.,5.); }`,
      fragmentShader: `uniform vec3 uTint; varying float vA; varying float vS;
        void main(){ float d = length(gl_PointCoord-.5); if(d>.5) discard; vec3 c = mix(uTint, vec3(1.), step(.9,vS)*.7); gl_FragColor = vec4(c*1.3, clamp(vA*(1.-d*2.),0.,1.)); }`,
    });
    return { geo: g, mat: m };
  }, [bands, density]);
  useFrame(({ clock }, dt) => {
    mat.uniforms.uT.value = clock.elapsedTime;
    mat.uniforms.uTint.value.lerp(new THREE.Color(tint), 1 - Math.exp(-dt * 3));
  });
  return <points geometry={geo} material={mat} />;
}

// Standing silhouettes on the floor sections (leaves a hole at the picked seat).
function FloorCrowd({ sections, density = 1 }) {
  const mesh = useMemo(() => {
    const floor = sections.filter((s) => s.kind === "floor"), spots = [], d = Math.max(0.05, Math.min(1, density));
    const dx = 0.72 / Math.sqrt(d), dz = 0.9 / Math.sqrt(d);
    for (const s of floor) {
      const xs = s.points.map((p) => p[0]), zs = s.points.map((p) => p[1]);
      const x0 = Math.min(...xs), x1 = Math.max(...xs), z0 = Math.min(...zs), z1 = Math.max(...zs);
      for (let x = x0 + 0.3; x < x1; x += dx)
        for (let z = z0 + 0.3; z < z1; z += dz) {
          if (Math.random() > d) continue;
          const px = x + (Math.random() - 0.5) * 0.28, pz = z + (Math.random() - 0.5) * 0.28;
          if (Math.hypot(px - s.seat.x, pz - s.seat.z) > 1.05) spots.push([px, pz]);
        }
    }
    const g = new THREE.CapsuleGeometry(0.21, 1.16, 3, 8);
    g.translate(0, 0.79, 0);
    const m = new THREE.InstancedMesh(g, new THREE.MeshBasicMaterial({ color: "#070609" }), Math.max(1, spots.length)), o = new THREE.Object3D();
    spots.forEach(([x, z], i) => {
      o.position.set(x, 0.05, z);
      o.scale.y = 0.93 + Math.random() * 0.2;
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    m.count = spots.length;
    return m;
  }, [sections, density]);
  return <primitive object={mesh} />;
}

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

function QualityWatch({ onDrop }) {
  const mon = useMemo(() => fpsMonitor(), []);
  useFrame((_, dt) => {
    const steps = mon.sample(dt * 1000);
    if (steps) onDrop(steps);
  });
  return null;
}

function Post({ tier }) {
  const q = TIERS[tier];
  if (q.post === "none") return null;
  return (
    <EffectComposer multisampling={0}>
      {(q.post === "full" || q.post === "bloom") && q.bloom > 0 && <Bloom mipmapBlur intensity={q.bloom} luminanceThreshold={0.82} luminanceSmoothing={0.2} />}
      {q.post === "full" && <Vignette eskil={false} offset={0.28} darkness={0.62} />}
    </EffectComposer>
  );
}

const dprRange = (max) => ((typeof window < "u" ? window.innerWidth : 1024) < 720 ? [1, Math.min(max, 1.25)] : [1, max]);

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
  const shadows = q.shadowMap > 0;
  return (
    <Canvas className="stage-canvas" dpr={dpr} gl={glOpts} shadows={shadows} camera={{ position: [0, 300, 0.01], near: 0.15, far: 1600 }}>
      <color attach="background" args={["#04050b"]} />
      <hemisphereLight args={["#6f7f9e", "#141018", 0.75]} />
      <directionalLight position={[60, 150, 40]} intensity={0.45} color="#9fb2d6" castShadow={shadows} shadow-mapSize-width={q.shadowMap || 1024} shadow-mapSize-height={q.shadowMap || 1024} />
      <Bowl venue={venue} bowl={q.bowl} />
      <JokerXueStage cue={cue} />
      <StandCrowd bands={venue.crowdBands} tint={CUES[cue].edge} density={q.crowd} />
      <FloorCrowd sections={venue.sections} density={q.crowd} />
      <Barriers bars={venue.barriers} />
      <SeatMarker section={section} visible={phase === "flyin" || phase === "flyout"} />
      <CameraRig phase={phase} section={section} onArrived={onArrived} onReturned={onReturned} lookEnabled={phase === "pov"} />
      <Post tier={tier} />
      {adaptive && <QualityWatch onDrop={onDrop} />}
    </Canvas>
  );
}
