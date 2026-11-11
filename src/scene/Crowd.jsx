// Audience. Three LODs, all instanced / shader-driven:
//   far   – people are painted per seat cell by the stand shader (ProcBowl.jsx),
//   mid   – light sticks: one twinkling point per fan (StandLights / floor sticks),
//   near  – real 3D seats, steps and people around the picked seat (NearSeats) and
//           standing people on the floor blocks (FloorCrowd).
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { atmoUniforms, ATMO, GLSL_ATMO, GLSL_OUT } from "./atmo.js";
import { occupancy, slotIds, tierPoint, tierRows } from "./venue/ProcBowl.jsx";

const lcg = (seed) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

// ---- instanced, vertex-lit material (people, seats, steps) -------------------------------
// Lighting is evaluated per vertex from the stage position; fragments only add fog.
const INST_VS = /* glsl */ `
${GLSL_ATMO}
varying vec3 vC; varying float vDist;
void main(){
  vec4 wp = modelMatrix*instanceMatrix*vec4(position,1.);
  vec3 n = normalize(mat3(modelMatrix)*mat3(instanceMatrix)*normal);
  vec3 Ld = vec3(0.,24.,0.) - wp.xyz; float d = length(Ld); Ld /= d;
  float ndl = max(dot(n,Ld),0.)*.85 + .15;
  float att = 1./(1.+pow(d/80.,2.));
  vec3 alb = instanceColor;
  #ifdef PERSON
    float headM = step(1.36, position.y);
    float front = smoothstep(-.15,.45, dot(n, normalize(vec3(Ld.x,0.,Ld.z))));
    alb = mix(alb, mix(vec3(.022,.02,.02), vec3(.58,.42,.34), front), headM);
  #endif
  vec3 amb = vec3(.030,.034,.048) + uCue*.03;
  vC = alb*(amb + uCue*ndl*att*2.1 + ndl*att*.3);
  vec4 mv = viewMatrix*wp; vDist = length(mv.xyz);
  gl_Position = projectionMatrix*mv;
}`;
const INST_FS = /* glsl */ `
${GLSL_ATMO}
varying vec3 vC; varying float vDist;
void main(){ vec3 c = applyFog(vC, vDist); gl_FragColor = vec4(c,1.); ${GLSL_OUT} }`;
const instMaterial = (person) => new THREE.ShaderMaterial({ defines: person ? { PERSON: 1 } : {}, uniforms: atmoUniforms(), vertexShader: INST_VS, fragmentShader: INST_FS });

function mergeGeos(list) {
  const pos = [], nor = [], idx = [];
  let base = 0;
  for (const g of list) {
    const p = g.attributes.position, n = g.attributes.normal, i = g.index;
    for (let k = 0; k < p.count; k++) pos.push(p.getX(k), p.getY(k), p.getZ(k)), nor.push(n.getX(k), n.getY(k), n.getZ(k));
    for (let k = 0; k < i.count; k++) idx.push(i.getX(k) + base);
    base += p.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  out.setIndex(idx);
  return out;
}
// 1.7 m person: tapered torso + shoulders + head (head verts sit above y = 1.36).
function personGeo(sides) {
  const body = new THREE.CylinderGeometry(0.2, 0.15, 1.28, sides, 1);
  body.translate(0, 0.64, 0);
  body.scale(1, 1, 0.62);
  const sh = new THREE.SphereGeometry(0.21, sides, 3, 0, Math.PI * 2, 0, Math.PI / 2);
  sh.scale(1, 0.45, 0.62);
  sh.translate(0, 1.27, 0);
  const head = new THREE.SphereGeometry(0.115, Math.max(6, sides), 5);
  head.translate(0, 1.52, 0);
  return mergeGeos([body, sh, head]);
}
const CLOTH = ["#0d0e12", "#15171d", "#22252c", "#3a3d45", "#c9c5bd", "#e9e6df", "#5a2630", "#283a5c", "#1f3b33", "#6b5a44", "#8a8d93", "#b06a7a"].map((c) => new THREE.Color(c));

function instanced(geo, mat, cap) {
  const m = new THREE.InstancedMesh(geo, mat, cap);
  m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
  m.count = 0;
  m.frustumCulled = false;
  return m;
}

// ---- light sticks -------------------------------------------------------------------------
const STICK_VS = /* glsl */ `
${GLSL_ATMO}
attribute float aSeed; uniform float uPx; varying float vA; varying float vS;
void main(){ vec4 mv = modelViewMatrix*vec4(position,1.); gl_Position = projectionMatrix*mv; vS = aSeed;
  float fog = exp(-length(mv.xyz)*uFogK*.6);
  vA = (.35 + .65*pow(max(0.,.5+.5*sin(uT*(1.+aSeed*3.)+aSeed*40.)),3.))*fog; gl_PointSize = clamp(uPx/-mv.z,1.,5.); }`;
const STICK_FS = /* glsl */ `
uniform vec3 uEdge; varying float vA; varying float vS;
void main(){ float d = length(gl_PointCoord-.5); if(d>.5) discard; vec3 c = mix(uEdge, vec3(1.), step(.9,vS)*.7); gl_FragColor = vec4(c*1.5, clamp(vA*(1.-d*2.),0.,1.)); }`;
function stickPoints(pos, seeds) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("aSeed", new THREE.Float32BufferAttribute(seeds, 1));
  const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: atmoUniforms({ uPx: { value: 420 } }), vertexShader: STICK_VS, fragmentShader: STICK_FS });
  const pts = new THREE.Points(g, m);
  pts.matrixAutoUpdate = false;
  return pts;
}

// Twinkling light sticks in the stands — only where tickets are on sale.
export function StandLights({ venue, density = 1 }) {
  const pts = useMemo(() => {
    const spec = venue.bowl, occ = occupancy(venue), r = lcg(7), pos = [], seeds = [], d = Math.max(0.05, Math.min(1, density)) * 0.2;
    const half = Math.PI / spec.slots;
    for (const t of spec.tiers) {
      const rows = tierRows(t);
      for (const slot of slotIds(spec)) {
        const thc = spec.theta(slot);
        for (let row = 0; row < rows; row++) {
          const dd = (row + 0.5) / rows;
          if (!occ(t.key, slot, dd)) continue;
          const a = tierPoint(spec, t, dd, thc - half), b = tierPoint(spec, t, dd, thc + half), len = Math.hypot(b[0] - a[0], b[2] - a[2]), n = Math.floor(len / 0.5);
          for (let i = 1; i < n - 1; i++) {
            if (r() > d) continue;
            const p = tierPoint(spec, t, dd + (r() - 0.5) / rows, thc - half + ((i + r()) / n) * 2 * half);
            pos.push(p[0], p[1] + 1.15 + r() * 0.5, p[2]);
            seeds.push(r());
          }
        }
      }
    }
    return stickPoints(pos, seeds);
  }, [venue, density]);
  return <primitive object={pts} />;
}

// Standing audience on the floor blocks (leaves a hole at each block's POV).
export function FloorCrowd({ sections, density = 1 }) {
  const group = useMemo(() => {
    const r = lcg(23), floor = sections.filter((s) => s.kind === "floor"), spots = [], d = Math.max(0.05, Math.min(1, density));
    const dx = 0.62 / Math.sqrt(d), dz = 0.8 / Math.sqrt(d);
    for (const s of floor) {
      const xs = s.points.map((p) => p[0]), zs = s.points.map((p) => p[1]);
      const x0 = Math.min(...xs), x1 = Math.max(...xs), z0 = Math.min(...zs), z1 = Math.max(...zs);
      for (let x = x0 + 0.3; x < x1; x += dx)
        for (let z = z0 + 0.3; z < z1; z += dz) {
          const px = x + (r() - 0.5) * 0.3, pz = z + (r() - 0.5) * 0.3;
          if (Math.hypot(px - s.seat.x, pz - s.seat.z) > 1.05) spots.push([px, pz]);
        }
    }
    const mesh = instanced(personGeo(d >= 1 ? 7 : 5), instMaterial(true), Math.max(1, spots.length)), o = new THREE.Object3D(), pos = [], seeds = [];
    spots.forEach(([x, z], i) => {
      o.position.set(x, 0.05, z);
      o.rotation.y = Math.atan2(-x, -z) + (r() - 0.5) * 0.7;
      o.scale.set(0.95 + r() * 0.2, 0.9 + r() * 0.16, 0.95 + r() * 0.2);
      o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
      mesh.setColorAt(i, CLOTH[Math.floor(r() ** 1.6 * CLOTH.length)]);
      if (r() < 0.3) pos.push(x + (r() - 0.5) * 0.3, 1.75 + r() * 0.35, z + (r() - 0.5) * 0.3), seeds.push(r());
    });
    mesh.count = spots.length;
    const g = new THREE.Group();
    g.add(mesh, stickPoints(pos, seeds));
    return g;
  }, [sections, density]);
  return <primitive object={group} />;
}

// ---- near-seat LOD: real steps, tip-up seats and neighbours around a bowl POV ---------------
const PATCH_R = 7.5, PATCH_FWD = 3.5, CAP = 620;
export function NearSeats({ venue, section, enabled = true }) {
  const kit = useMemo(() => {
    const box = new THREE.BoxGeometry(1, 1, 1);
    const g = new THREE.Group();
    g.name = "near-seats";
    const tread = instanced(box, instMaterial(false), CAP), back = instanced(box, instMaterial(false), CAP), pan = instanced(box, instMaterial(false), CAP), people = instanced(personGeo(8), instMaterial(true), CAP);
    g.add(tread, back, pan, people);
    return { g, tread, back, pan, people };
  }, []);
  useEffect(() => {
    const { tread, back, pan, people } = kit, spec = venue.bowl;
    const off = () => {
      tread.count = back.count = pan.count = people.count = 0;
      ATMO.uSeat.value.set(0, 0, 0, 0);
    };
    if (!enabled || !section || section.kind !== "bowl") return off();
    const ti = spec.tiers.findIndex((t) => t.key === section.tier), t = spec.tiers[ti], rows = tierRows(t), occ = occupancy(venue), r = lcg(1 + ti * 97 + section.slot * 13);
    const thc = spec.theta(section.slot), half = Math.PI / spec.slots, dm = (section.d[0] + section.d[1]) / 2;
    const seat = section.seat, inl = Math.hypot(seat.x, seat.z), ix = -seat.x / inl, iz = -seat.z / inl;
    const cx = seat.x + ix * PATCH_FWD, cz = seat.z + iz * PATCH_FWD;
    ATMO.uSeat.value.set(cx, cz, PATCH_R, 0);
    const row0 = Math.floor(dm * rows), seatCol = new THREE.Color(...spec.seatColors[ti]), conc = new THREE.Color(0.12, 0.125, 0.13), c = new THREE.Color();
    const o = new THREE.Object3D(), X = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(), basis = new THREE.Matrix4();
    let nT = 0, nS = 0, nP = 0;
    const put = (mesh, i, px, py, pz, sx, sy, sz, col) => {
      o.position.set(px, py, pz);
      o.quaternion.setFromRotationMatrix(basis);
      o.scale.set(sx, sy, sz);
      o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
      mesh.setColorAt(i, col);
    };
    for (let row = Math.max(0, row0 - 14); row <= Math.min(rows - 1, row0 + 6); row++) {
      const d = (row + 0.5) / rows;
      const a = tierPoint(spec, t, d, thc - 0.001), b = tierPoint(spec, t, d, thc + 0.001), rloc = Math.hypot(b[0] - a[0], b[2] - a[2]) / 0.002;
      const pIn = tierPoint(spec, t, row / rows, thc), pOut = tierPoint(spec, t, (row + 1) / rows, thc), depth = Math.hypot(pOut[0] - pIn[0], pOut[2] - pIn[2]);
      const dth = 0.5 / rloc;
      for (let k = -17; k <= 17; k++) {
        if (nT >= CAP) break;
        // 0.5 m seat pitch, measured from the section centre line (where the POV sits)
        const th = thc + k * dth, p = tierPoint(spec, t, d, th);
        if (Math.hypot(p[0] - cx, p[2] - cz) > PATCH_R + 0.7) continue;
        const pl = Math.hypot(p[0], p[2]);
        Z.set(-p[0] / pl, 0, -p[2] / pl); // towards the stage
        X.crossVectors(Y, Z).normalize();
        basis.makeBasis(X, Y, Z);
        const u = k * 0.5, aisle = half * rloc - Math.abs(u) < 0.6, top = p[1];
        put(tread, nT++, p[0], top - 1.5, p[2], 0.56, 3, depth + 0.04, c.copy(conc).multiplyScalar(aisle ? 1.25 : 0.85 + r() * 0.2));
        if (aisle) continue;
        const bx = p[0] - Z.x * depth * 0.38, bz = p[2] - Z.z * depth * 0.38;
        put(back, nS, bx, top + 0.62, bz, 0.44, 0.46, 0.05, c.copy(seatCol).multiplyScalar(0.8 + r() * 0.3));
        put(pan, nS++, p[0] - Z.x * depth * 0.16, top + 0.42, p[2] - Z.z * depth * 0.16, 0.44, 0.06, 0.4, c.copy(seatCol).multiplyScalar(0.7 + r() * 0.3));
        const hOcc = r(), hStand = r(), hCol = r(), hS = r();
        if (hOcc < occ(t.key, section.slot, d) && Math.hypot(p[0] - seat.x, p[2] - seat.z) > 0.75) {
          const standing = hStand < 0.25, sy = (standing ? 0.98 : 0.74) * (0.94 + hS * 0.12);
          o.position.set(p[0] - Z.x * depth * (standing ? 0.05 : 0.2), top, p[2] - Z.z * depth * (standing ? 0.05 : 0.2));
          o.rotation.set(0, Math.atan2(Z.x, Z.z) + (hS - 0.5) * 0.5, 0);
          o.scale.set(1, sy, 1);
          o.updateMatrix();
          people.setMatrixAt(nP, o.matrix);
          people.setColorAt(nP++, CLOTH[Math.floor(hCol ** 1.6 * CLOTH.length)]);
        }
      }
    }
    tread.count = nT;
    back.count = pan.count = nS;
    people.count = nP;
    for (const m of [tread, back, pan, people]) (m.instanceMatrix.needsUpdate = true), (m.instanceColor.needsUpdate = true);
    return undefined;
  }, [kit, venue, section, enabled]);
  return <primitive object={kit.g} />;
}
