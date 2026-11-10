// Shared stage kit "joker_xue_2026" — reconstructed 1:1 from the c941445 Pages
// bundle (assets/index-DIDaugcb.js). Constants are copied verbatim.
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import ledTitleUrl from "./led_title.jpg";
import ledFeedRedUrl from "./led_feed_red.jpg";

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
  const jpgs = new THREE.TextureLoader(), loading = [];
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
  const jpg = (url) => {
    const t = jpgs.load(url);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
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
  mesh.material.emissive.set(cueColor).multiplyScalar(0.28);
  return <primitive object={mesh} />;
}

// ---- light FX ---------------------------------------------------------------------
const beamMat = (color, strength) =>
  new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: { uColor: { value: new THREE.Color(color) }, uStrength: { value: strength } },
    vertexShader: "varying float vY; void main(){ vY = uv.y; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }",
    fragmentShader: "uniform vec3 uColor; uniform float uStrength; varying float vY; void main(){ gl_FragColor = vec4(uColor, pow(clamp(vY,0.,1.),2.2)*uStrength); }",
  });

function Beam({ origin, length, radius, color, strength, sweep = 0, phase = 0, tilt = [0, 0] }) {
  const ref = useRef();
  const geo = useMemo(() => {
    const g = new THREE.ConeGeometry(radius, length, 20, 1, true);
    g.translate(0, -length / 2, 0);
    return g;
  }, [radius, length]);
  const mat = useMemo(() => beamMat(color, strength), [color, strength]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    ref.current.rotation.set(tilt[0] + Math.sin(t * 0.7 + phase) * sweep, 0, tilt[1] + Math.cos(t * 0.5 + phase) * sweep);
  });
  return (
    <group ref={ref} position={origin}>
      <mesh geometry={geo} material={mat} />
    </group>
  );
}

function ArchBeams({ points, color }) {
  return points
    .filter((_, i) => i % 3 === 0)
    .map((p, i) => <Beam key={i} origin={p} length={58} radius={7} color={color} strength={0.13} sweep={0.08} phase={i * 0.7} tilt={[Math.PI * (i % 2 ? 0.86 : 1.12), Math.sin(i * 1.7) * 0.45 + Math.PI * 0]} />);
}

function Lasers({ color }) {
  const rigs = useMemo(
    () =>
      [...Array(18).keys()].map((k) => {
        const x = -26 + (k * 52) / 17;
        return { origin: [x, 3, 17.6 * (k % 2 ? 1 : -1)], phase: k * 1.3, tilt: [(k % 2 ? -1 : 1) * 1.15, (x / 26) * -0.7 + Math.PI] };
      }),
    []
  );
  return rigs.map((r, i) => <Beam key={i} {...r} length={140} radius={0.16} color={color} strength={0.95} sweep={0.16} />);
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
    ref.current.visible = u.uOn.value > 0.01;
  });
  return <points ref={ref} geometry={geo} material={mat} />;
}

function Haze({ color }) {
  const map = useMemo(glowTex, []);
  const puffs = useMemo(() => [...Array(16).keys()].map(() => ({ p: [(Math.random() * 2 - 1) * 38, 6 + Math.random() * 24, (Math.random() * 2 - 1) * 28], s: 26 + Math.random() * 26 })), []);
  return puffs.map(({ p, s }, i) => (
    <sprite key={i} position={p} scale={[s, s, 1]}>
      <spriteMaterial map={map} color={color} transparent opacity={0.055} depthWrite={false} blending={THREE.AdditiveBlending} />
    </sprite>
  ));
}

function Bulbs({ points, color, size = 0.3 }) {
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
  mesh.material.color.set(color).multiplyScalar(4);
  return <primitive object={mesh} />;
}

const hdr = (c, k) => new THREE.Color(c).multiplyScalar(k);

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
      <meshStandardMaterial color="#17171d" map={tex} alphaMap={tex} alphaTest={0.4} side={THREE.DoubleSide} metalness={0.6} roughness={0.5} />
    </mesh>
  );
}

// Vertical IMAG tower (four around the stage).
function ScreenTower({ position, rotationY, plate, edge, truss, w = 12, h = 18, base = 3 }) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh position={[0, base + h / 2, 0.05]}>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial map={plate} toneMapped={false} color={[1.25, 1.25, 1.25]} />
      </mesh>
      <mesh position={[0, base + h / 2, -0.15]}>
        <boxGeometry args={[w + 0.3, h + 0.3, 0.2]} />
        <meshStandardMaterial color="#050507" />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[(s * w) / 2 + s * 0.12, base + h / 2, 0.12]}>
          <boxGeometry args={[0.16, h, 0.16]} />
          <meshBasicMaterial color={hdr(edge, 4.5)} toneMapped={false} />
        </mesh>
      ))}
      <Truss size={[w + 1.2, base + h + 1, 2]} position={[0, (base + h + 1) / 2, -1.25]} map={truss} />
    </group>
  );
}

// Whale lies flat and swims: lathe axis (local +y, head) → world +x, belly (local +z) → down.
const WHALE_FLYING = new THREE.Euler().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, -1), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, -1, 0)));

export function JokerXueStage({ cue = "title", motifs = DEFAULT_MOTIFS }) {
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
  const arch = useMemo(
    () =>
      new THREE.CatmullRomCurve3([[-23, 26, 0], [-22.5, 33, 0], [-19, 38, 0], [-8, 40, 0], [8, 40, 0], [19, 38, 0], [22.5, 33, 0], [23, 26, 0]].map((p) => new THREE.Vector3(...p)))
        .getSpacedPoints(90)
        .map((v) => [v.x, v.y, v.z]),
    []
  );
  const edgeBulbs = useMemo(() => {
    const out = [];
    for (let i = 0; i <= 74; i++) {
      const x = -27 + (i * 54) / 74;
      out.push([x, 2.6, 18.1], [x, 2.6, -18.1]);
    }
    return out;
  }, []);
  const archTube = useMemo(() => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(arch.map((p) => new THREE.Vector3(...p))), 90, 0.32, 6), [arch]);

  return (
    <group name="joker-xue-stage">
      <pointLight position={[0, 34, 0]} intensity={7000} distance={260} decay={1.8} color={c.light} />
      <pointLight position={[-20, 14, 26]} intensity={700} distance={90} decay={1.8} color={c.light} />
      <pointLight position={[20, 14, -26]} intensity={700} distance={90} decay={1.8} color={c.light} />
      <mesh position={[0, 1.2, 0]}>
        <boxGeometry args={[57, 2.4, 36]} />
        <meshStandardMaterial color="#0b0b10" roughness={0.45} metalness={0.3} />
      </mesh>
      <Bulbs points={edgeBulbs} color={c.edge} size={0.11} />
      {motifs.building && (
        <group>
          {[[-20, -6], [20, -6], [-20, 6], [20, 6]].map(([x, z]) => (
            <Truss key={`${x}${z}`} size={[2.4, 12, 2.4]} position={[x, 8.4, z]} map={truss} />
          ))}
          <mesh position={[0, 21, 0]}>
            <boxGeometry args={[46, 14, 16]} />
            <meshStandardMaterial color="#060609" />
          </mesh>
          {/* long faces of the LED "building" volume: real Nest screen captures */}
          {[8.05, -8.05].map((z) => (
            <mesh key={z} position={[0, 21, z]} rotation={[0, z < 0 ? Math.PI : 0, 0]}>
              <planeGeometry args={[45, 13]} />
              <meshBasicMaterial map={z > 0 ? tex.front : tex.back} color={[1.2, 1.2, 1.2]} toneMapped={false} />
            </mesh>
          ))}
          {/* short end faces show the cue plate */}
          {[23.05, -23.05].map((x) => (
            <mesh key={x} position={[x, 21, 0]} rotation={[0, x > 0 ? Math.PI / 2 : -Math.PI / 2, 0]}>
              <planeGeometry args={[9.8, 13]} />
              <meshBasicMaterial map={plate} toneMapped={false} />
            </mesh>
          ))}
          <mesh geometry={archTube}>
            <meshStandardMaterial color="#141418" />
          </mesh>
          <Bulbs points={arch} color={c.edge} size={0.42} />
          <ArchBeams points={arch} color={c.beam} />
        </group>
      )}
      {motifs.towers &&
        [[-33, 17, 1], [33, 17, 1], [-33, -17, 0], [33, -17, 0]].map(([x, z, front], i) => {
          const ry = Math.atan2(-Math.sign(x), front ? 1 : -1);
          return <ScreenTower key={i} position={[x, 0, z]} rotationY={ry} plate={tex.imag[i]} edge={c.edge} truss={truss} h={20} />;
        })}
      {/* Mascots fly ABOVE the arch (y ≥ 44), outside every sight line (scripts/mascot_raycheck.mjs).
          The stage is 四面台 with seats on all sides, so nothing may stand on the field, the
          deck, the moat or the LED roof (the roof blocks cross-stage views of the far IMAG
          towers). Same kit and placement in both venues. */}
      {motifs.elephant && <Elephant name="mascot:elephant" plinth={false} position={[8, 44, 8]} scale={0.6} />}
      {motifs.whale && <Whale name="mascot:whale" plinth={false} position={[-12, 50, 3]} rotation={WHALE_FLYING} scale={0.75} />}
      {motifs.airship && <Airship name="mascot:airship" position={[14, 56, -4]} rotation={[0, -0.2, 0.05]} />}
      {motifs.giant && <Giant name="mascot:giant" position={[-4, 46, -12]} scale={0.5} />}
      {motifs.reeds && <Reeds cueColor={c.light} />}
      <Lasers color={c.laser} />
      <Haze color={c.light} />
      <Confetti active={c.confetti} />
    </group>
  );
}
