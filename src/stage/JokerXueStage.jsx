// Shared stage kit "joker_xue_2026", rebuilt from the Xiaohongshu photos of the Beijing Nest
// shows (assets/refs/xhs/nest). docs/XHS_STAGE_MATCH.md is the photo checklist; dimensions
// live in ./kit.js. Photo file names in comments name the evidence for that part.
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import ledTitleUrl from "./led_title.jpg";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { ATMO, atmoUniforms, GLSL_ATMO, GLSL_OUT } from "../scene/atmo.js";
import { KIT, BOX_CY, imagRotY } from "./kit.js";

export const DEFAULT_MOTIFS = { towers: true, building: true, whale: true, elephant: true, airship: true, giant: true, reeds: true };

// Colours per cue are sampled from the photos: warm-white blinders and cool beams before the
// show (nest_526_0001, nest_226_0001), rainbow rim on the confetti song (nest_226_0005,
// nest_917_0005), deep red wash with white beams and red lasers (nest_山顶_0005,
// nest_226_0004), deep blue with a white sunburst (nest_517_0004, nest_皇帝位_0005).
// split = metres the lower LED band drops below the upper one: closed before the show
// (nest_526_0004), a narrow gap on the red song (nest_226_0011), a wide one later
// (nest_大对角_0003).
export const CUES = {
  title: { label: "开场", led: "title", edge: "#8fd0ff", rim: "#ffdcae", light: "#4f86ff", laser: "#6fd2ff", confetti: false, beam: "#dfe9ff", split: 0 },
  purple: { label: "漫天纸屑", led: "purple", edge: "#d88bff", rim: "#ffffff", rainbow: true, light: "#a650ff", laser: "#ff7ad9", confetti: true, beam: "#f0c8ff", split: 0 },
  red: { label: "红色独白", led: "red", edge: "#ff2a1c", rim: "#ff4a30", light: "#ff2318", laser: "#ff2a20", confetti: false, beam: "#fff0e8", split: 3.6 },
  blue: { label: "深蓝激光", led: "blue", edge: "#3f7bff", rim: "#bcd4ff", light: "#2148ff", laser: "#3b6bff", confetti: false, beam: "#eaf2ff", split: 6.4 },
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
      g.strokeStyle = ["#ffd98a", "#ffb84a", "#fff1c4", "#e8a23a"][Math.floor(r() * 4)];
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
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, "#b8862c");
    gr.addColorStop(0.5, "#f0cf7a");
    gr.addColorStop(1, "#b8862c");
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    g.strokeStyle = "rgba(70,40,12,.7)";
    g.lineWidth = 6;
    for (let i = 0; i < 17; i++) {
      g.beginPath();
      g.moveTo((i * w) / 16, 0);
      g.lineTo((i * w) / 16, h);
      g.stroke();
    }
    for (let j = 1; j < 8; j++) {
      g.beginPath();
      g.moveTo(0, (j * h) / 8);
      g.lineTo(w, (j * h) / 8);
      g.stroke();
    }
    g.fillStyle = "#f3d98e";
    g.fillRect(w * 0.06, h * 0.4, w * 0.38, h * 0.24);
    g.fillRect(w * 0.56, h * 0.4, w * 0.38, h * 0.24);
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
const END_FACE = KIT.box.d / KIT.box.h, LONG_FACE = KIT.box.w / KIT.box.h, IMAG = KIT.imag.w / KIT.imag.h;
const LOW_LONG = KIT.box.w / KIT.box.hLo, LOW_END = KIT.box.d / KIT.box.hLo;

// "object-fit: cover" (or "contain": the LED shader draws black outside 0..1) for a texture
// on a plane of the given aspect. No stretching either way.
function fit(t, planeAspect, a, contain) {
  if (a > planeAspect !== !!contain) {
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
  // one download, one texture per plane aspect it is shown on
  const photo = (url, srcAspect, ...planes) => {
    const ts = planes.map((pl) => {
      const t = new THREE.Texture();
      t.userData.contain = !!pl[1];
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 8;
      t.flipY = false;
      return t;
    });
    loading.push(
      new Promise((done) =>
        bitmaps.load(
          url,
          (bmp) => {
            ts.forEach((t, i) => {
              t.image = bmp;
              t.needsUpdate = true;
              const [aspect, contain] = [].concat(planes[i]);
              fit(t, aspect, srcAspect ?? bmp.width / bmp.height, contain);
            });
            done(ts);
          },
          undefined,
          () => done([])
        )
      )
    );
    return ts;
  };
  // Before the show every face carries the tour title on black (nest_526_0004, nest_917_0001).
  const [titleLong, titleEnd] = photo(ledTitleUrl, 0.75, [LONG_FACE, true], [END_FACE, true]);
  const [front] = photo(`${LED_DIR}front.webp`, SRC.front, LONG_FACE);
  const [back] = photo(`${LED_DIR}back.webp`, SRC.back, LONG_FACE);
  const [left] = photo(`${LED_DIR}left.webp`, SRC.left, END_FACE);
  const [right] = photo(`${LED_DIR}right.webp`, SRC.right, END_FACE);
  // lower band on the red song: its own white network graphic (nest_226_0011)
  const [netLong, netEnd] = photo(`${LED_DIR}net.webp`, 8.33, LOW_LONG, LOW_END);
  ledCache = {
    // per cue: [long face +z, long face -z, both end faces] (real Nest screen captures)
    faces: { title: [titleLong, titleLong, titleEnd], purple: [front, back, left], red: [back, back, right], blue: [front, front, left] },
    // per cue: own content for the lower band [long faces, end faces]; null = the face photo runs on
    lower: { red: [netLong, netEnd] },
    // the four IMAG towers
    imag: [1, 2, 3, 4].map((i) => photo(`${LED_DIR}imag${i}.webp`, SRC.imag, IMAG)[0]),
  };
  ledCache.ready = Promise.all(loading).then((l) => l.flat());
  return ledCache;
}

// ---- inflatable / sculpted motifs -------------------------------------------------
const GREY = "#55575b";
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

// Dark grey inflatable elephant: big ears, trunk curled up, pale tusks (nest_首场_0004).
function Elephant({ plinth = true, ...props }) {
  const trunk = useMemo(() => [[6.4, 6.6, 0], [8.1, 5.2, 0], [9.7, 5.5, 0], [10.4, 7.4, 0], [9.9, 9.1, 0], [8.8, 9.6, 0]], []);
  const tail = useMemo(() => [[-5.3, 6.6, 0], [-6.3, 5, 0], [-6.6, 2.6, 0]], []);
  const tuskL = useMemo(() => [[6, 4.9, 0.9], [7.6, 4.2, 1.1], [9.1, 5, 1.1]], []);
  const tuskR = useMemo(() => [[6, 4.9, -0.9], [7.6, 4.2, -1.1], [9.1, 5, -1.1]], []);
  return (
    <group {...props}>
      {plinth && <Plinth w={16} d={9} />}
      <group position={[-1.5, plinth ? 3.2 : 0, 0]}>
        <Blob p={[0, 5.7, 0]} s={[5.5, 3.5, 3.2]} />
        <Blob p={[5, 6.8, 0]} s={[2.1, 2.2, 1.9]} />
        <Blob p={[3.6, 6.4, 2.5]} s={[2, 2.9, 0.3]} r={[0.3, 0.55, 0.15]} color="#5f6165" />
        <Blob p={[3.6, 6.4, -2.5]} s={[2, 2.9, 0.3]} r={[-0.3, -0.55, 0.15]} color="#5f6165" />
        <Blob p={[-1.8, 6.6, 0]} s={[3.6, 3.1, 3]} />
        {[[3.3, 1.5], [3.3, -1.5], [-3.3, 1.5], [-3.3, -1.5]].map(([x, z]) => (
          <mesh key={`${x}${z}`} position={[x, 1.8, z]}>
            <cylinderGeometry args={[1.05, 1.2, 3.8, 18]} />
            <meshStandardMaterial color={GREY} roughness={0.65} />
          </mesh>
        ))}
        <Tube pts={trunk} radius={0.52} />
        <Tube pts={tail} radius={0.16} />
        <Tube pts={tuskL} radius={0.2} color="#efe6d6" />
        <Tube pts={tuskR} radius={0.2} color="#efe6d6" />
      </group>
    </group>
  );
}

// Pale grey humpback with a white pleated throat, long flippers, flukes
// (nest_皇帝位_0006, nest_731_0005, nest_317_0004).
function Whale({ plinth = true, ...props }) {
  const geo = useMemo(() => {
    const prof = [[0.2, 0], [2.3, 0.5], [3.7, 2.4], [4.5, 5.5], [4.6, 9], [4.1, 12.5], [3, 15.5], [1.5, 17.7], [0.1, 18.6]];
    const pts = new THREE.SplineCurve(prof.map(([x, y]) => new THREE.Vector2(x, y))).getPoints(48);
    const g = new THREE.LatheGeometry(pts, 48);
    const pos = g.attributes.position, col = new Float32Array(pos.count * 3);
    const belly = new THREE.Color("#eef0ee"), back = new THREE.Color("#7f8a90"), c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), a = Math.atan2(x, z), edge = 1.25 + 0.2 * Math.sin(y * 1.7) + 0.1 * Math.sin(y * 5.1);
      c.copy(belly).lerp(back, THREE.MathUtils.smoothstep(Math.abs(a), edge - 0.22, edge + 0.22));
      // throat pleats under the head
      if (Math.abs(a) < edge - 0.2 && y > 9 && Math.sin(a * 26) > 0.55) c.multiplyScalar(0.8);
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
        <Blob p={[6.2, 9.6, 1.2]} s={[4.6, 1, 0.35]} r={[0, -0.2, -0.55]} color="#dfe3e2" />
        <Blob p={[-6.2, 9.6, 1.2]} s={[4.6, 1, 0.35]} r={[0, 0.2, 0.55]} color="#dfe3e2" />
        <Blob p={[0, 9, -4.4]} s={[0.25, 1.3, 0.8]} color="#7f8a90" />
        <Blob p={[2.6, 0.3, 0]} s={[3, 1.5, 0.3]} r={[0, 0, -0.35]} color="#8d979c" />
        <Blob p={[-2.6, 0.3, 0]} s={[3, 1.5, 0.3]} r={[0, 0, 0.35]} color="#8d979c" />
      </group>
    </group>
  );
}

// Glowing golden "Joker Xue" blimp with ribs, fins and a railed basket
// (nest_大对角_0005, nest_全集视角_0008).
function Airship(props) {
  const map = useMemo(airshipTex, []);
  return (
    <group {...props}>
      <Blob p={[0, 0, 0]} s={[7.5, 2.8, 2.8]}>
        <meshStandardMaterial map={map} roughness={0.6} emissiveMap={map} emissive="#ffd9a0" emissiveIntensity={0.95} />
      </Blob>
      {[-4.5, 0, 4.5].map((x) => (
        <mesh key={x} position={[x, 0, 0]} rotation={[0, Math.PI / 2, 0]} scale={[1, 1, 1]}>
          <torusGeometry args={[x === 0 ? 2.82 : 2.28, 0.05, 8, 40]} />
          <meshStandardMaterial color="#3b2b1c" />
        </mesh>
      ))}
      {/* tail fins + railed basket on four lines */}
      <Blob p={[-6.9, 1.6, 0]} s={[1.5, 1.5, 0.12]} color="#a8782a" />
      <Blob p={[-6.9, -1.6, 0]} s={[1.5, 1.5, 0.12]} color="#a8782a" />
      <Blob p={[-6.9, 0, 1.6]} s={[1.5, 0.12, 1.5]} color="#a8782a" />
      <Blob p={[-6.9, 0, -1.6]} s={[1.5, 0.12, 1.5]} color="#a8782a" />
      <mesh position={[0, -4.7, 0]}>
        <cylinderGeometry args={[1.5, 1.2, 0.5, 20]} />
        <meshStandardMaterial color="#c9a04e" metalness={0.7} roughness={0.35} emissive="#7a4d12" emissiveIntensity={0.9} />
      </mesh>
      <mesh position={[0, -3.9, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.5, 0.06, 6, 24]} />
        <meshStandardMaterial color="#e0b860" metalness={0.8} roughness={0.3} emissive="#7a4d12" emissiveIntensity={0.9} />
      </mesh>
      {[[1.3, 0.6], [-1.3, 0.6], [1.3, -0.6], [-1.3, -0.6]].map(([x, z]) => (
        <mesh key={`${x}${z}`} position={[x, -3.4, z]}>
          <cylinderGeometry args={[0.03, 0.03, 2.2, 4]} />
          <meshStandardMaterial color="#3b2b1c" />
        </mesh>
      ))}
    </group>
  );
}

function Giant(props) {
  const em = useMemo(giantTex, []);
  const arm = useMemo(() => [[12, 3.2, 0.5], [17, 2.8, 2], [21, 3.8, 1.3], [22.3, 8.2, 0.6]], []);
  const legL = useMemo(() => [[-3, 3, 1.4], [-10, 3.2, 1.8], [-15, 2.1, 2]], []);
  const legR = useMemo(() => [[-3, 3, -1.4], [-10, 3.6, -1.6], [-15.5, 2.3, -1.8]], []);
  // reclining golden figure with filigree skin (unknown_全价位_0001, nest_皇帝位_0011)
  const skin = <meshStandardMaterial color="#b8893a" roughness={0.38} metalness={0.8} emissiveMap={em} emissive="#ffcf80" emissiveIntensity={1.1} />;
  return (
    <group {...props}>
      <Blob p={[4, 3.6, 0]} s={[8.5, 3.6, 4.4]}>{skin}</Blob>
      <Blob p={[-4.2, 3.2, 0]} s={[5, 3.1, 4]}>{skin}</Blob>
      <Blob p={[13.8, 3.3, 0]} s={[2.4, 2.3, 2.2]} color="#c9a04e" rough={0.32} metal={0.8} />
      <Tube pts={legL} radius={1.9} color="#b08a3c" rough={0.3} metal={0.8} />
      <Tube pts={legR} radius={1.9} color="#b08a3c" rough={0.3} metal={0.8} />
      <Tube pts={arm} radius={0.95} color="#d2aa58" rough={0.26} metal={0.85} />
      <Blob p={[22.4, 9, 0.6]} s={[1.4, 1.4, 1.4]} color="#d8b260" rough={0.26} metal={0.85} />
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

// ---- shared FX colours --------------------------------------------------------------
// Cue colours are damped in one place (FxColors) and shared by reference: a cue change
// never creates a material, so it can never trigger a shader compile.
const FX = {
  beam: { value: new THREE.Color(CUES.title.beam) },
  laser: { value: new THREE.Color(CUES.title.laser) },
  white: { value: new THREE.Color("#fff4e0") },
  bulb: new THREE.Color(CUES.title.edge).multiplyScalar(4), // LED strips / small lenses
  rim: new THREE.Color(CUES.title.rim).multiplyScalar(5), // blinders on the roof rim + runway edge
  rainbow: 0,
};
const fxTmp = new THREE.Color();
function FxColors({ cue }) {
  useFrame((_, dt) => {
    const k = 1 - Math.exp(-dt * 5);
    FX.beam.value.lerp(fxTmp.set(cue.beam), k);
    FX.laser.value.lerp(fxTmp.set(cue.laser), k);
    FX.bulb.lerp(fxTmp.set(cue.edge).multiplyScalar(4), k);
    FX.rim.lerp(fxTmp.set(cue.rim).multiplyScalar(5), k);
    FX.rainbow += ((cue.rainbow ? 1 : 0) - FX.rainbow) * k;
  });
  return null;
}

// ---- geometry helpers -----------------------------------------------------------------
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
const shapeOf = (pts) => new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)));
// flat slab from a plan outline (optionally with a hole), top at yTop, thickness h
function slabGeo(outer, yTop, h, hole) {
  const s = shapeOf(outer);
  if (hole) s.holes.push(new THREE.Path(hole.map(([x, z]) => new THREE.Vector2(x, -z))));
  const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false, curveSegments: 4 });
  g.rotateX(-Math.PI / 2); // shape (x, -z) → world XZ, extruded upwards
  g.translate(0, yTop - h, 0);
  return g;
}
// vertical strip following a closed plan outline; u runs in metres / cell
function loopStrip(pts, y0, y1, cell = 1) {
  const p = [], uv = [], nr = [];
  let u = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length], len = Math.hypot(b[0] - a[0], b[1] - a[1]), u1 = u + len / cell, v1 = (y1 - y0) / cell;
    const nx = (b[1] - a[1]) / len, nz = -(b[0] - a[0]) / len;
    p.push(a[0], y0, a[1], b[0], y0, b[1], b[0], y1, b[1], a[0], y0, a[1], b[0], y1, b[1], a[0], y1, a[1]);
    uv.push(u, 0, u1, 0, u1, v1, u, 0, u1, v1, u, v1);
    for (let k = 0; k < 6; k++) nr.push(nx, 0, nz);
    u = u1;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nr, 3));
  return g;
}
// many box trusses in one geometry; uv in metres / cell so one repeating lattice texture fits all
function trussBoxes(list, cell = 1.2) {
  return mergeGeometries(
    list.map(({ size: [w, h, d], pos }) => {
      const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv;
      const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
      for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) uv.setXY(f * 4 + k, (uv.getX(f * 4 + k) * dims[f][0]) / cell, (uv.getY(f * 4 + k) * dims[f][1]) / cell);
      g.translate(...pos);
      return g;
    })
  );
}
function Instances({ geometry, material, items }) {
  const mesh = useMemo(() => {
    const m = new THREE.InstancedMesh(geometry, material, items.length), o = new THREE.Object3D();
    items.forEach(({ p, r = [0, 0, 0], s = [1, 1, 1] }, i) => {
      o.position.set(...p);
      o.rotation.set(...r);
      o.scale.set(...s);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    m.computeBoundingSphere();
    return m;
  }, [geometry, material, items]);
  return <primitive object={mesh} />;
}

// ---- light FX ---------------------------------------------------------------------
// Every beam in the show is one instance of a camera-facing strip: narrow at the lamp, wider
// along the throw, soft across, with haze drifting through it. One draw call for all of them
// (roof-top sunburst, rim curtain, runway up-lights, lasers, follow spots).
const BEAM_VS = /* glsl */ `
attribute vec3 aO; attribute vec3 aD; attribute vec4 aP; attribute vec3 aK;
uniform float uT; varying vec2 vUv; varying float vKind; varying float vI; varying vec3 vW;
void main(){
  vec3 d = normalize(aD);
  vec3 s1 = normalize(cross(d, abs(d.y) > .9 ? vec3(1.,0.,0.) : vec3(0.,1.,0.))), s2 = cross(d, s1);
  float ph = aP.w;
  d = normalize(d + aK.z*(sin(uT*.55+ph)*s1 + cos(uT*.4+ph*1.7)*s2));
  vec3 p = aO + d*aP.x*uv.y;
  vec3 side = normalize(cross(d, cameraPosition - p));
  p += side*(uv.x-.5)*2.*mix(aP.y, aP.z, uv.y);
  vUv = uv; vKind = aK.x; vW = p;
  vI = aK.y*(.75+.25*sin(uT*1.3+ph*3.));
  gl_Position = projectionMatrix*viewMatrix*vec4(p,1.);
}`;
const BEAM_FS = /* glsl */ `
uniform vec3 uC0, uC1, uC2; uniform float uT; varying vec2 vUv; varying float vKind; varying float vI; varying vec3 vW;
void main(){
  float across = pow(clamp(1.-abs(vUv.x*2.-1.), 0., 1.), 1.6);
  float along = mix(1., .12, pow(clamp(vUv.y,0.,1.),.7))*smoothstep(0.,.02,vUv.y)*(1.-smoothstep(.85,1.,vUv.y));
  float haze = .7+.3*sin(vW.y*.23 + vW.x*.11 - uT*.5)*sin(vW.z*.19 + uT*.31);
  vec3 c = vKind < .5 ? uC0 : vKind < 1.5 ? uC1 : uC2;
  if (vKind > .5 && vKind < 1.5) haze = 1.;
  gl_FragColor = vec4(c*1.3, across*along*haze*vI);
}`;
function Beams({ fx = 1 }) {
  const mesh = useMemo(() => {
    const R = KIT.roof, G = KIT.ring, r = lcg(23), list = [];
    const add = (o, d, len, r0, r1, kind, I, sweep) => list.push({ o, d, len, r0, r1, kind, I, sweep, ph: r() * 6.28 });
    const outward = ([x, z], hw, hd) => {
      const dx = Math.max(0, Math.abs(x) - (hw - 6)) * Math.sign(x), dz = Math.max(0, Math.abs(z) - (hd - 6)) * Math.sign(z), l = Math.hypot(dx, dz) || 1;
      return [dx / l, dz / l];
    };
    const skip = fx >= 1 ? 1 : 2;
    // sunburst from the roof top up into the stadium roof (nest_517_0004, nest_226_0006)
    roundedRect(R.hw - 1.5, R.hd - 1.5, R.r, 7).forEach((p, i) => {
      if (i % skip) return;
      const [ox, oz] = outward(p, R.hw - 1.5, R.hd - 1.5), up = 0.35 + 0.55 * r();
      add([p[0], R.yTop, p[1]], [ox, up, oz], 95, 0.35, 2.4, 0, 0.2, 0.07);
    });
    // curtain of narrow beams from the roof rim down onto the runway and floor (nest_226_0002)
    roundedRect(R.hw - 0.6, R.hd - 0.6, R.r, 3.4).forEach((p, i) => {
      if (i % skip) return;
      const [ox, oz] = outward(p, R.hw, R.hd), spread = 0.25 + 0.5 * r();
      add([p[0], R.y0 - 0.4, p[1]], [ox * spread, -1, oz * spread], 30, 0.18, 1.2, 0, 0.2, 0.05);
    });
    // up-lights along the runway edge (nest_山顶_0005, nest_537_0008)
    roundedRect(G.hw - 0.4, G.hd - 0.4, G.r, 4.2).forEach((p, i) => {
      if (i % skip) return;
      const [ox, oz] = outward(p, G.hw, G.hd), lean = 0.25 + 0.9 * r();
      add([p[0], G.h + 0.3, p[1]], [ox * lean, 1, oz * lean], 52, 0.14, 1.0, 0, 0.26, 0.1);
    });
    // lasers from the roof corners and deck ends across the bowl (nest_226_0004, nest_537_0008)
    for (let k = 0; k < (fx >= 1 ? 28 : 14); k++) {
      const sx = k % 2 ? 1 : -1, sz = k % 4 < 2 ? 1 : -1, low = k % 3 === 0;
      const o = low ? [sx * (KIT.deck.hw - 1), KIT.deck.h + 0.4, sz * (KIT.deck.hd - 1)] : [sx * (R.hw - 2), R.y0 - 0.5, sz * (R.hd - 2)];
      add(o, [sx * (0.3 + r()), low ? 0.1 + r() * 0.5 : -0.05 - r() * 0.3, sz * (0.2 + r())], 170, 0.05, 0.09, 1, 0.85, 0.12);
    }
    // two follow spots on the singer
    for (const from of [[-24, R.y0 - 1, 15], [24, R.y0 - 1, -15]]) {
      const d = [0 - from[0], KIT.deck.h + 1 - from[1], 0 - from[2]];
      add(from, d, Math.hypot(...d), 0.25, 1.1, 2, 0.5, 0);
    }
    const g = new THREE.PlaneGeometry(1, 1);
    g.translate(0, 0.5, 0);
    const n = list.length, aO = new Float32Array(n * 3), aD = new Float32Array(n * 3), aP = new Float32Array(n * 4), aK = new Float32Array(n * 3);
    list.forEach((b, i) => {
      aO.set(b.o, i * 3);
      aD.set(b.d, i * 3);
      aP.set([b.len, b.r0, b.r1, b.ph], i * 4);
      aK.set([b.kind, b.I, b.sweep], i * 3);
    });
    const ig = new THREE.InstancedBufferGeometry();
    ig.index = g.index;
    ig.setAttribute("position", g.attributes.position);
    ig.setAttribute("uv", g.attributes.uv);
    ig.setAttribute("aO", new THREE.InstancedBufferAttribute(aO, 3));
    ig.setAttribute("aD", new THREE.InstancedBufferAttribute(aD, 3));
    ig.setAttribute("aP", new THREE.InstancedBufferAttribute(aP, 4));
    ig.setAttribute("aK", new THREE.InstancedBufferAttribute(aK, 3));
    ig.instanceCount = n;
    const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: { uC0: FX.beam, uC1: FX.laser, uC2: FX.white, uT: ATMO.uT }, vertexShader: BEAM_VS, fragmentShader: BEAM_FS });
    const m = new THREE.Mesh(ig, mat);
    m.frustumCulled = false;
    m.renderOrder = 5;
    return m;
  }, [fx]);
  return <primitive object={mesh} />;
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

// Heavy show haze: big soft puffs in the air that take the wash colour, plus low smoke
// rolling off the runway (nest_226_0002, nest_517_0007, nest_山顶_0006).
function Haze({ fx = 1 }) {
  const map = useMemo(glowTex, []);
  const mat = useMemo(() => new THREE.SpriteMaterial({ map, transparent: true, opacity: 0.045, depthWrite: false, blending: THREE.AdditiveBlending }), [map]);
  const low = useMemo(() => new THREE.SpriteMaterial({ map, transparent: true, opacity: 0.06, depthWrite: false, blending: THREE.AdditiveBlending }), [map]);
  const puffs = useMemo(() => {
    const r = lcg(5), n = fx >= 1 ? 18 : 8;
    return [...Array(n).keys()].map(() => ({ p: [(r() * 2 - 1) * 46, 5 + r() * 30, (r() * 2 - 1) * 32], s: 28 + r() * 30 }));
  }, [fx]);
  const ground = useMemo(() => {
    const r = lcg(9), n = fx >= 1 ? 14 : 6;
    return [...Array(n).keys()].map((i) => ({ p: [Math.cos((i / n) * 6.283) * 30 + (r() - 0.5) * 8, 2.6 + r() * 2.5, Math.sin((i / n) * 6.283) * 19 + (r() - 0.5) * 6], s: [26 + r() * 16, 7 + r() * 5] }));
  }, [fx]);
  useFrame(() => {
    mat.color.copy(ATMO.uCue.value).lerp(fxTmp.set("#ffffff"), 0.15);
    low.color.copy(ATMO.uCue.value).lerp(fxTmp.set("#ffffff"), 0.45);
  });
  return (
    <>
      {puffs.map(({ p, s }, i) => <sprite key={i} position={p} scale={[s, s, 1]} material={mat} />)}
      {ground.map(({ p, s }, i) => <sprite key={`g${i}`} position={p} scale={[s[0], s[1], 1]} material={low} />)}
    </>
  );
}

// Lamp lenses. kind "rim" = big warm blinders (turn rainbow on the confetti cue, as in
// nest_226_0005 / nest_917_0005), kind "bulb" = small cue-coloured lenses.
function Bulbs({ points, size = 0.3, kind = "bulb" }) {
  const mesh = useMemo(() => {
    const m = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshBasicMaterial({ toneMapped: false }), points.length), o = new THREE.Object3D();
    points.forEach((p, i) => {
      o.position.set(...p);
      o.scale.setScalar(size);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
      m.setColorAt(i, fxTmp.set("#ffffff"));
    });
    m.userData.w = 0;
    return m;
  }, [points, size]);
  useFrame(() => {
    mesh.material.color.copy(kind === "rim" ? FX.rim : FX.bulb);
    if (kind !== "rim") return;
    const w = FX.rainbow;
    if (Math.abs(w - mesh.userData.w) < 0.004) return;
    mesh.userData.w = w;
    for (let i = 0; i < points.length; i++) mesh.setColorAt(i, fxTmp.setHSL((i * 0.071) % 1, 0.95, 0.5).lerp(WHITE, 1 - w));
    mesh.instanceColor.needsUpdate = true;
  });
  return <primitive object={mesh} />;
}
const WHITE = new THREE.Color("#ffffff");

// ---- LED surfaces -------------------------------------------------------------------
// Photo on an LED wall. What the photos show and the shader draws:
//   - a see-through mesh: where the content is dark you look through the slats at the towers
//     and the lights behind (nest_226_0008, nest_大对角_0006); bright content hides them,
//   - the module grid: 1.0 x 0.5 m cabinets and the heavier 4 x 2.4 m frame behind them
//     (nest_226_0008, nest_526_0004); both fade to their mean with distance, so no moiré,
//   - per-pixel diodes up close, a thin lit bezel around each band (nest_537_0006),
//   - HDR gain so bright content glows through the bloom and dark content does not.
const LED_VS = /* glsl */ `
uniform vec2 uRep; uniform vec2 uOff; uniform vec2 uBand; varying vec2 vUv; varying vec2 vP; varying float vDist;
void main(){ vUv = vec2(uv.x, uBand.x + uv.y*uBand.y)*uRep + uOff; vP = uv; vec4 mv = modelViewMatrix*vec4(position,1.); vDist = length(mv.xyz); gl_Position = projectionMatrix*mv; }`;
const LED_FS = /* glsl */ `
${GLSL_ATMO}
uniform sampler2D uMap; uniform vec2 uSize; uniform float uGain; uniform float uBezel; uniform float uFade; uniform float uOpen;
varying vec2 vUv; varying vec2 vP; varying float vDist;
float gridLine(vec2 g, float w){ vec2 d = abs(fract(g)-.5); vec2 fw = fwidth(g); vec2 l = smoothstep(.5-w-fw, .5-w+fw, d); return max(l.x, l.y)*(1.-smoothstep(.15,.5,max(fw.x,fw.y))); }
void main(){
  vec3 tex = texture2D(uMap, vUv).rgb;
  // "contain" plates (the title card) melt into the black wall instead of ending in a box
  tex *= mix(1., smoothstep(0.,.22,vUv.x)*smoothstep(1.,.78,vUv.x), uFade);
  vec2 m = vP*uSize;
  float cab = gridLine(m/vec2(1.,.5), .035);         // 1.0 x 0.5 m cabinets (nest_526_0004)
  float frame = gridLine(m/vec2(4.,2.4), .012);      // carrying frame, reads from far away
  float slatG = m.y/.1;                              // 10 cm slats, 45 % open
  float slatFw = fwidth(slatG);
  float slat = mix(.55, step(.45, fract(slatG)), 1.-smoothstep(.25,.7,slatFw));
  if (!gl_FrontFacing) {
    // back of the wall, seen through the opposite face: dark slats, a little light spill
    float a = uOpen > 0. ? max(max(cab, frame), slat*.85) : 1.;
    gl_FragColor = vec4(applyFog(vec3(.008,.008,.01) + tex*.035, vDist*.35), a);
  } else {
    vec2 px = m/0.05;                                // 50 mm pixel pitch (drawn coarser than real)
    float fw = max(fwidth(px.x), fwidth(px.y));
    vec2 d = abs(fract(px)-.5);
    float diode = mix(1., 1.35*(1.-smoothstep(.28,.5,max(d.x,d.y))), 1.-smoothstep(.25,.7,fw));
    float seam = 1. - .6*cab - .35*frame;
    vec3 c = tex*uGain*diode*seam + vec3(.006,.006,.007)*seam;
    vec2 e = min(vP, 1.-vP)*uSize;
    float bezel = 1.-smoothstep(.06,.16,min(e.x,e.y));
    c += uBezel*bezel*vec3(1.5,1.55,1.7);
    // lit pixels hide what is behind them; dark ones leave the mesh open
    float lit = smoothstep(.02,.22, max(tex.r, max(tex.g, tex.b)));
    float a = 1. - uOpen*(1.-lit)*(1.-slat)*(1.-max(cab,frame))*(1.-bezel);
    gl_FragColor = vec4(applyFog(c, vDist*.35), a);
  }
  ${GLSL_OUT}
}`;
const FULL_BAND = new THREE.Vector2(0, 1);
function useLedMaterial(tex, w, h, gain = 1.7, bezel = 1, open = 0, band = FULL_BAND) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: open > 0,
        side: open > 0 ? THREE.DoubleSide : THREE.FrontSide,
        uniforms: atmoUniforms({ uMap: { value: null }, uRep: { value: new THREE.Vector2(1, 1) }, uOff: { value: new THREE.Vector2() }, uBand: { value: band }, uSize: { value: new THREE.Vector2(w, h) }, uGain: { value: gain }, uBezel: { value: bezel }, uFade: { value: 0 }, uOpen: { value: open } }),
        vertexShader: LED_VS,
        fragmentShader: LED_FS,
      }),
    [w, h, gain, bezel, open, band]
  );
  // repeat/offset are filled in by coverFit when the photo arrives → share them by reference
  mat.uniforms.uMap.value = tex;
  mat.uniforms.uFade.value = tex.userData.contain ? 1 : 0;
  mat.uniforms.uRep.value = tex.repeat;
  mat.uniforms.uOff.value = tex.offset;
  return mat;
}
function LedPlane({ tex, w, h, gain, bezel, open, band, ...props }) {
  const mat = useLedMaterial(tex, w, h, gain, bezel, open, band);
  return (
    <mesh {...props} material={mat}>
      <planeGeometry args={[w, h]} />
    </mesh>
  );
}

// The four-sided LED volume as two bands. The upper band hangs under the roof; the lower band
// rides down by cue.split metres and opens a gap (nest_226_0011, nest_大对角_0003). Closed, one
// photo runs across both bands; a cue may give the lower band its own content.
const LED_OPEN = 0.9;
function LedVolume({ faces, lower, split, trussMat }) {
  const B = KIT.box, hUp = B.h - B.hLo, k = B.hLo / B.h;
  const bands = useMemo(() => ({ up: new THREE.Vector2(k, 1 - k), lo: new THREE.Vector2(0, k) }), [k]);
  const [faceF, faceB, faceE] = faces;
  const sides = [
    { key: "f", tex: faceF, low: lower?.[0], w: B.w, gain: 1.7, pos: [0, 0, B.d / 2 + 0.03], ry: 0 },
    { key: "b", tex: faceB, low: lower?.[0], w: B.w, gain: 1.7, pos: [0, 0, -B.d / 2 - 0.03], ry: Math.PI },
    { key: "e", tex: faceE, low: lower?.[1], w: B.d, gain: 1.5, pos: [B.w / 2 + 0.03, 0, 0], ry: Math.PI / 2 },
    { key: "w", tex: faceE, low: lower?.[1], w: B.d, gain: 1.5, pos: [-B.w / 2 - 0.03, 0, 0], ry: -Math.PI / 2 },
  ];
  // slim carrying frames on the band edges (visible in the gap, nest_226_0008)
  const frames = useMemo(() => {
    const ring = (y) => [
      { size: [B.w, 0.45, 0.45], pos: [0, y, B.d / 2 - 0.3] },
      { size: [B.w, 0.45, 0.45], pos: [0, y, -B.d / 2 + 0.3] },
      { size: [0.45, 0.45, B.d], pos: [B.w / 2 - 0.3, y, 0] },
      { size: [0.45, 0.45, B.d], pos: [-B.w / 2 + 0.3, y, 0] },
    ];
    return { up: trussBoxes(ring(-hUp / 2 + 0.25), 0.45), lo: trussBoxes([...ring(B.hLo / 2 - 0.25), ...ring(-B.hLo / 2 + 0.25)], 0.45) };
  }, [B, hUp]);
  const lo = useRef();
  const yLo = B.y0 + B.hLo / 2;
  useFrame((_, dt) => {
    if (lo.current) lo.current.position.y = THREE.MathUtils.damp(lo.current.position.y, yLo - split, 1.6, dt);
  });
  return (
    <group name="led-volume">
      <group position={[0, B.y0 + B.hLo + hUp / 2, 0]}>
        <mesh geometry={frames.up} material={trussMat} />
        {sides.map((s) => (
          <LedPlane key={s.key} tex={s.tex} w={s.w} h={hUp} gain={s.gain} open={LED_OPEN} band={bands.up} position={s.pos} rotation={[0, s.ry, 0]} />
        ))}
      </group>
      <group ref={lo} position={[0, yLo, 0]}>
        <mesh geometry={frames.lo} material={trussMat} />
        {sides.map((s) => (
          <LedPlane key={s.key} tex={s.low ?? s.tex} w={s.w} h={B.hLo} gain={s.gain} open={LED_OPEN} band={s.low ? FULL_BAND : bands.lo} position={s.pos} rotation={[0, s.ry, 0]} />
        ))}
      </group>
    </group>
  );
}

const BLACK = <meshStandardMaterial color="#070709" roughness={0.6} metalness={0.4} />;
const useTrussMat = (map) => useMemo(() => new THREE.MeshStandardMaterial({ color: "#2a2b33", map, alphaMap: map, alphaTest: 0.4, side: THREE.DoubleSide, metalness: 0.6, roughness: 0.45 }), [map]);

// Edge light strip whose colour follows the cue without re-creating materials.
function EdgeStrip({ size, geometry, gain = 1.1, ...props }) {
  const ref = useRef();
  useFrame(() => ref.current.color.copy(FX.bulb).multiplyScalar(gain));
  return (
    <mesh {...props} geometry={geometry}>
      {!geometry && <boxGeometry args={size} />}
      <meshBasicMaterial ref={ref} toneMapped={false} side={THREE.DoubleSide} />
    </mesh>
  );
}

// IMAG tower (nest_526_0001, nest_718_0001, nest_大对角_0003): a deep black scaffold box at a
// field corner, a portrait LED on both faces, a light strip down each screen edge.
function ScreenTower({ position, rotationY, plate, trussMat }) {
  const { w, h, base, depth } = KIT.imag;
  const scaffold = useMemo(() => trussBoxes([{ size: [w + 1.4, base + h + 0.8, depth], pos: [0, (base + h + 0.8) / 2, 0] }], 1.5), [w, h, base, depth]);
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh geometry={scaffold} material={trussMat} />
      {[1, -1].map((s) => (
        <group key={s} rotation={[0, s > 0 ? 0 : Math.PI, 0]}>
          <LedPlane tex={plate} w={w} h={h} gain={1.75} bezel={0} position={[0, base + h / 2, depth / 2 + 0.12]} />
          <mesh position={[0, base + h / 2, depth / 2 - 0.1]}>
            <boxGeometry args={[w + 0.5, h + 0.5, 0.4]} />
            {BLACK}
          </mesh>
          {[-1, 1].map((e) => (
            <EdgeStrip key={e} position={[(e * w) / 2 + e * 0.22, base + h / 2, depth / 2 + 0.16]} size={[0.2, h, 0.12]} />
          ))}
        </group>
      ))}
      {/* black drape + flight cases at the foot */}
      <mesh position={[0, base / 2, 0]}>
        <boxGeometry args={[w + 1.6, base, depth + 0.6]} />
        <meshStandardMaterial color="#050506" roughness={0.9} />
      </mesh>
    </group>
  );
}

// ---- roof canopy --------------------------------------------------------------------
// The real rig (nest_526_0004, nest_首场_0001, nest_大对角_0006): an open mother-grid of
// truss, much wider than the LED volume, rounded corners; a deep rim carrying a row of
// blinders between two LED strip lines; hundreds of fixtures under it; a dark cover on top.
function RoofCanopy({ trussMat, truss, detail = 1 }) {
  const R = KIT.roof;
  const parts = useMemo(() => {
    const outline = roundedRect(R.hw, R.hd, R.r, 1.2);
    const fascia = loopStrip(outline, R.y0, R.y1, 1.2);
    const stripLo = loopStrip(roundedRect(R.hw + 0.08, R.hd + 0.08, R.r + 0.08, 1.2), R.y0 + 0.1, R.y0 + 0.28);
    const stripHi = loopStrip(roundedRect(R.hw + 0.08, R.hd + 0.08, R.r + 0.08, 1.2), R.y1 - 0.28, R.y1 - 0.1);
    const cover = slabGeo(roundedRect(R.hw - 0.3, R.hd - 0.3, R.r, 1.2), R.yTop, R.yTop - R.y1 - 0.05);
    const grid = truss.clone();
    grid.repeat.set((R.hw * 2) / 2.4, (R.hd * 2) / 2.4);
    grid.needsUpdate = true;
    // long + cross trusses the fixtures hang from
    const boxes = [];
    for (const z of [-R.hd + 1.6, -R.hd + 4.6, R.hd - 4.6, R.hd - 1.6]) boxes.push({ size: [R.hw * 2 - 9, 1.2, 1.2], pos: [0, R.y0 - 0.6, z] });
    for (let i = -3; i <= 3; i++) boxes.push({ size: [1.2, 1.2, R.hd * 2 - 5], pos: [i * 7.4, R.y0 - 0.6, 0] });
    const B = KIT.box;
    // blinders on the rim, between the two strip lines
    const rim = roundedRect(R.hw + 0.3, R.hd + 0.3, R.r + 0.3, detail >= 1 ? 1.7 : 3.4).map(([x, z]) => [x, (R.y0 + R.y1) / 2, z]);
    // moving heads / washes hanging under the overhang (outside the LED volume)
    const heads = [];
    const step = detail >= 1 ? 2.3 : 4.6;
    for (let x = -R.hw + 1.6; x <= R.hw - 1.6; x += step)
      for (let z = -R.hd + 1.6; z <= R.hd - 1.6; z += step) {
        const cx = Math.max(0, Math.abs(x) - (R.hw - R.r)), cz = Math.max(0, Math.abs(z) - (R.hd - R.r));
        if (Math.hypot(cx, cz) > R.r - 1.4) continue; // outside the rounded corner
        if (Math.abs(x) < B.w / 2 + 0.6 && Math.abs(z) < B.d / 2 + 0.6) continue; // LED volume is here
        heads.push([x, R.y0 - 1.25, z]);
      }
    return { fascia, stripLo, stripHi, cover, grid, boxes: trussBoxes(boxes), rim, heads };
  }, [R, truss, detail]);
  const headGeo = useMemo(() => new THREE.CylinderGeometry(0.3, 0.38, 0.9, 8), []);
  const headMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#08080a", roughness: 0.5, metalness: 0.5 }), []);
  const headItems = useMemo(() => parts.heads.map(([x, y, z]) => ({ p: [x, y + 0.55, z] })), [parts]);
  return (
    <group name="roof-canopy">
      <mesh geometry={parts.cover}>
        <meshBasicMaterial color="#060608" />
      </mesh>
      {[R.y0, R.y1].map((y) => (
        <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <planeGeometry args={[R.hw * 2 - 2.5, R.hd * 2 - 2.5]} />
          <meshStandardMaterial color="#2a2b33" map={parts.grid} alphaMap={parts.grid} alphaTest={0.4} metalness={0.6} roughness={0.45} side={THREE.DoubleSide} />
        </mesh>
      ))}
      <mesh geometry={parts.fascia} material={trussMat} />
      <mesh geometry={parts.boxes} material={trussMat} />
      <EdgeStrip geometry={parts.stripLo} gain={0.9} />
      <EdgeStrip geometry={parts.stripHi} gain={0.9} />
      <Instances geometry={headGeo} material={headMat} items={headItems} />
      <Bulbs points={parts.heads} size={0.17} />
      <Bulbs points={parts.rim} size={0.34} kind="rim" />
    </group>
  );
}

// Line-array PA: J-shaped hangs in front of the LED faces (nest_526_0004, nest_大对角_0006).
function PaHangs() {
  const B = KIT.box;
  const { boxes, cables } = useMemo(() => {
    const boxes = [], cables = [], top = B.y0 + B.h - 1.5, N = 11;
    const hang = (x, z, ry) => {
      const o = new THREE.Object3D(), c = new THREE.Object3D();
      o.position.set(x, 0, z);
      o.rotation.y = ry;
      o.updateMatrix();
      for (let i = 0; i < N; i++) {
        c.position.set(0, top - 0.62 * i, -0.03 * i * i);
        c.rotation.set(-0.04 * i, 0, 0);
        c.updateMatrix();
        const m = o.matrix.clone().multiply(c.matrix), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
        m.decompose(p, q, s);
        const e = new THREE.Euler().setFromQuaternion(q);
        boxes.push({ p: p.toArray(), r: [e.x, e.y, e.z] });
      }
      cables.push({ p: [x, (top + KIT.roof.y0) / 2 + 0.3, z], s: [1, KIT.roof.y0 - top, 1] });
    };
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) hang(sx * (B.w / 2 - 6), sz * (B.d / 2 + 1.7), sz > 0 ? 0 : Math.PI);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) hang(sx * (B.w / 2 + 1.7), sz * 5, sx > 0 ? Math.PI / 2 : -Math.PI / 2);
    return { boxes, cables };
  }, [B]);
  const boxGeo = useMemo(() => new THREE.BoxGeometry(1.3, 0.58, 0.85), []);
  const cabGeo = useMemo(() => new THREE.CylinderGeometry(0.04, 0.04, 1, 5), []);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#0b0b0e", roughness: 0.7, metalness: 0.25 }), []);
  return (
    <>
      <Instances geometry={boxGeo} material={mat} items={boxes} />
      <Instances geometry={cabGeo} material={mat} items={cables} />
    </>
  );
}

// Glossy black show deck + runway. The main deck is an LED floor: rows of lit tiles that
// breathe with the cue (nest_皇帝位_0010, nest_718_0006); everything mirrors the wash.
const DECK_FS = /* glsl */ `
${GLSL_ATMO}
uniform vec2 uDeck;
varying vec3 vW; varying vec3 vN; varying float vDist;
void main(){
  vec3 base = vec3(.012,.013,.016);
  if (vN.y > .5) {
    vec2 g = vW.xz/1.0; vec2 d = abs(fract(g)-.5);
    float line = 1.-smoothstep(.0,.03,.5-max(d.x,d.y));
    float fade = 1.-smoothstep(.05,.3,max(fwidth(g.x),fwidth(g.y)));
    float pool = exp(-dot(vW.xz*vec2(1.,2.2),vW.xz*vec2(1.,2.2))/900.);
    vec3 refl = uCue*(.04+.34*pool) + uEdge*.02;
    vec3 v = normalize(cameraPosition - vW);
    float fres = pow(1.-max(v.y,0.),4.);
    base += refl*(.3+1.6*fres) + line*fade*uEdge*.04;
    if (abs(vW.x) < uDeck.x && abs(vW.z) < uDeck.y) {
      vec2 tg = vW.xz/vec2(2.2,2.2); vec2 tc = floor(tg), tf = abs(fract(tg)-.5);
      float tile = (1.-smoothstep(.26,.31,tf.x))*(1.-smoothstep(.16,.21,tf.y));
      float on = step(.35, hash12(tc + floor(uT*.5))) * (.55+.45*sin(uT*1.7 + tc.x*.9 + tc.y*1.3));
      float tfade = 1.-smoothstep(.25,.9,max(fwidth(tg.x),fwidth(tg.y)));
      base += mix(.18*.35, tile, tfade)*on*(uCue*.9 + vec3(.35))*.9;
    }
  } else base += uCue*.02;
  base = applyFog(base, vDist);
  gl_FragColor = vec4(base,1.);
  ${GLSL_OUT}
}`;
const DECK_VS = /* glsl */ `
varying vec3 vW; varying vec3 vN; varying float vDist;
void main(){ vec4 wp = modelMatrix*vec4(position,1.); vW = wp.xyz; vN = normal; vec4 mv = viewMatrix*wp; vDist = length(mv.xyz); gl_Position = projectionMatrix*mv; }`;

function DeckAndRunway({ detail = 1 }) {
  const G = KIT.ring, D = KIT.deck;
  const deckMat = useMemo(() => new THREE.ShaderMaterial({ uniforms: atmoUniforms({ uDeck: { value: new THREE.Vector2(D.hw - 0.6, D.hd - 0.6) } }), vertexShader: DECK_VS, fragmentShader: DECK_FS }), [D]);
  const parts = useMemo(() => {
    const outer = roundedRect(G.hw, G.hd, G.r, 1.2), inner = roundedRect(G.hw - G.w, G.hd - G.w, G.r - G.w, 1.2).reverse();
    const ring = slabGeo(outer, G.h, G.h, inner);
    const moat = slabGeo(roundedRect(G.hw - 0.2, G.hd - 0.2, G.r, 1.2), 0.12, 0.1);
    const strip = loopStrip(roundedRect(G.hw + 0.05, G.hd + 0.05, G.r + 0.05, 1.2), G.h - 0.3, G.h - 0.08);
    const blinders = roundedRect(G.hw - 0.25, G.hd - 0.25, G.r, detail >= 1 ? 1.6 : 3.2).map(([x, z]) => [x, G.h + 0.16, z]);
    const deckEdge = roundedRect(D.hw + 0.05, D.hd + 0.05, 0.3, 1.1).map(([x, z]) => [x, D.h - 0.2, z]);
    return { ring, moat, strip, blinders, deckEdge };
  }, [G, D, detail]);
  return (
    <group name="deck">
      <mesh position={[0, D.h / 2, 0]} material={deckMat}>
        <boxGeometry args={[D.hw * 2, D.h, D.hd * 2]} />
      </mesh>
      <mesh geometry={parts.ring} material={deckMat} />
      {/* bridges from the deck out to the runway at both ends and both sides */}
      {[-1, 1].map((s) => (
        <mesh key={`x${s}`} position={[s * (D.hw + (G.hw - G.w - D.hw) / 2), G.h / 2, 0]} material={deckMat}>
          <boxGeometry args={[G.hw - G.w - D.hw + 0.4, G.h, 9]} />
        </mesh>
      ))}
      {[-1, 1].map((s) => (
        <mesh key={`z${s}`} position={[0, G.h / 2, s * (D.hd + (G.hd - G.w - D.hd) / 2)]} material={deckMat}>
          <boxGeometry args={[7, G.h, G.hd - G.w - D.hd + 0.4]} />
        </mesh>
      ))}
      <mesh geometry={parts.moat}>
        <meshStandardMaterial color="#050506" roughness={0.9} />
      </mesh>
      <EdgeStrip geometry={parts.strip} gain={0.8} />
      <Bulbs points={parts.blinders} size={0.2} kind="rim" />
      <Bulbs points={parts.deckEdge} size={0.07} />
    </group>
  );
}

// Reed / pampas belt between the runway and the floor seats, with the black front-fill
// speakers standing in it (nest_526_0001, nest_526_0004, nest_首场_0001).
function Reeds({ count = 2600, cueColor }) {
  const G = KIT.ring;
  const { mesh, cubes } = useMemo(() => {
    const r = lcg(41);
    const zones = [
      [-G.hw - 1.5, G.hw + 1.5, G.hd + 0.7, G.hd + 5.6, 5],
      [-G.hw - 1.5, G.hw + 1.5, -G.hd - 3.4, -G.hd - 0.7, 3],
      [G.hw + 0.5, G.hw + 2, -G.hd + 4, G.hd - 4, 1],
      [-G.hw - 2, -G.hw - 0.5, -G.hd + 4, G.hd - 4, 1],
    ];
    const total = zones.reduce((a, z) => a + z[4], 0);
    const g = new THREE.ConeGeometry(0.06, 1, 3);
    g.translate(0, 0.5, 0);
    const m = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({ color: "#86a852", roughness: 0.8 }), count), o = new THREE.Object3D();
    let i = 0;
    for (const [x0, x1, z0, z1, wgt] of zones) {
      const n = Math.round((count * wgt) / total);
      for (let k = 0; k < n && i < count; k++, i++) {
        const h = 1.0 + r() * 1.3;
        o.position.set(x0 + r() * (x1 - x0), 0, z0 + r() * (z1 - z0));
        o.rotation.set((r() - 0.5) * 0.35, r() * 6, (r() - 0.5) * 0.35);
        o.scale.set(1, h, 1);
        o.updateMatrix();
        m.setMatrixAt(i, o.matrix);
      }
    }
    m.count = i;
    const cubes = [];
    for (let k = 0; k < 26; k++) cubes.push({ p: [-G.hw + ((k % 13) + 0.5) * ((G.hw * 2) / 13), 0.55, k < 13 ? G.hd + 2.6 + r() * 1.5 : -G.hd - 1.6 - r() * 0.9], r: [0, (r() - 0.5) * 0.3, 0] });
    return { mesh: m, cubes };
  }, [count, G]);
  mesh.material.emissive.set(cueColor).multiplyScalar(0.1);
  const cubeGeo = useMemo(() => new THREE.BoxGeometry(1.1, 1.1, 1), []);
  const cubeMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#08080a", roughness: 0.8 }), []);
  return (
    <>
      <primitive object={mesh} />
      <Instances geometry={cubeGeo} material={cubeMat} items={cubes} />
    </>
  );
}

// The singer at stage centre in a pool of follow-spot light.
function Performer() {
  const map = useMemo(glowTex, []);
  const y = KIT.deck.h;
  return (
    <group name="performer">
      <mesh position={[0, y + 0.95, 0]}>
        <capsuleGeometry args={[0.2, 1.25, 4, 10]} />
        <meshBasicMaterial color={[2.4, 2.2, 1.9]} toneMapped={false} />
      </mesh>
      <mesh position={[0, y + 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[9, 9]} />
        <meshBasicMaterial map={map} color={[1.1, 1.0, 0.85]} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>
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
  const trussMat = useTrussMat(truss);
  const B = KIT.box, T = KIT.towers, R = KIT.roof, D = KIT.deck;
  const towerGeo = useMemo(() => {
    const h = R.y0 - D.h;
    return trussBoxes(T.xs.flatMap((x) => [-1, 1].map((s) => ({ size: [T.size, h, T.size], pos: [x, D.h + h / 2, s * T.z] }))));
  }, [T, R, D]);
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
      <DeckAndRunway detail={quality.detail} />
      <Performer />
      {motifs.building && (
        <group>
          {/* six black truss towers carry the roof; the LED volume hangs around them */}
          <mesh geometry={towerGeo} material={trussMat} />
          <LedVolume faces={tex.faces[c.led]} lower={tex.lower[c.led]} split={c.split} trussMat={trussMat} />
          <RoofCanopy trussMat={trussMat} truss={truss} detail={quality.detail} />
          {quality.detail >= 1 && <PaHangs />}
        </group>
      )}
      {motifs.towers && KIT.imag.at.map((t, i) => <ScreenTower key={i} position={[t[0], 0, t[1]]} rotationY={imagRotY(t)} plate={tex.imag[i]} trussMat={trussMat} />)}
      {/* Mascots fly ABOVE the roof canopy (y ≥ 44), outside every sight line (scripts/mascot_raycheck.mjs).
          In the Nest the real inflatables stand on plinths built over lower-tier seats
          (nest_首场_0002..0004); here they must stay out of the audience, so they keep the
          approved positions above the stage. Same kit and placement in both venues. */}
      {motifs.elephant && <Elephant name="mascot:elephant" plinth={false} position={[8, 44, 8]} scale={0.6} />}
      {motifs.whale && <Whale name="mascot:whale" plinth={false} position={[-12, 50, 3]} rotation={WHALE_FLYING} scale={0.75} />}
      {motifs.airship && <Airship name="mascot:airship" position={[14, 56, -4]} rotation={[0, -0.2, 0.05]} />}
      {motifs.giant && <Giant name="mascot:giant" position={[-4, 46, -12]} scale={0.5} />}
      {motifs.reeds && <Reeds cueColor={c.light} count={quality.detail >= 1 ? 2600 : 1300} />}
      <Beams fx={quality.fx} />
      <Haze fx={quality.fx} />
      <Confetti active={c.confetti} count={quality.fx >= 1 ? 7000 : 3500} />
    </group>
  );
}
