// Inflatable animals of the 万兽之王 show, modelled from the Xiaohongshu photos:
//   lion     – nest_首场_0002 (roaring, on a rock)
//   eagle    – nest_首场_0003 (perched on a boulder, wings raised)
//   elephant – nest_首场_0004 (trunk curled up, pale tusks)
// Each animal is ONE mesh: bodies, limbs, trunks and wings are lofts (a spine with an
// elliptical section at every station), small parts are ellipsoids and cones. Paint is baked
// into vertex colours, so an animal costs one draw call and no downloaded texture.
// Relief (gaps pass): the photos show printed fur and sculpted feathers, not smooth balloons.
//   - big forms are real geometry: mane locks, the finger-like primaries of the wings
//     (loft option `relief`), with the creases darkened in the paint;
//   - fine grain (fur strands, scalloped feather rows) is a 64 x 64 normal map generated in
//     code at start-up (16 KB of memory each, nothing downloaded), tiled through the loft UVs.
import { useMemo } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

const C = (hex) => new THREE.Color(hex);
// Paint functions run once per vertex (tens of thousands of times at start-up). Results are
// read straight into the colour buffer, so they come from a small ring of scratch colours
// instead of fresh objects: no start-up garbage for the collector to stop the first fly-in on.
const RING = Array.from({ length: 32 }, () => new THREE.Color());
let ringAt = 0;
const mixC = (a, b, t) => RING[(ringAt = (ringAt + 1) & 31)].copy(a).lerp(b, Math.min(1, Math.max(0, t)));
const hash = (x, y = 0) => {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

// Small smooth parts (teeth, eyes, claws, rocks) get a zero UV: the normal map has no effect there.
function finish(g, colors) {
  g.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  return g;
}

// ---- detail normal maps, generated once ---------------------------------------------------------
// fur: strands running along V. feather: two rows of scallops per tile, the second row shifted by
// half a feather (one tile = 1 feather wide, 2 rows tall), each with a raised tip and a quill.
const DETAIL = {};
function detailMap(kind) {
  if (DETAIL[kind]) return DETAIL[kind];
  const N = 64, h = new Float32Array(N * N), lat = (x, y, px, py, seed) => hash(((x % px) + px) % px + seed * 17.3, ((y % py) + py) % py + seed * 7.1);
  const noise = (x, y, px, py, seed) => {
    const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const a = lat(x0, y0, px, py, seed), b = lat(x0 + 1, y0, px, py, seed), c = lat(x0, y0 + 1, px, py, seed), d = lat(x0 + 1, y0 + 1, px, py, seed);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      const u = i / N, v = j / N;
      if (kind === "fur") h[j * N + i] = 0.6 * noise(u * 20, v * 3, 20, 3, 1) + 0.4 * noise(u * 40, v * 5, 40, 5, 2);
      else {
        const r = v * 2, row = Math.floor(r), fr = r - row, fc = u + row * 0.5, fx = fc - Math.floor(fc) - 0.5;
        const tip = Math.max(0, 1 - (fr + fx * fx * 2.2) * 1.5);
        h[j * N + i] = Math.pow(tip, 0.7) + 0.3 * Math.exp(-((fx / 0.07) ** 2)) * (1 - fr);
      }
    }
  const data = new Uint8Array(N * N * 4), k = kind === "fur" ? 5 : 3.2;
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      const dx = (h[j * N + ((i + 1) % N)] - h[j * N + ((i + N - 1) % N)]) * k, dy = (h[((j + 1) % N) * N + i] - h[((j + N - 1) % N) * N + i]) * k;
      const l = Math.hypot(dx, dy, 1), o = (j * N + i) * 4;
      data[o] = 127.5 - (dx / l) * 127.5;
      data[o + 1] = 127.5 - (dy / l) * 127.5;
      data[o + 2] = 127.5 + (1 / l) * 127.5;
      data[o + 3] = 255;
    }
  const t = (DETAIL[kind] = new THREE.DataTexture(data, N, N, THREE.RGBAFormat));
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}

// Loft: stations = [[x, y, z, a, b], ...]; a = half-width along `ref` (default z, the animal's
// left-right), b = half-height across it. paint(u, ang, p) → THREE.Color; ang = 0 on the +ref
// side, +π/2 on top, -π/2 underneath. Ends are closed with a pole.
// relief(u, ang) → metres pushed out along the section normal (sculpted locks, feather ribs).
// uv = [around, along]: how many times the detail normal map repeats; omitted = smooth.
// flat: space the ring's vertices evenly across the width instead of evenly in angle (thin
// parts such as wings, so that ribs across the width get the same number of vertices each).
function loft(stations, paint, { seg = 18, per = 7, ref = [0, 0, 1], relief, uv, flat = false } = {}) {
  const centre = new THREE.CatmullRomCurve3(stations.map((s) => new THREE.Vector3(s[0], s[1], s[2])), false, "centripetal");
  const radii = new THREE.CatmullRomCurve3(stations.map((s, i) => new THREE.Vector3(s[3], s[4], i)), false, "centripetal");
  const n = (stations.length - 1) * per, R = new THREE.Vector3(...ref).normalize();
  const pos = [], col = [], uvs = [], idx = [], P = new THREE.Vector3(), T = new THREE.Vector3(), S = new THREE.Vector3(), U = new THREE.Vector3(), q = new THREE.Vector3();
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    centre.getPoint(u, P);
    centre.getTangent(u, T);
    const r = radii.getPoint(u);
    S.copy(R).addScaledVector(T, -R.dot(T)).normalize();
    U.crossVectors(S, T).normalize();
    for (let k = 0; k <= seg; k++) {
      const t = k / seg, ang = !flat ? t * Math.PI * 2 - Math.PI : t < 0.5 ? -Math.acos(Math.min(1, 4 * t - 1)) : Math.acos(Math.max(-1, 3 - 4 * t));
      const ra = Math.max(0.001, r.x), rb = Math.max(0.001, r.y), cs = Math.cos(ang), sn = Math.sin(ang);
      q.copy(P).addScaledVector(S, ra * cs).addScaledVector(U, rb * sn);
      if (relief) {
        // outward normal of the ellipse at this angle
        const nx = rb * cs, ny = ra * sn, nl = Math.hypot(nx, ny) || 1, d = relief(u, ang);
        q.addScaledVector(S, (nx / nl) * d).addScaledVector(U, (ny / nl) * d);
      }
      pos.push(q.x, q.y, q.z);
      uv ? uvs.push((k / seg) * uv[0], u * uv[1]) : uvs.push(0, 0);
      const c = paint(u, ang, q);
      col.push(c.r, c.g, c.b);
    }
  }
  const row = seg + 1;
  for (let i = 0; i < n; i++)
    for (let k = 0; k < seg; k++) {
      const a = i * row + k, b = a + row;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  // poles
  for (const [u, base, flip] of [[0, 0, false], [1, n * row, true]]) {
    centre.getPoint(u, P);
    const c = paint(u, 0, P), pole = pos.length / 3;
    pos.push(P.x, P.y, P.z);
    col.push(c.r, c.g, c.b);
    uv ? uvs.push(0.5 * uv[0], u * uv[1]) : uvs.push(0, 0);
    for (let k = 0; k < seg; k++) flip ? idx.push(pole, base + k + 1, base + k) : idx.push(pole, base + k, base + k + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
// The loft winds inside-out for some spine directions; the material is double-sided, and
// normals are fixed here so lighting is right either way.
function outward(g) {
  g.computeBoundingBox();
  const c = g.boundingBox.getCenter(new THREE.Vector3()), p = g.attributes.position, nrm = g.attributes.normal;
  let dot = 0;
  for (let i = 0; i < p.count; i += 3) dot += (p.getX(i) - c.x) * nrm.getX(i) + (p.getY(i) - c.y) * nrm.getY(i) + (p.getZ(i) - c.z) * nrm.getZ(i);
  if (dot < 0) {
    const ix = g.index.array;
    for (let i = 0; i < ix.length; i += 3) [ix[i + 1], ix[i + 2]] = [ix[i + 2], ix[i + 1]];
    g.computeVertexNormals();
  }
  return g;
}
const L = (stations, paint, opts) => outward(loft(stations, paint, opts));

function ball(p, s, paint, rot) {
  const g = new THREE.SphereGeometry(1, 18, 12);
  g.scale(...(Array.isArray(s) ? s : [s, s, s]));
  if (rot) g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...rot)));
  g.translate(...p);
  const pos = g.attributes.position, col = [], q = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    const c = typeof paint === "function" ? paint(q.fromBufferAttribute(pos, i)) : paint;
    col.push(c.r, c.g, c.b);
  }
  return finish(g, col);
}
// cone with its base at p, pointing along dir
function cone(p, dir, r, h, color) {
  const g = new THREE.ConeGeometry(r, h, 8);
  g.translate(0, h / 2, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...dir).normalize()));
  g.translate(...p);
  return finish(g, Array(g.attributes.position.count).fill([color.r, color.g, color.b]).flat());
}
// inflatable rock the animal stands on: a lumpy block with strata and cracks
function rock(size, centre, pale, dark, round = 0) {
  const g = round ? new THREE.SphereGeometry(1, 28, 16) : new THREE.BoxGeometry(1, 1, 1, 12, 5, 8);
  const pos = g.attributes.position, col = [], q = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    q.fromBufferAttribute(pos, i);
    if (!round) q.multiplyScalar(1 / Math.max(Math.abs(q.x), Math.abs(q.y), Math.abs(q.z)) / 2).lerp(q.clone().normalize().multiplyScalar(0.62), 0.28);
    const n = Math.sin(q.x * 9.1 + q.y * 5.3) * Math.sin(q.z * 7.7 + q.y * 3.1) + 0.5 * Math.sin(q.x * 21 + q.z * 17);
    q.multiplyScalar(1 + 0.045 * n);
    if (round && q.y < -0.35) q.y = -0.35 - (q.y + 0.35) * 0.1;
    pos.setXYZ(i, q.x * size[0] + centre[0], q.y * size[1] + centre[1], q.z * size[2] + centre[2]);
    const strata = 0.5 + 0.5 * Math.sin(q.y * 26 + Math.sin(q.x * 6 + q.z * 5) * 1.6);
    const c = mixC(dark, pale, 0.35 + 0.45 * strata + 0.2 * n);
    col.push(c.r, c.g, c.b);
  }
  g.computeVertexNormals();
  return finish(g, col);
}

const useAnimal = (build) =>
  useMemo(() => {
    const g = mergeGeometries(build()); // every part is indexed: shared vertices stay shared
    g.computeBoundingSphere();
    return g;
  }, [build]);
// Inflatable PVC: a soft sheen, no metal, and a little of its own glow: the real ones are lit
// by their own floods (nest_首场_0002), so the paint stays readable when the show wash is
// dark or strongly coloured. Double-sided: ears, wings and tail feathers are thin.
const glowPatch = (glow) => (shader) => {
  shader.fragmentShader = shader.fragmentShader.replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>\n  totalEmissiveRadiance += diffuseColor.rgb * ${glow.toFixed(3)};`);
};
// One material object per (roughness, glow, side): built once, never touched by React again,
// so a re-render can never flag it for a program lookup.
const skins = {};
// detail: "fur" | "feather" adds the generated normal map (strength = normal scale)
export function skin(rough = 0.56, glow = 0.3, side = THREE.DoubleSide, detail = null, strength = 1) {
  const key = `${rough}/${glow}/${side}/${detail}/${strength}`;
  if (!skins[key]) {
    const m = (skins[key] = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: rough, metalness: 0.02, side }));
    if (detail) {
      m.normalMap = detailMap(detail);
      m.normalScale.set(strength, strength);
    }
    m.onBeforeCompile = glowPatch(glow);
    m.customProgramCacheKey = () => `skin${glow}${detail ? "n" : ""}`;
  }
  return skins[key];
}
const Plinth = ({ w = 13, d = 9, h = 3.2 }) => (
  <mesh position={[0, h / 2, 0]}>
    <boxGeometry args={[w, h, d]} />
    <meshStandardMaterial color="#0c0c10" roughness={0.9} />
  </mesh>
);
const both = (f) => [f(1), f(-1)];

// ---- lion (nest_首场_0002) --------------------------------------------------------------------
// Tan body, heavy rust mane around head, neck and chest, pale muzzle, head thrown up in a roar
// with the mouth wide open (dark red inside, white canines), big paws on a brown rock.
function buildLion() {
  const TAN = C("#c48d58"), TAN_D = C("#9a6a40"), BELLY = C("#e0b784"), MANE = C("#9c5f30"), MANE_L = C("#bd8048"), MANE_D = C("#55301a"), FACE = C("#d9a971"), MUZZLE = C("#efd9b4"), DARK = C("#2a1812");
  // printed fur: paler underneath, soft darker patches, short streaks along the body
  const fur = (u, a, p) => {
    const patch = 0.5 + 0.5 * Math.sin(p.x * 1.3 + Math.sin(p.y * 1.7) * 1.5) * Math.sin(p.y * 1.1 + p.z * 2.3);
    const streak = hash(Math.floor(a * 9), Math.floor(p.x * 2.2 + a * 2));
    return mixC(mixC(mixC(TAN, BELLY, -Math.sin(a) * 0.9 - 0.25), TAN_D, 0.3 * patch * patch), MANE, 0.16 * streak);
  };
  // mane: sculpted locks that run from the face back and down. 15 lobes round the collar, each
  // one a soft ridge; they wander a little along their length so no two are parallel.
  const LOCKS = 15;
  const lockAt = (u, a) => 0.5 + 0.5 * Math.sin(a * LOCKS + Math.sin(u * 7 + a * 2) * 1.1);
  const maneRelief = (u, a) => (0.2 * Math.pow(lockAt(u, a), 1.6) + 0.07 * Math.sin(a * 37 + u * 19)) * Math.sin(Math.PI * Math.min(1, u * 1.15));
  // paint: tan-orange round the face and on top, a dark brown bib on the chest (photo), the
  // creases between locks darker, tips of the locks sun-bleached
  const mane = (u, a, p) => {
    const lock = lockAt(u, a), bib = Math.min(1, Math.max(0, (7.9 - p.y + 0.5 * (lock - 0.5)) / 2.2));
    const base = mixC(mixC(MANE_L, MANE, 0.35 + 0.65 * bib), MANE_D, bib * bib * 0.85);
    return mixC(mixC(base, MANE_D, (1 - lock) * 0.55), FACE, Math.max(0, u - 0.84) * 3);
  };
  const leg = (x, z, rear) =>
    rear
      ? L([[x - 0.1, 4.3, z, 1.35, 1.6], [x - 0.35, 3.0, z, 1.15, 1.3], [x - 0.8, 1.9, z, 0.86, 0.95], [x - 0.25, 1.0, z, 0.76, 0.78], [x, 0.3, z, 0.82, 0.82]], fur, { seg: 12, uv: [9, 4] })
      : L([[x, 4.6, z, 1.1, 1.2], [x + 0.1, 3.0, z, 1.0, 1.05], [x + 0.05, 1.6, z, 0.86, 0.88], [x + 0.15, 0.3, z, 0.9, 0.9]], fur, { seg: 12, uv: [9, 4] });
  const paw = (x, z) => [ball([x + 0.55, 0.45, z], [1.2, 0.52, 1.02], FACE), ...[-0.5, 0, 0.5].map((dz) => ball([x + 1.35, 0.3, z + dz], [0.34, 0.3, 0.27], MUZZLE))];
  return [
    rock([11.5, 2.7, 6.6], [-0.4, -1.3, 0], C("#b98c74"), C("#7a5646")),
    ...[
    // trunk of the body, rump to chest
      L([[-4.9, 5.3, 0, 0.5, 0.6], [-4.2, 5.4, 0, 1.55, 1.7], [-2.6, 5.5, 0, 1.75, 1.85], [-0.6, 5.35, 0, 1.6, 1.7], [1.1, 5.6, 0, 1.85, 2.0], [2.5, 6.1, 0, 1.6, 1.9]], fur, { uv: [14, 6] }),
      // mane: one big collar from the chest up over the neck to the crown
      L([[1.5, 4.3, 0, 0.9, 0.8], [1.9, 5.3, 0, 2.2, 2.1], [2.6, 6.7, 0, 2.75, 2.7], [3.3, 8.1, 0, 2.8, 2.65], [3.9, 9.3, 0, 2.3, 2.2], [4.5, 10.2, 0, 1.3, 1.25]], mane, { seg: 60, per: 8, relief: maneRelief, uv: [18, 3] }),
      // head, tilted up: skull → muzzle (upper jaw)
      L([[3.9, 9.2, 0, 1.3, 1.3], [4.7, 9.9, 0, 1.4, 1.3], [5.5, 10.5, 0, 1.12, 0.92], [6.2, 11.0, 0, 0.86, 0.6], [6.55, 11.2, 0, 0.5, 0.3]], (u, a) => mixC(FACE, MUZZLE, u * 1.3 - 0.45 - Math.sin(a) * 0.2), { seg: 16 }),
      // lower jaw, dropped wide open
      L([[4.6, 8.7, 0, 0.9, 0.5], [5.4, 8.75, 0, 0.82, 0.42], [6.1, 8.95, 0, 0.62, 0.34], [6.45, 9.1, 0, 0.3, 0.2]], () => MUZZLE, { seg: 12 }),
      ball([5.25, 9.55, 0], [1.0, 0.72, 0.78], C("#6e1a20")), // mouth
      ball([5.6, 9.12, 0], [0.75, 0.16, 0.42], C("#d2646e")), // tongue
      ...both((s) => cone([6.05, 10.45, s * 0.5], [0.15, -1, 0], 0.15, 0.62, C("#fbf6ea"))),
      ...both((s) => cone([5.95, 9.2, s * 0.44], [-0.1, 1, 0], 0.13, 0.5, C("#fbf6ea"))),
      ...[-0.2, 0.2].map((z) => cone([6.3, 10.75, z], [0.1, -1, 0], 0.07, 0.24, C("#fbf6ea"))),
      ball([6.6, 11.3, 0], [0.26, 0.2, 0.36], DARK), // nose
      ...both((s) => ball([5.2, 10.75, s * 0.86], [0.2, 0.14, 0.12], DARK)), // eyes
      ...both((s) => ball([3.7, 10.7, s * 1.75], [0.5, 0.6, 0.34], MANE, [0, 0, 0.3])), // ears
    ].map((g) => g.translate(0, -1.15, 0)),
    leg(2.1, 1.15, false), leg(2.1, -1.15, false), leg(-3.5, 1.25, true), leg(-3.5, -1.25, true),
    ...paw(2.1, 1.15), ...paw(2.1, -1.15), ...paw(-3.5, 1.25), ...paw(-3.5, -1.25),
    ...[
      // tail with a dark tuft
      L([[-4.7, 5.6, 0, 0.3, 0.3], [-5.7, 5.0, 0.2, 0.24, 0.24], [-6.3, 3.4, 0.4, 0.2, 0.2], [-6.0, 1.9, 0.5, 0.2, 0.2]], () => TAN, { seg: 8 }),
      ball([-5.9, 1.5, 0.5], [0.42, 0.62, 0.42], MANE_D),
    ].map((g) => g.translate(0, -1.15, 0)),
  ];
}
export function Lion({ plinth = false, ...props }) {
  const geo = useAnimal(buildLion);
  return (
    <group {...props}>
      {plinth && <Plinth w={15} d={9} />}
      <mesh geometry={geo} material={skin(0.6, 0.3, THREE.DoubleSide, "fur", 0.26)} position={[0, (plinth ? 3.2 : 0) + 2.65, 0]} />
    </group>
  );
}

// ---- eagle (nest_首场_0003) -------------------------------------------------------------------
// Dark brown eagle on a pale boulder: upright body, wings raised and thrown back, scalloped
// feather rows, pale yellow hooked beak, yellow feet, long tail hanging behind the rock.
// In the photo the breast is mottled with pale pinkish feather edges, the wings carry rows of
// small coverts near the leading edge and long finger-like primaries, and the legs wear dark
// slate "trousers".
function buildEagle() {
  const D0 = C("#2e2623"), D1 = C("#5b4334"), D2 = C("#7b5d47"), SLATE = C("#3a3c46"), SLATE_L = C("#5a5d6c"), BEAK = C("#e3bd62"), FOOT = C("#d9a544"), DARK = C("#161210");
  // rows of scalloped feathers: each row is offset by half a feather
  const feathers = (rows, cols, pale = D2) => (u, a) => {
    const r = u * rows, row = Math.floor(r), fr = r - row;
    const fc = (a / (Math.PI * 2)) * cols + (row % 2) * 0.5, fx = fc - Math.floor(fc) - 0.5;
    const edge = Math.max(0, 1 - (fr + fx * fx * 2.2) * 1.5);
    return mixC(mixC(D0, D1, 0.35 + 0.45 * fr), pale, edge * 0.75);
  };
  const body = feathers(13, 16, C("#94705f"));
  // primaries: 7 inflated fingers along the wing, deeper towards the trailing edge and the tip.
  // ang = 0 is the trailing edge of the wing loft, so the ribs fade out round the leading edge.
  const RIBS = 7;
  const ribAt = (a) => Math.abs(Math.sin((Math.cos(a) * 0.5 + 0.5) * RIBS * Math.PI));
  const ribRelief = (u, a) => 0.3 * Math.pow(ribAt(a), 0.6) * (0.25 + 0.75 * u) * Math.min(1, Math.max(0, Math.cos(a) * 0.5 + 0.75)) * Math.min(1, (1 - u) * 5);
  const wing = (s) => {
    // chord runs fore-aft; long primaries are painted as stripes towards the tip
    const paint = (u, a) => {
      const base = feathers(9, 10, D2)(u, a);
      // long feathers: slate on the ridges, near-black in the gaps between them
      return mixC(base, mixC(DARK, SLATE_L, Math.pow(ribAt(a), 0.7)), Math.min(1, Math.max(0, Math.cos(a) * 0.9 + 0.35)) * (0.35 + 0.65 * u));
    };
    return L(
      [[0.5, 6.1, s * 1.2, 1.3, 0.5], [-0.2, 7.6, s * 2.5, 2.1, 0.42], [-1.1, 9.5, s * 3.6, 2.5, 0.3], [-2.2, 11.4, s * 4.4, 2.1, 0.2], [-3.3, 13.0, s * 4.9, 1.2, 0.1], [-4.0, 14.0, s * 5.1, 0.25, 0.04]],
      paint,
      { seg: 56, per: 6, flat: true, ref: [-0.75, -0.6, s * 0.15], relief: ribRelief, uv: [22, 10] }
    );
  };
  const foot = (z) => [
    L([[0.2, 3.3, z, 0.95, 0.9], [0.45, 2.0, z, 0.7, 0.66], [0.6, 1.0, z, 0.36, 0.36], [0.7, 0.35, z, 0.3, 0.3]], feathers(5, 9, SLATE_L), { seg: 10, uv: [14, 5] }),
    ball([0.9, 0.3, z], [0.5, 0.28, 0.5], FOOT),
    ...[-0.4, 0, 0.4].flatMap((dz) => [
      L([[0.9, 0.32, z + dz * 0.5, 0.17, 0.16], [1.6, 0.34, z + dz, 0.16, 0.15], [2.1, 0.2, z + dz * 1.2, 0.12, 0.11]], () => FOOT, { seg: 6, per: 3 }),
      cone([2.1, 0.22, z + dz * 1.2], [1, -0.9, 0], 0.11, 0.42, DARK),
    ]),
  ];
  return [
    rock([4.6, 2.0, 3.7], [0.2, -1.3, 0], C("#d0a48c"), C("#96705e"), 1),
    // body: tail base → belly → chest → neck → head
    L([[-1.5, 2.0, 0, 0.7, 0.6], [-0.7, 3.0, 0, 1.55, 1.5], [0.1, 4.6, 0, 1.8, 1.75], [0.8, 6.2, 0, 1.55, 1.55], [1.4, 7.5, 0, 1.05, 1.1], [1.9, 8.4, 0, 0.88, 0.9], [2.5, 8.75, 0, 0.6, 0.62]], body, { seg: 22, uv: [24, 10] }),
    // brow ridge + hooked beak
    ...both((s) => ball([2.35, 9.05, s * 0.46], [0.5, 0.14, 0.24], D0, [0, 0, -0.25])),
    L([[2.5, 8.7, 0, 0.42, 0.44], [3.2, 8.65, 0, 0.4, 0.42], [3.85, 8.4, 0, 0.3, 0.32], [4.1, 7.95, 0, 0.17, 0.2], [4.05, 7.55, 0, 0.04, 0.05]], (u, a) => mixC(BEAK, C("#f3dc9a"), Math.sin(a) * 0.5 + 0.2), { seg: 10 }),
    L([[2.6, 8.3, 0, 0.34, 0.16], [3.2, 8.2, 0, 0.3, 0.13], [3.7, 8.1, 0, 0.12, 0.07]], () => BEAK, { seg: 8, per: 4 }),
    ...both((s) => ball([2.55, 8.85, s * 0.5], [0.15, 0.15, 0.1], C("#e9c24e"))),
    ...both((s) => ball([2.6, 8.85, s * 0.56], [0.08, 0.08, 0.06], DARK)),
    wing(1), wing(-1),
    // long tail feathers hanging down behind the rock
    L([[-1.0, 2.8, 0, 1.2, 0.5], [-2.4, 1.6, 0, 1.75, 0.34], [-3.9, 0.0, 0, 1.9, 0.22], [-5.2, -1.4, 0, 1.6, 0.12], [-5.7, -1.9, 0, 0.5, 0.05]], (u, a) => mixC(mixC(D0, SLATE, 0.5 + 0.5 * Math.sin(Math.cos(a) * 16)), D1, 0.25), { seg: 16 }),
    ...foot(0.95), ...foot(-0.95),
  ];
}
export function Eagle({ plinth = false, ...props }) {
  const geo = useAnimal(buildEagle);
  return (
    <group {...props}>
      {plinth && <Plinth w={12} d={10} />}
      <mesh geometry={geo} material={skin(0.62, 0.3, THREE.DoubleSide, "feather", 0.55)} position={[0, (plinth ? 3.2 : 0) + 2.0, 0]} />
    </group>
  );
}

// ---- elephant (nest_首场_0004) ----------------------------------------------------------------
// Dark grey, one smooth body, big ears, trunk curled up over the head, pale tusks, toenails.
function buildElephant() {
  const GREY = C("#55585d"), GREY_D = C("#3d4045"), GREY_L = C("#6c6f74"), IVORY = C("#efe6d6"), EAR_IN = C("#6f6466"), DARK = C("#15151a");
  const hide = (u, a, p) => mixC(mixC(GREY, GREY_L, -Math.sin(a) * 0.5), GREY_D, 0.25 * hash(Math.floor(p.x * 2.2), Math.floor(p.y * 2.2)));
  // wrinkle rings along the trunk
  const trunk = (u, a, p) => mixC(hide(u, a, p), GREY_D, u > 0.3 ? 0.35 * (0.5 + 0.5 * Math.sin(u * 150)) : 0);
  const leg = (x, z) => L([[x, 5.2, z, 1.25, 1.35], [x, 3.4, z, 1.1, 1.15], [x, 1.6, z, 1.02, 1.05], [x, 0.25, z, 1.16, 1.18]], hide, { seg: 14 });
  const nails = (x, z) => [-0.55, 0, 0.55].map((dz) => ball([x + 1.02 - Math.abs(dz) * 0.25, 0.3, z + dz], [0.22, 0.26, 0.26], IVORY));
  return [
    L([[-5.4, 6.0, 0, 0.6, 0.7], [-4.6, 6.3, 0, 2.3, 2.5], [-2.4, 6.9, 0, 3.0, 3.1], [0.2, 6.7, 0, 3.05, 3.05], [2.4, 6.6, 0, 2.7, 2.8], [3.9, 7.0, 0, 1.9, 2.1]], hide, { seg: 24 }),
    // head and trunk in one piece; the trunk curls up and back (photo)
    L(
      [[3.1, 7.6, 0, 1.9, 2.0], [4.5, 8.0, 0, 2.05, 2.25], [5.7, 7.5, 0, 1.6, 1.8], [6.5, 6.5, 0, 0.92, 0.98], [7.5, 5.2, 0, 0.72, 0.75], [8.8, 4.8, 0, 0.6, 0.62], [9.9, 5.6, 0, 0.52, 0.52], [10.3, 7.1, 0, 0.44, 0.44], [9.8, 8.4, 0, 0.38, 0.38], [9.0, 8.8, 0, 0.3, 0.3]],
      trunk,
      { seg: 18, per: 8 }
    ),
    ...both((s) => ball([3.5, 7.5, s * 2.55], [2.0, 2.9, 0.26], (p) => mixC(GREY, EAR_IN, 0.5 + 0.5 * Math.sin(p.y * 2.1 + p.x)), [s * 0.3, s * 0.55, 0.15])),
    leg(3.1, 1.6), leg(3.1, -1.6), leg(-3.4, 1.6), leg(-3.4, -1.6),
    ...nails(3.1, 1.6), ...nails(3.1, -1.6), ...nails(-3.4, 1.6), ...nails(-3.4, -1.6),
    ...both((s) => L([[5.5, 6.2, s * 0.95, 0.3, 0.3], [6.9, 5.2, s * 1.25, 0.24, 0.24], [8.2, 5.3, s * 1.35, 0.15, 0.15], [8.9, 5.9, s * 1.3, 0.03, 0.03]], () => IVORY, { seg: 8 })),
    ...both((s) => ball([5.5, 8.5, s * 1.72], [0.17, 0.15, 0.1], DARK)),
    L([[-5.3, 6.6, 0, 0.2, 0.2], [-6.2, 5.4, 0, 0.16, 0.16], [-6.5, 3.4, 0, 0.13, 0.13]], () => GREY_D, { seg: 6 }),
    ball([-6.5, 3.0, 0], [0.22, 0.45, 0.22], DARK),
  ];
}
export function Elephant({ plinth = false, ...props }) {
  const geo = useAnimal(buildElephant);
  return (
    <group {...props}>
      {plinth && <Plinth w={16} d={9} />}
      <mesh geometry={geo} material={skin(0.66)} position={[-1.5, plinth ? 3.2 : 0, 0]} />
    </group>
  );
}
