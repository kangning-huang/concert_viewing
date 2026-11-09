/* Injected into the restored Pages bundle just before its stage component.
 * Free identifiers are the bundle's own minified names (three 0.175 + R3F):
 *   de React · z jsx-runtime · ic useFrame · US TextureLoader · Wt SRGBColorSpace
 *   ft BufferGeometry · At BufferAttribute · _n ShaderMaterial · Ae Color · Mt Object3D
 *   Ku InstancedMesh · Ei MeshBasicMaterial · qu SphereGeometry · Zu ConeGeometry
 *   Ru AdditiveBlending · bn DoubleSide · FG soft-sprite texture factory
 * Look targets come from assets/refs/xhs/nest: floating roof slab with rainbow rim,
 * tight fan beams from the roof, light radiating over the floor, low stage haze. */
const CV_LED_BASE = "/concert_viewing/stage/joker_xue_2026/led/";
/* Phone-safe budgets. Every effect is one draw call except haze (one per sprite). */
const CV_TIER = {
  ultra: { size: 2048, grid: 1, fans: 72, bulbs: 260, cans: 48, haze: 30, confetti: 1, floor: 1 },
  high: { size: 2048, grid: 1, fans: 56, bulbs: 220, cans: 40, haze: 22, confetti: 1, floor: 1 },
  medium: { size: 1024, grid: 1, fans: 36, bulbs: 160, cans: 24, haze: 12, confetti: 0.6, floor: 1 },
  low: { size: 512, grid: 0, fans: 16, bulbs: 90, cans: 0, haze: 6, confetti: 0.3, floor: 0 },
};
const cvTier = (q) => CV_TIER[q.name] ?? CV_TIER.low;

let cvLed;
/* One size for the session: a mid-show tier drop must not refetch and re-upload. */
function cvLedTextures(q) {
  if (cvLed) return cvLed;
  let size = cvTier(q).size;
  if (window.innerWidth < 720) size = Math.min(size, 1024);
  const loader = new US();
  const load = (k) => {
    const t = loader.load(`${CV_LED_BASE}${size}/${k}.webp`);
    t.colorSpace = Wt;
    t.anisotropy = Math.max(1, q.anisotropy);
    return t;
  };
  cvLed = {
    front: load("front"),
    back: load("back"),
    left: load("left"),
    right: load("right"),
    imag: [1, 2, 3, 4].map((i) => load(`imag${i}`)),
  };
  return cvLed;
}

const cvTint = (hex, weight, gain) => new Ae("#ffffff").lerp(new Ae(hex), weight).multiplyScalar(gain);

function CVLedPanel({ w, h, map, tint, grid, uv = [1, 1, 0, 0], position, rotation }) {
  const mat = de.useMemo(
    () =>
      new _n({
        uniforms: {
          uMap: { value: map },
          uTint: { value: tint.clone() },
          uCells: { value: [w / 0.5, h / 0.5] },
          uGrid: { value: grid },
          uUv: { value: uv },
        },
        vertexShader:
          "uniform vec4 uUv; varying vec2 vP; varying vec2 vC; void main(){ vC = uv; vP = uv*uUv.xy + uUv.zw; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }",
        fragmentShader: `uniform sampler2D uMap; uniform vec3 uTint; uniform vec2 uCells; uniform float uGrid; varying vec2 vP; varying vec2 vC;
        void main(){ vec3 c = texture2D(uMap, vP).rgb*uTint;
          vec2 p = vC*uCells; vec2 d = fwidth(p); float keep = clamp(1.-max(d.x,d.y)*3.,0.,1.);
          vec2 g = abs(fract(p)-.5); c *= 1.-uGrid*keep*smoothstep(.45,.5,max(g.x,g.y))*.55;
          gl_FragColor = vec4(c,1.);
          #include <colorspace_fragment>
        }`,
      }),
    [map, w, h, grid, uv],
  );
  ic((_, dt) => {
    mat.uniforms.uTint.value.lerp(tint, 1 - Math.exp(-dt * 4));
  });
  return z.jsxs("mesh", {
    position,
    rotation,
    material: mat,
    children: [z.jsx("planeGeometry", { args: [w, h] })],
  });
}

const CV_RAINBOW = ["#ff3b5c", "#ff9a2e", "#ffe14a", "#4dff8a", "#38d6ff", "#6a6bff", "#e05cff"];

/* Floating slab over the LED box, rim bulbs and downward cans. */
function CVRoof({ q, edge, rainbow }) {
  const t = cvTier(q);
  const halfX = 27;
  const halfZ = 13;
  const y = 29.4;
  const bulbs = de.useMemo(() => {
    const mesh = new Ku(new qu(1, 6, 4), new Ei({ toneMapped: !1 }), t.bulbs);
    const o = new Mt();
    const perim = 4 * (halfX + halfZ);
    for (let i = 0; i < t.bulbs; i++) {
      let d = (i / t.bulbs) * perim;
      let x, zz;
      if (d < 2 * halfX) (x = -halfX + d, zz = halfZ);
      else if ((d -= 2 * halfX) < 2 * halfZ) (x = halfX, zz = halfZ - d);
      else if ((d -= 2 * halfZ) < 2 * halfX) (x = halfX - d, zz = -halfZ);
      else ((d -= 2 * halfX), (x = -halfX), (zz = -halfZ + d));
      o.position.set(x, y + 0.72, zz);
      o.scale.setScalar(0.17);
      o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
      mesh.setColorAt(i, new Ae("#ffffff"));
    }
    return mesh;
  }, [t.bulbs]);
  de.useEffect(() => {
    const c = new Ae();
    for (let i = 0; i < t.bulbs; i++) {
      c.set(rainbow ? CV_RAINBOW[Math.floor(i / 6) % CV_RAINBOW.length] : edge).multiplyScalar(3.2);
      bulbs.setColorAt(i, c);
    }
    bulbs.instanceColor.needsUpdate = !0;
  }, [bulbs, edge, rainbow, t.bulbs]);
  const cans = de.useMemo(() => {
    if (!t.cans) return null;
    const mesh = new Ku(new Zu(0.5, 0.8, 8), new Ei({ toneMapped: !1, color: new Ae("#ffe9c9").multiplyScalar(3) }), t.cans);
    const o = new Mt();
    for (let i = 0; i < t.cans; i++) {
      const row = i % 2 ? 1 : -1;
      o.position.set(-24 + (48 * Math.floor(i / 2)) / Math.max(1, t.cans / 2 - 1), y - 1.15, row * 10.5);
      o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
    }
    return mesh;
  }, [t.cans]);
  return z.jsxs("group", {
    children: [
      z.jsxs("mesh", {
        position: [0, y, 0],
        children: [
          z.jsx("boxGeometry", { args: [2 * halfX, 1.4, 2 * halfZ] }),
          z.jsx("meshStandardMaterial", { color: "#08080c", roughness: 0.42, metalness: 0.55 }),
        ],
      }),
      z.jsx("primitive", { object: bulbs }),
      cans && z.jsx("primitive", { object: cans }),
    ],
  });
}

/* All fan beams in a single additive geometry, swayed in the vertex shader. */
function CVFans({ q, color }) {
  const n = cvTier(q).fans;
  const target = de.useMemo(() => new Ae(), []);
  const { geo, mat } = de.useMemo(() => {
    const P = [], D = [], S = [], T = [], E = [], F = [], idx = [];
    let v = 0;
    for (let i = 0; i < n; i++) {
      const side = i % 2 ? 1 : -1;
      const u = n > 2 ? Math.floor(i / 2) / Math.max(1, Math.floor(n / 2) - 1) : 0.5;
      const ox = -25 + 50 * u;
      const oz = side * 12.8;
      const spread = (u - 0.5) * 1.5;
      const len = 95 + 25 * Math.sin(i * 2.3);
      const dir = [Math.sin(spread) * len * 0.72, -len * 0.48, side * Math.cos(spread) * len * 0.72];
      const phase = i * 0.61;
      for (const a of [[1.3, 0, 0], [0, 1.3, 0]]) {
        for (const [t, e] of [[0, -1], [0, 1], [1, -1], [1, 1]]) {
          P.push(ox, 29, oz);
          D.push(...dir);
          S.push(a[0] * e, a[1] * e, a[2] * e);
          T.push(t);
          E.push(e);
          F.push(phase);
        }
        idx.push(v, v + 1, v + 2, v + 1, v + 3, v + 2);
        v += 4;
      }
    }
    const g = new ft();
    g.setAttribute("position", new At(new Float32Array(P), 3));
    g.setAttribute("aDir", new At(new Float32Array(D), 3));
    g.setAttribute("aSide", new At(new Float32Array(S), 3));
    g.setAttribute("aT", new At(new Float32Array(T), 1));
    g.setAttribute("aE", new At(new Float32Array(E), 1));
    g.setAttribute("aPhase", new At(new Float32Array(F), 1));
    g.setIndex(idx);
    const m = new _n({
      transparent: !0,
      depthWrite: !1,
      blending: Ru,
      side: bn,
      uniforms: { uT: { value: 0 }, uC: { value: new Ae(color) } },
      vertexShader: `attribute vec3 aDir; attribute vec3 aSide; attribute float aT, aE, aPhase; uniform float uT; varying float vT, vE;
        void main(){ vT = aT; vE = aE; float a = sin(uT*.55+aPhase)*.17; float c = cos(a), s = sin(a);
          vec3 d = vec3(aDir.x*c-aDir.z*s, aDir.y, aDir.x*s+aDir.z*c);
          vec3 p = position + d*aT + aSide*(.05+aT);
          gl_Position = projectionMatrix*modelViewMatrix*vec4(p,1.); }`,
      fragmentShader: `uniform vec3 uC; varying float vT, vE;
        void main(){ float e = 1.-abs(vE); gl_FragColor = vec4(uC, pow(1.-vT,1.7)*e*e*.34); }`,
    });
    return { geo: g, mat: m };
  }, [n]);
  ic(({ clock }, dt) => {
    mat.uniforms.uT.value = clock.elapsedTime;
    mat.uniforms.uC.value.lerp(target.set(color), 1 - Math.exp(-dt * 4));
  });
  return z.jsx("mesh", { geometry: geo, material: mat, frustumCulled: !1 });
}

/* Light raked across the field plus the LED grid on the deck top. */
function CVFloor({ q, color }) {
  const on = cvTier(q).floor;
  const target = de.useMemo(() => new Ae(), []);
  const mats = de.useMemo(() => {
    const uniforms = () => ({ uT: { value: 0 }, uC: { value: new Ae(color) } });
    const vs = "varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }";
    const common = { transparent: !0, depthWrite: !1, blending: Ru };
    return {
      field: new _n({
        ...common,
        uniforms: uniforms(),
        vertexShader: vs,
        fragmentShader: `uniform float uT; uniform vec3 uC; varying vec2 vU;
          void main(){ vec2 p = (vU-.5)*vec2(170.,130.); float r = length(p), a = atan(p.y,p.x);
            float rays = pow(.5+.5*sin(a*46.+sin(a*7.)*3.+uT*.25),5.)+.35*pow(.5+.5*sin(a*17.-uT*.18),3.);
            float f = smoothstep(26.,44.,r)*smoothstep(84.,48.,r);
            gl_FragColor = vec4(uC, rays*f*.34); }`,
      }),
      deck: new _n({
        ...common,
        uniforms: uniforms(),
        vertexShader: vs,
        fragmentShader: `uniform float uT; uniform vec3 uC; varying vec2 vU;
          void main(){ vec2 g = abs(fract(vU*vec2(57.,36.)/1.5)-.5); float l = smoothstep(.44,.5,max(g.x,g.y));
            float w = .55+.45*sin(vU.x*18.-uT*1.4);
            gl_FragColor = vec4(uC, l*w*.42); }`,
      }),
    };
  }, []);
  ic(({ clock }, dt) => {
    target.set(color);
    for (const m of [mats.field, mats.deck]) {
      m.uniforms.uT.value = clock.elapsedTime;
      m.uniforms.uC.value.lerp(target, 1 - Math.exp(-dt * 4));
    }
  });
  if (!on) return null;
  return z.jsxs("group", {
    children: [
      z.jsxs("mesh", {
        position: [0, 0.32, 0],
        rotation: [-Math.PI / 2, 0, 0],
        material: mats.field,
        children: [z.jsx("planeGeometry", { args: [170, 130] })],
      }),
      z.jsxs("mesh", {
        position: [0, 2.43, 0],
        rotation: [-Math.PI / 2, 0, 0],
        material: mats.deck,
        children: [z.jsx("planeGeometry", { args: [57, 36] })],
      }),
    ],
  });
}

/* Haze hugging the deck and the box; replaces 16 evenly scattered sprites. */
function CVHaze({ q, color }) {
  const n = cvTier(q).haze;
  const tex = de.useMemo(FG, []);
  const items = de.useMemo(
    () =>
      [...Array(n).keys()].map((i) => {
        const a = (i / n) * Math.PI * 2 + Math.random() * 0.5;
        const low = i % 3 !== 0;
        return {
          p: [Math.cos(a) * (low ? 34 : 24), low ? 4 + Math.random() * 8 : 16 + Math.random() * 14, Math.sin(a) * (low ? 26 : 18)],
          s: low ? 24 + Math.random() * 16 : 34 + Math.random() * 20,
        };
      }),
    [n],
  );
  return items.map(({ p, s }, i) =>
    z.jsx(
      "sprite",
      {
        position: p,
        scale: [s, s, 1],
        children: z.jsx("spriteMaterial", {
          map: tex,
          color,
          transparent: !0,
          opacity: 0.075,
          depthWrite: !1,
          blending: Ru,
        }),
      },
      i,
    ),
  );
}
