// Shared stage kit "joker_xue_2026" — reconstructed 1:1 from the c941445 Pages
// bundle (assets/index-DIDaugcb.js). Constants are copied verbatim.
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import ledTitleUrl from "./led_title.jpg";
import ledFeedRedUrl from "./led_feed_red.jpg";
import { ATMO, atmoUniforms, GLSL_ATMO, GLSL_OUT } from "../scene/atmo.js";

export const DEFAULT_MOTIFS = { towers: true, building: true, whale: true, elephant: true, airship: true, giant: true, reeds: true };

export const CUES = {
  title: { label: "开场", led: "title", edge: "#27b9ff", light: "#4f8dff", laser: "#35d6ff", confetti: false, beam: "#bcd7ff", building: "#7fb4ff" },
  purple: { label: "漫天纸屑", led: "purple", edge: "#c77dff", light: "#a24dff", laser: "#d58bff", confetti: true, beam: "#d9a6ff", building: "#ffffff" },
  red: { label: "红色独白", led: "red", edge: "#ff2a1c", light: "#ff3524", laser: "#ff3a2a", confetti: false, beam: "#ffb09c", building: "#ff5a44" },
  blue: { label: "深蓝激光", led: "blue", edge: "#2b6bff", light: "#2c54ff", laser: "#2d5bff", confetti: false, beam: "#8aa7ff", building: "#5f8cff" },
};
export const CUE_ORDER = ["title", "purple", "red", "blue"];

const canvasTex = (w, h, draw) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
};
const lcg = (seed) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const SERIF = '"Songti SC","STSong","PingFang SC",serif';

function verticalText(ctx, cols, x, y, size, color) {
  ctx.fillStyle = color;
  ctx.font = `600 ${size}px ${SERIF}`;
  ctx.textAlign = "center";
  cols.forEach((col, ci) => [...col].forEach((ch, i) => ctx.fillText(ch, x - ci * size * 1.35, y + i * size * 1.15)));
}

const giantTex = () =>
  canvasTex(1024, 512, (g, w, h) => {
    const r = lcg(17);
    g.fillStyle = "#000";
    g.fillRect(0, 0, w, h);
    g.lineCap = "round";
    for (let i = 0; i < 240; i++) {
      g.strokeStyle = ["#ff8a1e", "#ffd34a", "#ff3b24", "#9dff6a"][Math.floor(r() * 4)];
      g.lineWidth = 0.8 + r() * 2.4;
      g.beginPath();
      let x = r() * w, y = r() * h;
      g.moveTo(x, y);
      for (let k = 0; k < 5; k++) {
        k % 2 ? (y += (r() - 0.5) * 120) : (x += (r() - 0.5) * 240);
        g.lineTo(x, y);
      }
      g.stroke();
    }
  });

const airshipTex = () =>
  canvasTex(1024, 512, (g, w, h) => {
    g.fillStyle = "#c7a877";
    g.fillRect(0, 0, w, h);
    g.strokeStyle = "rgba(75,45,20,.55)";
    g.lineWidth = 7;
    for (let i = 0; i < 9; i++) {
      g.beginPath();
      g.moveTo((i * w) / 8, 0);
      g.lineTo((i * w) / 8, h);
      g.stroke();
    }
    g.fillStyle = "#3a2a2a";
    g.font = 'italic 700 92px "Snell Roundhand","Times New Roman",serif';
    g.textAlign = "center";
    g.fillText("Joker Xue", w * 0.25, h * 0.56);
    g.fillText("Joker Xue", w * 0.75, h * 0.56);
  });

const trussTex = () => {
  const t = canvasTex(128, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.strokeStyle = "#fff";
    g.lineWidth = 7;
    g.strokeRect(3, 3, w - 6, h - 6);
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(w, h);
    g.moveTo(w, 0);
    g.lineTo(0, h);
    g.stroke();
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
};

const glowTex = () =>
  canvasTex(256, 256, (g, w) => {
    const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    gr.addColorStop(0, "rgba(255,255,255,1)");
    gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr;
    g.fillRect(0, 0, w, w);
  });

// Real Nest show photos on the screens. Screens were rectified out of XHS concert-goer
// photos (assets/refs/xhs/nest) by scripts/bake_led_textures.py into the shared kit
// folder public/stage/joker_xue_2026/led/<res>/. Phones load the 1024 set.
const LED_RES = typeof window !== "undefined" && window.innerWidth < 720 ? 1024 : 2048;
const LED_DIR = `${import.meta.env.BASE_URL}stage/joker_xue_2026/led/${LED_RES}/`;
// Kit photos are stored power-of-two (mips built once at upload; NPOT photos caused a
// one-off ~60 ms frame on first close-up). SRC = true aspect of each captured screen.
const SRC = { front: 2.7676, back: 2.7676, left: 1.5378, right: 1.5378, imag: 0.6002 };
const END_FACE = 9.8 / 13, LONG_FACE = 45 / 13, IMAG = 12 / 20;

// "object-fit: cover" for a texture on a plane of the given aspect (no stretching).
function coverFit(t, planeAspect, a = t.image.width / t.image.height) {
  if (a > planeAspect) {
    t.repeat.set(planeAspect / a, 1);
    t.offset.set((1 - planeAspect / a) / 2, 0);
  } else {
    t.repeat.set(1, a / planeAspect);
    t.offset.set(0, (1 - a / planeAspect) / 2);
  }
}

let ledCache;
export function useLedTextures() {
  if (ledCache) return ledCache;
  // ImageBitmapLoader: decode off the main thread into a CPU bitmap before upload.
  // (<img> WebP textures caused a one-off ~55-75 ms stall a few seconds after load.)
  const bitmaps = new THREE.ImageBitmapLoader().setOptions({ imageOrientation: "flipY", premultiplyAlpha: "none" });
  const loading = [];
  const photo = (url, planeAspect, srcAspect) => {
    const t = new THREE.Texture();
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    t.flipY = false;
    loading.push(
      new Promise((done) =>
        bitmaps.load(
          url,
          (bmp) => {
            t.image = bmp;
            t.needsUpdate = true;
            coverFit(t, planeAspect, srcAspect ?? bmp.width / bmp.height);
            done(t);
          },
          undefined,
          () => done(null)
        )
      )
    );
    return t;
  };
  // The two c941445 cue plates keep their original mapping (stretched over the end face),
  // but are now also decoded off-thread and uploaded up front: as lazy <img> textures they
  // cost a one-off ~75 ms frame at the first cue switch.
  const jpg = (url) => {
    const t = new THREE.Texture();
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    t.flipY = false;
    loading.push(new Promise((done) => bitmaps.load(url, (bmp) => { t.image = bmp; t.needsUpdate = true; done(t); }, undefined, () => done(null))));
    return t;
  };
  ledCache = {
    // cue plates on the LED volume's end faces
    title: jpg(ledTitleUrl), // c941445 plates, loaded exactly as before
    red: jpg(ledFeedRedUrl),
    purple: photo(`${LED_DIR}imag2.webp`, END_FACE, SRC.imag),
    blue: photo(`${LED_DIR}left.webp`, END_FACE, SRC.left),
    // LED volume long faces
    front: photo(`${LED_DIR}front.webp`, LONG_FACE, SRC.front),
    back: photo(`${LED_DIR}back.webp`, LONG_FACE, SRC.back),
    // the four IMAG towers
    imag: [1, 2, 3, 4].map((i) => photo(`${LED_DIR}imag${i}.webp`, IMAG, SRC.imag)),
  };
  ledCache.ready = Promise.all(loading);
  return ledCache;
}

// ---- inflatable / sculpted motifs -------------------------------------------------
const GREY = "#6f7274";
const Blob = ({ p, s, r = [0, 0, 0], color = GREY, rough = 0.62, metal = 0.05, children }) => (
  <mesh position={p} scale={s} rotation={r} castShadow={false}>
    <sphereGeometry args={[1, 32, 22]} />
    {children ?? <meshStandardMaterial color={color} roughness={rough} metalness={metal} />}
  </mesh>
);
const Tube = ({ pts, radius, color = GREY, rough = 0.6, metal = 0.05 }) => {
  const geo = useMemo(() => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p))), 40, radius, 14), [pts, radius]);
  return (
    <mesh geometry={geo}>
      <meshStandardMaterial color={color} roughness={rough} metalness={metal} />
    </mesh>
  );
};
const Plinth = ({ w = 13, d = 9, h = 3.2 }) => (
  <mesh position={[0, h / 2, 0]}>
    <boxGeometry args={[w, h, d]} />
    <meshStandardMaterial color="#0c0c10" roughness={0.9} />
  </mesh>
);

function Elephant({ plinth = true, ...props }) {
  const trunk = useMemo(() => [[6.3, 6.3, 0], [8, 5.7, 0], [9.4, 6.6, 0], [10.3, 8.8, 0], [11.7, 9.9, 0]], []);
  const tuskL = useMemo(() => [[6, 4.9, 0.9], [7.6, 4.2, 1.1], [9.1, 5, 1.1]], []);
  const tuskR = useMemo(() => [[6, 4.9, -0.9], [7.6, 4.2, -1.1], [9.1, 5, -1.1]], []);
  return (
    <group {...props}>
      {plinth && <Plinth w={16} d={9} />}
      <group position={[-1.5, plinth ? 3.2 : 0, 0]}>
        <Blob p={[0, 5.7, 0]} s={[5.5, 3.5, 3.2]} />
        <Blob p={[5, 6.8, 0]} s={[2.1, 2.2, 1.9]} />
        <Blob p={[4.2, 7, 2.7]} s={[1.7, 2.2, 0.25]} r={[0.25, 0.4, 0]} color="#7d8080" />
        <Blob p={[4.2, 7, -2.7]} s={[1.7, 2.2, 0.25]} r={[-0.25, -0.4, 0]} color="#7d8080" />
        {[[3.3, 1.5], [3.3, -1.5], [-3.3, 1.5], [-3.3, -1.5]].map(([x, z]) => (
          <mesh key={`${x}${z}`} position={[x, 1.8, z]}>
            <cylinderGeometry args={[1.05, 1.2, 3.8, 18]} />
            <meshStandardMaterial color={GREY} roughness={0.65} />
          </mesh>
        ))}
        <Tube pts={trunk} radius={0.56} />
        <Tube pts={tuskL} radius={0.16} color="#d8cfbd" />
        <Tube pts={tuskR} radius={0.16} color="#d8cfbd" />
      </group>
    </group>
  );
}

function Whale({ plinth = true, ...props }) {
  const geo = useMemo(() => {
    const prof = [[0.2, 0], [2.3, 0.5], [3.7, 2.4], [4.5, 5.5], [4.6, 9], [4.1, 12.5], [3, 15.5], [1.5, 17.7], [0.1, 18.6]];
    const pts = new THREE.SplineCurve(prof.map(([x, y]) => new THREE.Vector2(x, y))).getPoints(48);
    const g = new THREE.LatheGeometry(pts, 48);
    const pos = g.attributes.position, col = new Float32Array(pos.count * 3);
    const belly = new THREE.Color("#d9e2ea"), back = new THREE.Color("#1c4257"), c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), a = Math.atan2(x, z), edge = 1.25 + 0.2 * Math.sin(y * 1.7) + 0.1 * Math.sin(y * 5.1);
      c.copy(belly).lerp(back, THREE.MathUtils.smoothstep(Math.abs(a), edge - 0.22, edge + 0.22));
      col.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    g.computeVertexNormals();
    return g;
  }, []);
  return (
    <group {...props}>
      {plinth && <Plinth w={13} d={12} />}
      <group position={[0, plinth ? 3.2 : 0, 0]} rotation={[-0.12, 0, 0]}>
        <mesh geometry={geo}>
          <meshStandardMaterial vertexColors roughness={0.55} />
        </mesh>
        <Blob p={[4.8, 4.8, 1.4]} s={[3.8, 1, 0.5]} r={[0, -0.25, -0.75]} color="#d9e2ea" />
        <Blob p={[-4.8, 4.8, 1.4]} s={[3.8, 1, 0.5]} r={[0, 0.25, 0.75]} color="#d9e2ea" />
        <Blob p={[2.7, 0.9, -1.6]} s={[3, 1.3, 1.2]} r={[0, 0.3, -0.2]} color="#c6d2dc" />
        <Blob p={[-2.7, 0.9, -1.6]} s={[3, 1.3, 1.2]} r={[0, -0.3, 0.2]} color="#c6d2dc" />
      </group>
    </group>
  );
}

function Airship(props) {
  const map = useMemo(airshipTex, []);
  return (
    <group {...props}>
      <Blob p={[0, 0, 0]} s={[7.5, 2.8, 2.8]}>
        <meshStandardMaterial map={map} roughness={0.7} emissive="#4a3620" emissiveIntensity={0.55} />
      </Blob>
      {[-4.5, 0, 4.5].map((x) => (
        <mesh key={x} position={[x, 0, 0]} rotation={[0, Math.PI / 2, 0]} scale={[1, 1, 1]}>
          <torusGeometry args={[x === 0 ? 2.82 : 2.28, 0.05, 8, 40]} />
          <meshStandardMaterial color="#3b2b1c" />
        </mesh>
      ))}
      <mesh position={[0, -4.6, 0]}>
        <boxGeometry args={[3.2, 0.9, 1.8]} />
        <meshStandardMaterial color="#b98a44" emissive="#7a4d12" emissiveIntensity={0.9} />
      </mesh>
    </group>
  );
}

function Giant(props) {
  const em = useMemo(giantTex, []);
  const arm = useMemo(() => [[12, 3.2, 0.5], [17, 2.8, 2], [21, 3.8, 1.3], [22.3, 8.2, 0.6]], []);
  const legL = useMemo(() => [[-3, 3, 1.4], [-10, 3.2, 1.8], [-15, 2.1, 2]], []);
  const legR = useMemo(() => [[-3, 3, -1.4], [-10, 3.6, -1.6], [-15.5, 2.3, -1.8]], []);
  const skin = <meshStandardMaterial color="#6d6c68" roughness={0.5} metalness={0.45} emissiveMap={em} emissive="#ffffff" emissiveIntensity={1.6} />;
  return (
    <group {...props}>
      <Blob p={[4, 3.6, 0]} s={[8.5, 3.6, 4.4]}>{skin}</Blob>
      <Blob p={[-4.2, 3.2, 0]} s={[5, 3.1, 4]}>{skin}</Blob>
      <Blob p={[13.8, 3.3, 0]} s={[2.4, 2.3, 2.2]} color="#a3a29d" rough={0.32} metal={0.7} />
      <Tube pts={legL} radius={1.9} color="#8f8e88" rough={0.3} metal={0.75} />
      <Tube pts={legR} radius={1.9} color="#8f8e88" rough={0.3} metal={0.75} />
      <Tube pts={arm} radius={0.95} color="#b7b6b0" rough={0.26} metal={0.8} />
      <Blob p={[22.4, 9, 0.6]} s={[1.4, 1.4, 1.4]} color="#c4c3bd" rough={0.26} metal={0.8} />
      <group position={[21, 9.9, 0.6]}>
        <mesh position={[0, 0.5, 0]}>
          <boxGeometry args={[12, 1, 7]} />
          <meshStandardMaterial color="#0d0d12" metalness={0.5} roughness={0.5} />
        </mesh>
        <mesh position={[-3.6, 3.6, -2.9]}>
          <planeGeometry args={[1.8, 5.2]} />
          <meshBasicMaterial color={[2.6, 3.2, 4.6]} toneMapped={false} />
        </mesh>
        <mesh position={[0.5, 2, 0]}>
          <capsuleGeometry args={[0.26, 1.2, 6, 12]} />
          <meshStandardMaterial color="#d7c9aa" emissive="#c9b78e" emissiveIntensity={1.4} />
        </mesh>
      </group>
    </group>
  );
}

function Reeds({ count = 2600, x = 26, z0 = 19.2, z1 = 23.8, cueColor }) {
  const mesh = useMemo(() => {
    const g = new THREE.ConeGeometry(0.05, 1, 3);
    g.translate(0, 0.5, 0);
    const m = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({ color: "#7d9f4a", roughness: 0.8 }), count), o = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      const h = 1.1 + Math.random() * 1.2;
      o.position.set((Math.random() * 2 - 1) * x, 0, z0 + Math.random() * (z1 - z0));
      o.rotation.set((Math.random() - 0.5) * 0.35, Math.random() * 6, (Math.random() - 0.5) * 0.35);
      o.scale.set(1, h, 1);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    }
    return m;
  }, [count, x, z0, z1]);
  mesh.material.emissive.set(cueColor).multiplyScalar(0.1);
  return <primitive object={mesh} />;
}

// ---- light FX ---------------------------------------------------------------------
// "Volumetric" beams are open cones with an additive shader: brightness falls off along the
// throw, the silhouette is softened by the view angle (so no hard cone edges) and a slow
// noise band fakes haze drifting through the light. No ray-marching, two triangles per side.
const BEAM_VS = /* glsl */ `
varying float vY; varying float vEdge; varying vec3 vW;
void main(){ vY = uv.y; vec4 wp = modelMatrix*vec4(position,1.); vW = wp.xyz; vec4 mv = viewMatrix*wp;
  vEdge = abs(dot(normalize(normalMatrix*normal), normalize(-mv.xyz))); gl_Position = projectionMatrix*mv; }`;
const BEAM_FS = /* glsl */ `
uniform vec3 uColor; uniform float uStrength; uniform float uSoft; uniform float uT;
varying float vY; varying float vEdge; varying vec3 vW;
void main(){
  float a = pow(clamp(vY,0.,1.),2.2)*uStrength;
  a *= mix(1., smoothstep(0.,.6,vEdge), uSoft);
  a *= mix(1., .72+.28*sin(vW.y*.21 + vW.x*.13 - uT*.6)*sin(vW.z*.17 + uT*.35), uSoft);
  gl_FragColor = vec4(uColor*1.25, a);
}`;
const beamMat = (colorUniform, strength, soft) =>
  new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: { uColor: colorUniform, uStrength: { value: strength }, uSoft: { value: soft }, uT: ATMO.uT },
    vertexShader: BEAM_VS,
    fragmentShader: BEAM_FS,
  });
// Cue colours are damped in one place (FxColors) and shared by reference: a cue change
// never creates a material, so it can never trigger a shader compile.
const FX = { beam: { value: new THREE.Color(CUES.title.beam) }, laser: { value: new THREE.Color(CUES.title.laser) }, bulb: new THREE.Color(CUES.title.edge).multiplyScalar(4) };
const fxTmp = new THREE.Color();
function FxColors({ cue }) {
  useFrame((_, dt) => {
    const k = 1 - Math.exp(-dt * 5);
    FX.beam.value.lerp(fxTmp.set(cue.beam), k);
    FX.laser.value.lerp(fxTmp.set(cue.laser), k);
    FX.bulb.lerp(fxTmp.set(cue.edge).multiplyScalar(4), k);
  });
  return null;
}

function Beam({ origin, length, radius, material, sweep = 0, phase = 0, tilt = [0, 0] }) {
  const ref = useRef();
  const geo = useMemo(() => {
    const g = new THREE.ConeGeometry(radius, length, 20, 1, true);
    g.translate(0, -length / 2, 0);
    return g;
  }, [radius, length]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    ref.current.rotation.set(tilt[0] + Math.sin(t * 0.7 + phase) * sweep, 0, tilt[1] + Math.cos(t * 0.5 + phase) * sweep);
  });
  return (
    <group ref={ref} position={origin}>
      <mesh geometry={geo} material={material} />
    </group>
  );
}

// Moving-head wash beams fanning up from the roof rim (same count / throw as the old arch).
function RoofBeams({ points, fx = 1 }) {
  const mat = useMemo(() => beamMat(FX.beam, 0.13, 1), []);
  const step = fx >= 1 ? 3 : 6;
  return points
    .filter((_, i) => i % step === 0)
    .map((p, i) => <Beam key={i} origin={p} length={58} radius={7} material={mat} sweep={0.08} phase={i * 0.7} tilt={[Math.PI * (i % 2 ? 0.86 : 1.12), Math.sin(i * 1.7) * 0.45 + Math.PI * 0]} />);
}

function Lasers({ fx = 1 }) {
  const mat = useMemo(() => beamMat(FX.laser, 0.95, 0), []);
  const rigs = useMemo(
    () =>
      [...Array(18).keys()].map((k) => {
        const x = -26 + (k * 52) / 17;
        return { origin: [x, 3, 17.6 * (k % 2 ? 1 : -1)], phase: k * 1.3, tilt: [(k % 2 ? -1 : 1) * 1.15, (x / 26) * -0.7 + Math.PI] };
      }),
    []
  );
  return rigs.filter((_, i) => fx >= 1 || i % 2 === 0).map((r, i) => <Beam key={i} {...r} length={140} radius={0.16} material={mat} sweep={0.16} />);
}

function Confetti({ count = 7000, active }) {
  const ref = useRef();
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry(), pos = new Float32Array(count * 3), seed = new Float32Array(count * 4), col = new Float32Array(count * 3);
    const pal = ["#ff5d7a", "#ffd84d", "#6df2ff", "#a5ff72", "#ff9b3d", "#f5a3ff"].map((c) => new THREE.Color(c));
    for (let i = 0; i < count; i++) {
      pos.set([(Math.random() * 2 - 1) * 48, Math.random(), (Math.random() * 2 - 1) * 36], i * 3);
      seed.set([Math.random() * 6.28, 0.6 + Math.random() * 0.8, 3 + Math.random() * 5, Math.random() * 6.28], i * 4);
      const c = pal[i % pal.length];
      col.set([c.r * 1.6, c.g * 1.6, c.b * 1.6], i * 3);
    }
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 4));
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 25, 0), 120);
    return g;
  }, [count]);
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        vertexColors: true,
        uniforms: { uT: { value: 0 }, uOn: { value: 0 }, uH: { value: window.innerHeight } },
        vertexShader: `attribute vec4 aSeed; uniform float uT, uH; varying vec3 vC; varying float vF;
      void main(){ vC = color; float h = fract(position.y - uT*0.035*aSeed.y);
      vec3 p = vec3(position.x + sin(uT*0.6*aSeed.y+aSeed.x)*aSeed.z*.5, h*62., position.z + cos(uT*.5+aSeed.w)*aSeed.z*.5);
      vec4 mv = modelViewMatrix*vec4(p,1.); gl_Position = projectionMatrix*mv;
      vF = .55 + .45*sin(uT*5.*aSeed.y + aSeed.w);
      gl_PointSize = clamp(uH*.22*aSeed.y/-mv.z, 1.2, 26.); }`,
        fragmentShader: `uniform float uOn; varying vec3 vC; varying float vF;
      void main(){ vec2 q = abs(gl_PointCoord-.5); if(q.x>.5 || q.y>.28) discard; gl_FragColor = vec4(vC*vF, uOn); }`,
      }),
    []
  );
  useFrame(({ clock }, dt) => {
    const u = mat.uniforms;
    u.uT.value = clock.elapsedTime;
    u.uOn.value = THREE.MathUtils.damp(u.uOn.value, active ? 1 : 0, 2.2, dt);
    ref.current.visible = u.uOn.value > 0.01 || clock.elapsedTime < 1.2;
  });
  return <points ref={ref} geometry={geo} material={mat} />;
}

function Haze({ fx = 1 }) {
  const map = useMemo(glowTex, []);
  const mat = useMemo(() => new THREE.SpriteMaterial({ map, transparent: true, opacity: 0.055, depthWrite: false, blending: THREE.AdditiveBlending }), [map]);
  const low = useMemo(() => new THREE.SpriteMaterial({ map, transparent: true, opacity: 0.05, depthWrite: false, blending: THREE.AdditiveBlending }), [map]);
  const puffs = useMemo(() => {
    const r = lcg(5), n = fx >= 1 ? 16 : 8;
    return [...Array(n).keys()].map(() => ({ p: [(r() * 2 - 1) * 38, 6 + r() * 24, (r() * 2 - 1) * 28], s: 26 + r() * 26 }));
  }, [fx]);
  // low smoke hugging the deck edge (the real show runs heavy floor haze)
  const ground = useMemo(() => {
    const r = lcg(9), n = fx >= 1 ? 10 : 5;
    return [...Array(n).keys()].map((i) => ({ p: [Math.cos((i / n) * 6.283) * 26 + (r() - 0.5) * 8, 3.2 + r() * 1.5, Math.sin((i / n) * 6.283) * 15 + (r() - 0.5) * 6], s: [30 + r() * 14, 7 + r() * 3] }));
  }, [fx]);
  useFrame(() => {
    mat.color.copy(ATMO.uCue.value);
    low.color.copy(ATMO.uCue.value).lerp(fxTmp.set("#ffffff"), 0.35);
  });
  return (
    <>
      {puffs.map(({ p, s }, i) => <sprite key={i} position={p} scale={[s, s, 1]} material={mat} />)}
      {ground.map(({ p, s }, i) => <sprite key={`g${i}`} position={p} scale={[s[0], s[1], 1]} material={low} />)}
    </>
  );
}

function Bulbs({ points, size = 0.3 }) {
  const mesh = useMemo(() => {
    const m = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshBasicMaterial({ toneMapped: false }), points.length), o = new THREE.Object3D();
    points.forEach((p, i) => {
      o.position.set(...p);
      o.scale.setScalar(size);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    return m;
  }, [points, size]);
  useFrame(() => mesh.material.color.copy(FX.bulb));
  return <primitive object={mesh} />;
}

// ---- LED surfaces -------------------------------------------------------------------
// Photo on an LED wall: per-pixel diode mask and module seams up close (both fade out with
// distance, so no moiré), HDR gain so the wall glows through the bloom like a real screen.
const LED_VS = /* glsl */ `
uniform vec2 uRep; uniform vec2 uOff; varying vec2 vUv; varying vec2 vP; varying float vDist;
void main(){ vUv = uv*uRep + uOff; vP = uv; vec4 mv = modelViewMatrix*vec4(position,1.); vDist = length(mv.xyz); gl_Position = projectionMatrix*mv; }`;
const LED_FS = /* glsl */ `
${GLSL_ATMO}
uniform sampler2D uMap; uniform vec2 uSize; uniform float uGain;
varying vec2 vUv; varying vec2 vP; varying float vDist;
void main(){
  vec3 c = texture2D(uMap, vUv).rgb;
  vec2 px = vP*uSize/0.05;                         // 50 mm pixel pitch (drawn coarser than real)
  float fw = max(fwidth(px.x), fwidth(px.y));
  vec2 d = abs(fract(px)-.5);
  float diode = mix(1., 1.35*(1.-smoothstep(.28,.5,max(d.x,d.y))), 1.-smoothstep(.25,.7,fw));
  vec2 m = vP*uSize/1.0;                           // 1 m cabinets
  vec2 md = abs(fract(m)-.5);
  float seam = mix(1., 1.-.5*step(.485,max(md.x,md.y)), 1.-smoothstep(.02,.08,max(fwidth(m.x),fwidth(m.y))));
  c = c*uGain*diode*seam + vec3(.004);
  c = applyFog(c, vDist*.35);
  gl_FragColor = vec4(c,1.);
  ${GLSL_OUT}
}`;
function useLedMaterial(tex, w, h, gain = 1.7) {
  const mat = useMemo(
    () => new THREE.ShaderMaterial({ uniforms: atmoUniforms({ uMap: { value: null }, uRep: { value: new THREE.Vector2(1, 1) }, uOff: { value: new THREE.Vector2() }, uSize: { value: new THREE.Vector2(w, h) }, uGain: { value: gain } }), vertexShader: LED_VS, fragmentShader: LED_FS }),
    [w, h, gain]
  );
  // repeat/offset are filled in by coverFit when the photo arrives → share them by reference
  mat.uniforms.uMap.value = tex;
  mat.uniforms.uRep.value = tex.repeat;
  mat.uniforms.uOff.value = tex.offset;
  return mat;
}
function LedPlane({ tex, w, h, gain, ...props }) {
  const mat = useLedMaterial(tex, w, h, gain);
  return (
    <mesh {...props} material={mat}>
      <planeGeometry args={[w, h]} />
    </mesh>
  );
}

const hdr = (c, k) => new THREE.Color(c).multiplyScalar(k);
const BLACK = <meshStandardMaterial color="#070709" roughness={0.6} metalness={0.4} />;

function Truss({ size, position, map }) {
  const tex = useMemo(() => {
    const t = map.clone();
    t.repeat.set(Math.max(1, Math.round(Math.max(size[0], size[2]) / 2)), Math.max(1, Math.round(size[1] / 2)));
    t.needsUpdate = true;
    return t;
  }, [map, size]);
  return (
    <mesh position={position}>
      <boxGeometry args={size} />
      <meshStandardMaterial color="#23232b" map={tex} alphaMap={tex} alphaTest={0.4} side={THREE.DoubleSide} metalness={0.6} roughness={0.5} />
    </mesh>
  );
}

// Edge light strip whose colour follows the cue without re-creating materials.
function EdgeStrip(props) {
  const ref = useRef();
  useFrame(() => ref.current.color.copy(FX.bulb).multiplyScalar(1.1));
  return (
    <mesh {...props}>
      <boxGeometry args={props.size} />
      <meshBasicMaterial ref={ref} toneMapped={false} />
    </mesh>
  );
}

// Vertical IMAG tower (four around the stage): black monolith, portrait LED, truss spine.
function ScreenTower({ position, rotationY, plate, truss, w = 12, h = 18, base = 3 }) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <LedPlane tex={plate} w={w} h={h} gain={1.75} position={[0, base + h / 2, 0.05]} />
      <mesh position={[0, base + h / 2, -0.35]}>
        <boxGeometry args={[w + 0.5, h + 0.5, 0.6]} />
        {BLACK}
      </mesh>
      <mesh position={[0, base / 2, -0.35]}>
        <boxGeometry args={[w + 0.5, base, 0.9]} />
        {BLACK}
      </mesh>
      {[-1, 1].map((s) => (
        <EdgeStrip key={s} position={[(s * w) / 2 + s * 0.14, base + h / 2, 0.12]} size={[0.14, h, 0.14]} />
      ))}
      <Truss size={[w + 1.2, base + h + 1, 2]} position={[0, (base + h + 1) / 2, -1.7]} map={truss} />
    </group>
  );
}

// ---- roof canopy (the real 万兽之王 rig: a flat mother-grid slab on columns, wider than the
// LED box, lined with bulbs; lights, PA and the LED volume all hang from it) ---------------
const ROOF = { hw: 30, hd: 13.5, r: 5, y0: 30.4, y1: 32 };
function roundedRect(hw, hd, r, spacing) {
  const pts = [], corner = (cx, cz, a0) => {
    const n = Math.max(2, Math.round((r * Math.PI) / 2 / spacing));
    for (let i = 0; i <= n; i++) pts.push([cx + r * Math.cos(a0 + (i / n) * (Math.PI / 2)), cz + r * Math.sin(a0 + (i / n) * (Math.PI / 2))]);
  };
  const line = (x0, z0, x1, z1) => {
    const n = Math.max(1, Math.round(Math.hypot(x1 - x0, z1 - z0) / spacing));
    for (let i = 1; i < n; i++) pts.push([x0 + ((x1 - x0) * i) / n, z0 + ((z1 - z0) * i) / n]);
  };
  corner(hw - r, hd - r, 0);
  line(hw - r, hd, -hw + r, hd);
  corner(-hw + r, hd - r, Math.PI / 2);
  line(-hw, hd - r, -hw, -hd + r);
  corner(-hw + r, -hd + r, Math.PI);
  line(-hw + r, -hd, hw - r, -hd);
  corner(hw - r, -hd + r, Math.PI * 1.5);
  line(hw, -hd + r, hw, hd - r);
  return pts;
}

function RoofCanopy({ truss, detail = 1, fx = 1 }) {
  const { slab, rim, heads, headBodies, beamPts, grid } = useMemo(() => {
    const outline = roundedRect(ROOF.hw, ROOF.hd, ROOF.r, 1.2);
    const shape = new THREE.Shape(outline.map(([x, z]) => new THREE.Vector2(x, z)));
    const slab = new THREE.ExtrudeGeometry(shape, { depth: ROOF.y1 - ROOF.y0, bevelEnabled: false, curveSegments: 4 });
    slab.rotateX(Math.PI / 2); // shape (x, z) → world XZ, extruded downwards
    slab.translate(0, ROOF.y1, 0);
    const rim = roundedRect(ROOF.hw + 0.25, ROOF.hd + 0.25, ROOF.r + 0.25, detail >= 1 ? 1.25 : 2.5).map(([x, z]) => [x, ROOF.y0 + 0.15, z]);
    // moving heads under the overhang, between the LED box and the rim
    const ring = roundedRect(ROOF.hw - 2.6, ROOF.hd - 2.2, ROOF.r - 1.5, detail >= 1 ? 3.1 : 6.2);
    const heads = ring.map(([x, z]) => [x, ROOF.y0 - 2.15, z]), headBodies = ring.map(([x, z]) => [x, ROOF.y0 - 1.5, z]);
    const beamPts = roundedRect(ROOF.hw - 1, ROOF.hd - 1, ROOF.r, 2.1).map(([x, z]) => [x, ROOF.y1 + 0.2, z]);
    const grid = truss.clone();
    grid.repeat.set(30, 14);
    grid.needsUpdate = true;
    return { slab, rim, heads, headBodies, beamPts, grid };
  }, [truss, detail]);
  const bodies = useMemo(() => {
    const m = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.34, 0.42, 1.1, 8), new THREE.MeshStandardMaterial({ color: "#08080a", roughness: 0.5, metalness: 0.5 }), headBodies.length), o = new THREE.Object3D();
    headBodies.forEach((p, i) => {
      o.position.set(...p);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    return m;
  }, [headBodies]);
  return (
    <group name="roof-canopy">
      <mesh geometry={slab}>
        <meshStandardMaterial color="#0a0a0d" roughness={0.95} metalness={0} />
      </mesh>
      {/* mother grid: truss lattice under the slab */}
      <mesh position={[0, ROOF.y0 - 0.06, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[ROOF.hw * 2 - 1.5, ROOF.hd * 2 - 1.5]} />
        <meshStandardMaterial color="#2a2a33" map={grid} alphaMap={grid} alphaTest={0.4} metalness={0.6} roughness={0.5} side={THREE.DoubleSide} />
      </mesh>
      {/* perimeter + cross trusses the fixtures hang from */}
      {[ROOF.hd - 2.2, -(ROOF.hd - 2.2)].map((z) => <Truss key={z} size={[ROOF.hw * 2 - 8, 1.1, 1.1]} position={[0, ROOF.y0 - 0.7, z]} map={truss} />)}
      {[ROOF.hw - 2.6, -(ROOF.hw - 2.6)].map((x) => <Truss key={x} size={[1.1, 1.1, ROOF.hd * 2 - 8]} position={[x, ROOF.y0 - 0.7, 0]} map={truss} />)}
      <primitive object={bodies} />
      <Bulbs points={heads} size={0.24} />
      <Bulbs points={rim} size={0.3} />
      <RoofBeams points={beamPts} fx={fx} />
      {/* line-array PA hangs at the four corners, outside the LED faces */}
      {detail >= 1 &&
        [[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([sx, sz]) => (
          <group key={`${sx}${sz}`} position={[sx * (ROOF.hw - 3.6), ROOF.y0 - 1.2, sz * (ROOF.hd - 3)]} rotation={[0, Math.atan2(sx, sz), 0]}>
            {[...Array(9).keys()].map((i) => (
              <mesh key={i} position={[0, -0.7 * i - 0.4, 0.035 * i * i]} rotation={[0.045 * i, 0, 0]}>
                <boxGeometry args={[1.25, 0.62, 0.8]} />
                <meshStandardMaterial color="#0c0c0f" roughness={0.75} metalness={0.2} />
              </mesh>
            ))}
          </group>
        ))}
    </group>
  );
}

// Glossy show deck: dark, with a faint LED-floor grid and the wash pooling on it.
const DECK_FS = /* glsl */ `
${GLSL_ATMO}
varying vec3 vW; varying vec3 vN; varying float vDist;
void main(){
  vec3 base = vec3(.012,.013,.016);
  if (vN.y > .5) {
    vec2 g = vW.xz/1.0; vec2 d = abs(fract(g)-.5);
    float line = 1.-smoothstep(.0,.03,.5-max(d.x,d.y));
    float fade = 1.-smoothstep(.05,.3,max(fwidth(g.x),fwidth(g.y)));
    float pool = exp(-dot(vW.xz*vec2(1.,2.2),vW.xz*vec2(1.,2.2))/900.);
    vec3 refl = uCue*(.03+.30*pool) + uEdge*.02;
    // grazing-angle sheen: the LED box above mirrors in the deck when seen from low seats
    vec3 v = normalize(cameraPosition - vW);
    float fres = pow(1.-max(v.y,0.),4.);
    base += refl*(.3+1.6*fres) + line*fade*uEdge*.04;
  } else base += uCue*.02;
  base = applyFog(base, vDist);
  gl_FragColor = vec4(base,1.);
  ${GLSL_OUT}
}`;
const DECK_VS = /* glsl */ `
varying vec3 vW; varying vec3 vN; varying float vDist;
void main(){ vec4 wp = modelMatrix*vec4(position,1.); vW = wp.xyz; vN = normal; vec4 mv = viewMatrix*wp; vDist = length(mv.xyz); gl_Position = projectionMatrix*mv; }`;

// The singer at stage centre with two follow spots from the roof rim and a light pool.
const SPOT_WHITE = { value: new THREE.Color("#fff4e0") };
function Performer() {
  const map = useMemo(glowTex, []);
  const mat = useMemo(() => beamMat(SPOT_WHITE, 0.3, 1), []);
  const spots = useMemo(
    () =>
      [[-24, ROOF.y0 - 2, 10], [24, ROOF.y0 - 2, -10]].map((from) => {
        const a = new THREE.Vector3(...from), dir = new THREE.Vector3(0, 3.6, 0).sub(a), len = dir.length();
        const g = new THREE.ConeGeometry(1.5, len, 16, 1, true);
        g.translate(0, -len / 2, 0);
        return { g, p: from, q: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir.normalize()) };
      }),
    []
  );
  return (
    <group name="performer">
      <mesh position={[0, 3.35, 0]}>
        <capsuleGeometry args={[0.2, 1.25, 4, 10]} />
        <meshBasicMaterial color={[2.4, 2.2, 1.9]} toneMapped={false} />
      </mesh>
      <mesh position={[0, 2.43, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[9, 9]} />
        <meshBasicMaterial map={map} color={[1.1, 1.0, 0.85]} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>
      {spots.map(({ g, p, q }, i) => <mesh key={i} geometry={g} material={mat} position={p} quaternion={q} />)}
    </group>
  );
}

// Whale lies flat and swims: lathe axis (local +y, head) → world +x, belly (local +z) → down.
const WHALE_FLYING = new THREE.Euler().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, -1), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, -1, 0)));

// quality: { detail, fx } from the tier table (src/quality.js → TIERS[tier].stage)
export function JokerXueStage({ cue = "title", motifs = DEFAULT_MOTIFS, quality = { detail: 1, fx: 1 } }) {
  const c = CUES[cue];
  const tex = useLedTextures();
  const gl = useThree((st) => st.gl);
  // Upload every screen photo up front so cue switches / fly-in never hitch on a texture upload.
  useEffect(() => {
    let live = true;
    tex.ready.then((ts) => live && ts.forEach((t) => t && gl.initTexture(t)));
    return () => {
      live = false;
    };
  }, [gl, tex]);
  const truss = useMemo(trussTex, []);
  const plate = tex[c.led];
  const deckMat = useMemo(() => new THREE.ShaderMaterial({ uniforms: atmoUniforms(), vertexShader: DECK_VS, fragmentShader: DECK_FS }), []);
  const edgeBulbs = useMemo(() => {
    const out = [];
    for (let i = 0; i <= 74; i++) {
      const x = -27 + (i * 54) / 74;
      out.push([x, 2.6, 18.1], [x, 2.6, -18.1]);
    }
    for (let i = 1; i < 48; i++) {
      const z = -18.1 + (i * 36.2) / 48;
      out.push([28.6, 2.6, z], [-28.6, 2.6, z]);
    }
    return out;
  }, []);
  const lightRef = useRef();
  useFrame(() => lightRef.current?.children.forEach((l) => l.color.copy(ATMO.uCue.value)));

  return (
    <group name="joker-xue-stage">
      <FxColors cue={c} />
      <group ref={lightRef}>
        <pointLight position={[0, 40, 0]} intensity={7000} distance={260} decay={1.8} />
        <pointLight position={[-20, 14, 26]} intensity={700} distance={90} decay={1.8} />
        <pointLight position={[20, 14, -26]} intensity={700} distance={90} decay={1.8} />
      </group>
      <mesh position={[0, 1.2, 0]} material={deckMat}>
        <boxGeometry args={[57, 2.4, 36]} />
      </mesh>
      <Bulbs points={edgeBulbs} size={0.11} />
      <Performer />
      {motifs.building && (
        <group>
          {/* four black columns carry the roof; the LED volume hangs between them */}
          {[[-20, -6], [20, -6], [-20, 6], [20, 6]].map(([x, z]) => (
            <group key={`${x}${z}`}>
              <mesh position={[x, 8.3, z]}>
                <cylinderGeometry args={[0.85, 0.85, 11.8, 14]} />
                {BLACK}
              </mesh>
              <Truss size={[2.4, 12, 2.4]} position={[x, 8.4, z]} map={truss} />
            </group>
          ))}
          <mesh position={[0, 21, 0]}>
            <boxGeometry args={[46, 14, 16]} />
            <meshStandardMaterial color="#060609" />
          </mesh>
          <mesh position={[0, 29.2, 0]}>
            <boxGeometry args={[44, 2.4, 14]} />
            <meshStandardMaterial color="#060609" />
          </mesh>
          {/* long faces of the LED "building" volume: real Nest screen captures */}
          {[8.05, -8.05].map((z) => (
            <LedPlane key={z} tex={z > 0 ? tex.front : tex.back} w={45} h={13} position={[0, 21, z]} rotation={[0, z < 0 ? Math.PI : 0, 0]} />
          ))}
          {/* short end faces show the cue plate */}
          {[23.05, -23.05].map((x) => (
            <LedPlane key={x} tex={plate} w={9.8} h={13} gain={1.5} position={[x, 21, 0]} rotation={[0, x > 0 ? Math.PI / 2 : -Math.PI / 2, 0]} />
          ))}
          {/* LED underside glow on the deck */}
          <mesh position={[0, 13.96, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <planeGeometry args={[45, 15]} />
            <meshBasicMaterial color="#0d1018" />
          </mesh>
          <RoofCanopy truss={truss} detail={quality.detail} fx={quality.fx} />
        </group>
      )}
      {motifs.towers &&
        [[-33, 17, 1], [33, 17, 1], [-33, -17, 0], [33, -17, 0]].map(([x, z, front], i) => {
          const ry = Math.atan2(-Math.sign(x), front ? 1 : -1);
          return <ScreenTower key={i} position={[x, 0, z]} rotationY={ry} plate={tex.imag[i]} truss={truss} h={20} />;
        })}
      {/* Mascots fly ABOVE the roof canopy (y ≥ 44), outside every sight line (scripts/mascot_raycheck.mjs).
          The stage is 四面台 with seats on all sides, so nothing may stand on the field, the
          deck, the moat or the LED roof (the roof blocks cross-stage views of the far IMAG
          towers). Same kit and placement in both venues. */}
      {motifs.elephant && <Elephant name="mascot:elephant" plinth={false} position={[8, 44, 8]} scale={0.6} />}
      {motifs.whale && <Whale name="mascot:whale" plinth={false} position={[-12, 50, 3]} rotation={WHALE_FLYING} scale={0.75} />}
      {motifs.airship && <Airship name="mascot:airship" position={[14, 56, -4]} rotation={[0, -0.2, 0.05]} />}
      {motifs.giant && <Giant name="mascot:giant" position={[-4, 46, -12]} scale={0.5} />}
      {motifs.reeds && <Reeds cueColor={c.light} count={quality.detail >= 1 ? 2600 : 1300} />}
      <Lasers fx={quality.fx} />
      <Haze fx={quality.fx} />
      <Confetti active={c.confetti} count={quality.fx >= 1 ? 7000 : 3500} />
    </group>
  );
}
