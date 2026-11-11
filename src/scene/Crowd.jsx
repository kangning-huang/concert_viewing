// Audience. Everyone sits (no standing at these shows). Three LODs, all instanced / shader-driven:
//   far   – seated silhouettes are painted per seat cell by the stand shader (ProcBowl.jsx),
//   mid   – light sticks: one twinkling point per fan (StandLights / floor sticks),
//   near  – silhouette cutout boards: one alpha-tested card per fan, on the seated floor
//           blocks (FloorCrowd) and on real 3D seats around a bowl POV (NearSeats).
// The cutouts come from the dark foreground audience in the XHS photos
// (scripts/bake_silhouettes.py → public/stage/joker_xue_2026/crowd/silhouettes.webp).
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { atmoUniforms, ATMO, GLSL_ATMO, GLSL_OUT } from "./atmo.js";
import { occupancy, slotIds, tierPoint, tierRows } from "./venue/ProcBowl.jsx";
import { SIL, silhouetteAtlas } from "./silhouettes.js";

const lcg = (seed) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

// ---- instanced, vertex-lit material (seats, steps) -------------------------------
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
  vec3 amb = vec3(.030,.034,.048) + uCue*.03;
  vC = alb*(amb + uCue*ndl*att*2.1 + ndl*att*.3);
  vec4 mv = viewMatrix*wp; vDist = length(mv.xyz);
  gl_Position = projectionMatrix*mv;
}`;
const INST_FS = /* glsl */ `
${GLSL_ATMO}
varying vec3 vC; varying float vDist;
void main(){ vec3 c = applyFog(vC, vDist); gl_FragColor = vec4(c,1.); ${GLSL_OUT} }`;
const instMaterial = () => new THREE.ShaderMaterial({ uniforms: atmoUniforms(), vertexShader: INST_VS, fragmentShader: INST_FS });

// ---- silhouette cutout boards -----------------------------------------------------------------
// One card = one seated fan. The card turns about its vertical axis to face the camera (and
// tips over when seen from above, so the fly-in from the map never sees it edge-on). Backs are
// near-black, like the heads in the seat-view photos (nest_山顶_0005, nest_山顶_0006): the nearest
// rows are plain dark shapes, a few rows further on a soft rim of show light picks out heads
// and shoulders, and far away it is gone again. Seen from the stage side they take the wash.
const CARD_VS = /* glsl */ `
${GLSL_ATMO}
attribute vec3 aPos; attribute vec4 aInfo;   // aInfo = variant, size, seed, lean (rad)
uniform float uFoot;
varying vec2 vUv; varying vec2 vQ; varying vec3 vTint; varying float vDist; varying float vFront; varying float vAtt; varying float vSeed; varying float vRim;
void main(){
  vec3 toCam = cameraPosition - aPos; float dc = max(length(toCam), 1e-3); vec3 n = toCam/dc;
  vec2 rxz = normalize(vec2(n.z, -n.x) + vec2(1e-5, 0.));
  vec3 right = vec3(rxz.x, 0., rxz.y);
  vec3 up = normalize(mix(vec3(0.,1.,0.), cross(n, right), smoothstep(.55,.95,n.y)));
  float seed = aInfo.z;
  float lean = aInfo.w + .022*sin(uT*(1.1+seed) + seed*50.);
  // Overdraw: a plain outline fills only the middle of its atlas cell (nothing above the head,
  // nothing beside the shoulders), so its quad is trimmed to that part. Only the cells with a
  // raised phone or stick need the whole cell. 38 % fewer alpha-tested fragments per plain card.
  vec2 trim = aInfo.x < ${SIL.plain}. ? vec2(${SIL.trimX}, ${SIL.trimY}) : vec2(1.);
  vec2 p = vec2(position.x*trim.x, position.y > 0. ? position.y*trim.y : position.y);
  float y = p.y >= 0. ? p.y*${SIL.h.toFixed(2)} : p.y*uFoot;
  vec2 q = vec2(p.x*${SIL.w.toFixed(2)}, y)*aInfo.y;
  q = vec2(q.x*cos(lean) - q.y*sin(lean), q.x*sin(lean) + q.y*cos(lean));
  vec3 wp = aPos + right*q.x + up*q.y;
  float var = aInfo.x; vec2 cell = vec2(mod(var, ${SIL.cols}.), floor(var/${SIL.cols}.));
  float u = p.x + .5; if (fract(seed*7.31) > .5) u = 1. - u;
  vUv = (cell + vec2(clamp(u,.02,.98), 1. - clamp(p.y, 0., .995)))/vec2(${SIL.cols}., ${SIL.rows}.);
  vQ = p; vSeed = seed;
  // clothes: mostly dark, some pale tops (the floor blocks read pale in nest_917_0005)
  float h = fract(seed*13.7), h2 = fract(seed*91.3);
  vTint = mix(vec3(.05,.055,.07), vec3(.62,.6,.6), h*h*h)*vec3(.8+.4*h2, .78+.4*fract(h2*7.), .78+.5*fract(h2*13.));
  vec3 Ld = vec3(0.,24.,0.) - aPos; float d = length(Ld);
  vAtt = 1./(1.+pow(d/80.,2.));
  vFront = smoothstep(-.35,.35, dot(normalize(toCam.xz + 1e-4), normalize(-aPos.xz + 1e-4)));
  vec4 mv = viewMatrix*vec4(wp,1.); vDist = length(mv.xyz);
  // Rim light by distance. A head that fills the screen (the row or two in front) gets none:
  // there a rim is a drawn outline, and the photos show plain dark out-of-focus shapes. It
  // comes in over the next rows (2.4 to 8 m) and fades again where a card is only a few pixels.
  vRim = .7*smoothstep(2.4, 8., dc)*(1. - smoothstep(9., 20., dc))*vAtt*mix(1., .3, vFront);
  gl_Position = projectionMatrix*mv;
}`;
const CARD_FS = /* glsl */ `
${GLSL_ATMO}
uniform sampler2D uAtlas;
varying vec2 vUv; varying vec2 vQ; varying vec3 vTint; varying float vDist; varying float vFront; varying float vAtt; varying float vSeed; varying float vRim;
void main(){
  vec3 amb = vec3(.030,.034,.048) + uCue*.03;
  vec3 c;
  if (vQ.y < 0.) {
    // chair back and legs under the card (floor blocks only)
    if (abs(vQ.x) > .37) discard;
    c = vec3(.03,.03,.034)*(amb + uCue*vAtt*.6);
  } else {
    vec4 t = texture2D(uAtlas, vUv);
    if (max(t.r, t.g) < .5) discard;
    // rim light: a soft band inside the cut edge, read from a blurrier mip (a glow, not a
    // line). Head and shoulders only. The second texture read is skipped where there is no rim.
    float rim = 0.;
    if (vRim > .004) {
      float soft = texture2D(uAtlas, vUv, 2.2).r;
      rim = (1. - smoothstep(.5,.95,soft))*smoothstep(.3,.5,vQ.y)*vRim;
    }
    vec3 back = vTint*amb*.22 + amb*.012;   // backs are near-black whatever the clothes
    vec3 front = vTint*(amb + uCue*vAtt*2.1 + vAtt*.3);
    // hair stays dark, the face catches the stage when seen from the front
    float head = smoothstep(.5,.56,vQ.y)*(1. - smoothstep(.13,.19,abs(vQ.x)));
    front = mix(front, vec3(.58,.42,.34)*(amb + uCue*vAtt*2.1 + vAtt*.3), head*.85);
    c = mix(back, front, vFront);
    c += rim*(uCue*.5 + vec3(.04));
    // phone screens are white-blue, light sticks warm white with a cue tint; both bloom
    float tw = .55 + .45*pow(.5 + .5*sin(uT*(1. + vSeed*3.) + vSeed*40.), 2.);
    vec3 glow = mix(uEdge, vec3(1.,.93,.88), .45)*2.1*tw;
    c = mix(c, glow, smoothstep(.35,.6,t.g));
  }
  c = applyFog(c, vDist);
  gl_FragColor = vec4(c,1.);
  ${GLSL_OUT}
}`;
function cardMesh(cap, foot = 0) {
  const g = new THREE.InstancedBufferGeometry();
  // two stacked quads: y 0..1 = one atlas cell, y -1..0 = chair block (height = uFoot metres)
  g.setAttribute("position", new THREE.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0, -0.5, -1, 0, 0.5, -1, 0], 3));
  g.setIndex(foot > 0 ? [0, 1, 2, 0, 2, 3, 4, 5, 1, 4, 1, 0] : [0, 1, 2, 0, 2, 3]);
  const aPos = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3), aInfo = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4);
  g.setAttribute("aPos", aPos);
  g.setAttribute("aInfo", aInfo);
  g.instanceCount = 0;
  const m = new THREE.Mesh(g, new THREE.ShaderMaterial({ side: THREE.DoubleSide, uniforms: atmoUniforms({ uAtlas: { value: silhouetteAtlas() }, uFoot: { value: foot } }), vertexShader: CARD_VS, fragmentShader: CARD_FS }));
  m.frustumCulled = false;
  m.name = "silhouettes";
  let n = 0;
  // r1..r3: three random numbers in 0..1 per fan
  const put = (x, y, z, r1, r2, r3) => {
    aPos.setXYZ(n, x, y, z);
    // about one fan in six holds up a phone or a light stick (nest_山顶_0005, nest_山顶_0006)
    const P = 0.84, variant = r1 < P ? Math.floor((r1 / P) * SIL.plain) : SIL.plain + Math.floor(((r1 - P) / (1 - P)) * (SIL.cols * SIL.rows - SIL.plain));
    aInfo.setXYZW(n++, variant, 0.93 + r2 * 0.14, r3, (r2 * 7.77 % 1 - 0.5) * 0.16);
  };
  const commit = (count = n) => {
    n = 0;
    g.instanceCount = count;
    aPos.needsUpdate = aInfo.needsUpdate = true;
  };
  return { mesh: m, put, commit, count: () => n };
}

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

// Seated audience on the floor blocks: rows of chairs facing the stage, one cutout board per
// fan (nest_526_0001, nest_801_0005, nest_917_0005). Leaves the picked seat empty.
const ROW_PITCH = 0.9, SEAT_PITCH = 0.5, SEAT_Y = 0.5;
export function FloorCrowd({ venue, density = 1 }) {
  const group = useMemo(() => {
    const r = lcg(23), floor = venue.sections.filter((s) => s.kind === "floor"), d = Math.max(0.05, Math.min(1, density)), spots = [];
    for (const s of floor) {
      const xs = s.points.map((p) => p[0]), zs = s.points.map((p) => p[1]);
      const x0 = Math.min(...xs), x1 = Math.max(...xs), z0 = Math.min(...zs), z1 = Math.max(...zs);
      // blocks beside the long faces look along z, blocks at the ends look along x
      const alongX = Math.abs(s.center.z) > venue.stage.halfZ;
      const [du, dv] = alongX ? [SEAT_PITCH, ROW_PITCH] : [ROW_PITCH, SEAT_PITCH];
      for (let x = x0 + 0.35; x < x1 - 0.2; x += du)
        for (let z = z0 + 0.35; z < z1 - 0.2; z += dv) {
          const keep = r() < 0.55 + 0.45 * d * d, a = r(), b = r(), c = r();
          if (!keep || r() > 0.97) continue;
          if (Math.hypot(x - s.seat.x, z - s.seat.z) > 0.7) spots.push([x + (a - 0.5) * 0.08, z + (b - 0.5) * 0.08, a, b, c]);
        }
    }
    const cards = cardMesh(Math.max(1, spots.length), SEAT_Y), pos = [], seeds = [];
    for (const [x, z, a, b, c] of spots) {
      cards.put(x, 0.05 + SEAT_Y, z, a, b, c);
      if (r() < 0.14) pos.push(x + (r() - 0.5) * 0.3, 1.25 + r() * 0.4, z + (r() - 0.5) * 0.3), seeds.push(r());
    }
    cards.commit();
    const g = new THREE.Group();
    g.name = "floor-crowd";
    g.add(cards.mesh, stickPoints(pos, seeds));
    return g;
  }, [venue, density]);
  return <primitive object={group} />;
}

// ---- near-seat LOD: real steps, tip-up seats and neighbours around a bowl POV ---------------
const PATCH_R = 7.5, PATCH_FWD = 3.5, CAP = 620;
export function NearSeats({ venue, section, enabled = true }) {
  const kit = useMemo(() => {
    const box = new THREE.BoxGeometry(1, 1, 1);
    const g = new THREE.Group();
    g.name = "near-seats";
    const tread = instanced(box, instMaterial(false), CAP), back = instanced(box, instMaterial(false), CAP), pan = instanced(box, instMaterial(false), CAP), cards = cardMesh(CAP);
    g.add(tread, back, pan, cards.mesh);
    return { g, tread, back, pan, cards };
  }, []);
  useEffect(() => {
    const { tread, back, pan, cards } = kit, spec = venue.bowl;
    const off = () => {
      tread.count = back.count = pan.count = 0;
      cards.commit(0);
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
    let nT = 0, nS = 0;
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
        const hOcc = r(), h1 = r(), h2 = r(), h3 = r();
        // everyone sits: the card stands on the seat pan, in front of the seat back
        if (hOcc < occ(t.key, section.slot, d) && Math.hypot(p[0] - seat.x, p[2] - seat.z) > 0.75) cards.put(p[0] - Z.x * depth * 0.2, top + 0.45, p[2] - Z.z * depth * 0.2, h1, h2, h3);
      }
    }
    tread.count = nT;
    back.count = pan.count = nS;
    cards.commit();
    for (const m of [tread, back, pan]) (m.instanceMatrix.needsUpdate = true), (m.instanceColor.needsUpdate = true);
    return undefined;
  }, [kit, venue, section, enabled]);
  return <primitive object={kit.g} />;
}
