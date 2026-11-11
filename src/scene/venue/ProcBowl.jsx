// Procedural stadium bowl. Zero bytes of geometry are downloaded: everything is built at
// start-up from the venue spec (src/venues.js → venue.bowl), which reuses the approved tier
// rings and the cited roof figures. Three draw calls carry the whole bowl:
//   stands  – sloped tier surfaces; seats, people, aisles and vomitories are drawn in the
//             fragment shader per seat cell and fade to their mean colour with distance
//             (the "impostor" LOD: no aliasing, no extra triangles),
//   struct  – concrete, fascias, concourses, roof steel + membrane, with stage light and AO
//             baked per vertex (multiplied by the cue colour at runtime),
//   ribbons – LED ribbon boards on the tier fascias (the only emissive part).
import { useMemo } from "react";
import * as THREE from "three";
import { bowlPoint } from "../../venues.js";
import { atmoUniforms, GLSL_ATMO, GLSL_OUT, bakeLight } from "../atmo.js";

const lcg = (seed) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const HINT = [0, 30, 0];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

// Mesh builder for the baked "struct" material.
class MB {
  p = [];
  c = [];
  l = [];
  quad(a, b, c, d, col, { glow = [0, 0, 0], ao = 1, two = false, out = false, light } = {}) {
    let n = norm(cross(sub(b, a), sub(d, a)));
    const toward = (HINT[0] - a[0]) * n[0] + (HINT[1] - a[1]) * n[1] + (HINT[2] - a[2]) * n[2];
    if (toward < 0 !== out) n = [-n[0], -n[1], -n[2]];
    for (const v of [a, b, c, a, c, d]) {
      this.p.push(v[0], v[1], v[2]);
      this.c.push(col[0] * ao, col[1] * ao, col[2] * ao);
      this.l.push(light ?? (out ? 0.02 : bakeLight(v, n, two) * ao), glow[0], glow[1], glow[2]);
    }
  }
  // box section along a segment (4 long faces, no caps)
  beam(p0, p1, w, h, col, opts) {
    const dir = norm(sub(p1, p0));
    let side = cross(dir, [0, 1, 0]);
    if (Math.hypot(...side) < 1e-4) side = [1, 0, 0];
    side = norm(side);
    const up = norm(cross(side, dir));
    const c = (p, sx, sy) => [p[0] + side[0] * sx * w * 0.5 + up[0] * sy * h * 0.5, p[1] + side[1] * sx * w * 0.5 + up[1] * sy * h * 0.5, p[2] + side[2] * sx * w * 0.5 + up[2] * sy * h * 0.5];
    for (const [s0, t0, s1, t1] of [[-1, -1, 1, -1], [1, -1, 1, 1], [1, 1, -1, 1], [-1, 1, -1, -1]]) this.quad(c(p0, s0, t0), c(p0, s1, t1), c(p1, s1, t1), c(p1, s0, t0), col, { ...opts, two: true });
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute("aCol", new THREE.Float32BufferAttribute(this.c, 3));
    g.setAttribute("aLG", new THREE.Float32BufferAttribute(this.l, 4));
    g.computeBoundingSphere();
    return g;
  }
}

const STRUCT_VS = /* glsl */ `
attribute vec3 aCol; attribute vec4 aLG;
varying vec3 vCol; varying vec4 vLG; varying float vDist; varying vec3 vW;
void main(){
  vec4 wp = modelMatrix*vec4(position,1.);
  #ifdef USE_INSTANCING
    wp = modelMatrix*instanceMatrix*vec4(position,1.);
  #endif
  vec4 mv = viewMatrix*wp; vW = wp.xyz; vDist = length(mv.xyz); vCol = aCol; vLG = aLG;
  gl_Position = projectionMatrix*mv;
}`;
const STRUCT_FS = /* glsl */ `
${GLSL_ATMO}
uniform float uRoofY;
varying vec3 vCol; varying vec4 vLG; varying float vDist; varying vec3 vW;
void main(){
  vec3 amb = vec3(.030,.034,.048) + uCue*.03;
  // the roof is lit from below by the show; seen from above (map fly-in) only a little leaks through
  float L = vLG.x * ((vW.y > uRoofY && cameraPosition.y > vW.y + 4.) ? .16 : 1.);
  vec3 c = vCol*(amb + uCue*L*1.5 + L*.22) + vLG.yzw;
  c = applyFog(c, vDist);
  gl_FragColor = vec4(c,1.);
  ${GLSL_OUT}
}`;
export const structMaterial = (roofY = 1e4) => new THREE.ShaderMaterial({ side: THREE.DoubleSide, uniforms: atmoUniforms({ uRoofY: { value: roofY } }), vertexShader: STRUCT_VS, fragmentShader: STRUCT_FS });

// ---- field (per-fragment: turf / track / apron, radial stage light, roaming light pools) ----
const FLOOR_FS = /* glsl */ `
${GLSL_ATMO}
uniform vec4 uField;
varying vec3 vCol; varying vec4 vLG; varying float vDist; varying vec3 vW;
void main(){
  vec2 q = vW.xz;
  float e1 = length(q/uField.xy);
  float e2 = uField.z > 0. ? length(q/uField.zw) : 0.;
  vec3 turf = vec3(.035,.135,.09)*(.86+.14*step(.5,fract(q.x/9.)));
  vec3 track = vec3(.42,.10,.085);
  float lane = uField.z > 0. ? smoothstep(.0,.004,abs(fract((e2-e1)*9.)-.5)-.47) : 0.;
  track = mix(track, vec3(.8,.75,.6), lane*.6);
  vec3 alb = e1 < 1. ? turf : (uField.z > 0. && e2 < 1.) ? track : vec3(.11,.12,.13);
  float r = length(q);
  float L = 1./(1.+pow(r/62.,2.));
  float pools = 0.;
  for(int i=0;i<4;i++){ float fi = float(i); vec2 c = vec2(sin(uT*.21+fi*1.7), cos(uT*.17+fi*2.3))*vec2(70.,46.); vec2 d = q-c; pools += exp(-dot(d,d)/300.); }
  vec3 amb = vec3(.030,.034,.048) + uCue*.03;
  vec3 c = alb*(amb + uCue*(L*1.6 + pools*.55) + L*.2);
  c = applyFog(c, vDist);
  gl_FragColor = vec4(c,1.);
  ${GLSL_OUT}
}`;

// ---- stands: seats / people / aisles / vomitories drawn per seat cell in the shader ----
const STAND_VS = /* glsl */ `
attribute vec2 aUV; attribute vec4 aSec; attribute vec2 aFace;
varying vec2 vUV; varying vec4 vSec; varying float vFacing; varying float vDist; varying vec3 vW;
void main(){
  vec4 wp = modelMatrix*vec4(position,1.);
  vec4 mv = viewMatrix*wp; vW = wp.xyz; vDist = length(mv.xyz); vUV = aUV; vSec = aSec;
  vFacing = dot(normalize(cameraPosition.xz - wp.xz), aFace);
  gl_Position = projectionMatrix*mv;
}`;
const STAND_FS = /* glsl */ `
${GLSL_ATMO}
uniform vec3 uSeatCol0, uSeatCol1, uSeatCol2; uniform vec3 uVom;
varying vec2 vUV; varying vec4 vSec; varying float vFacing; varying float vDist; varying vec3 vW;
void main(){
  if (uSeat.z > 0. && distance(vW.xz, uSeat.xy) < uSeat.z) discard;
  float tier = floor(vSec.w + .5);
  vec3 sc = tier < .5 ? uSeatCol0 : tier < 1.5 ? uSeatCol1 : uSeatCol2;
  float vom0 = tier < .5 ? uVom.x : tier < 1.5 ? uVom.y : uVom.z;
  vec2 g = vec2(vUV.x*2., vUV.y);
  vec2 cell = floor(g), f = fract(g);
  vec2 fwv = fwidth(g);
  float detail = 1. - smoothstep(.28, .85, max(fwv.x, fwv.y));
  float h = hash12(cell), h2 = hash12(cell+71.7), h3 = hash12(cell+13.1);
  float face = clamp(vFacing*.5+.5, 0., 1.);       // 1 = we look at this stand from the front
  float occP = vSec.y;
  float occ = step(h2, occP);
  // one person per cell: clothing blob + head; faces catch the stage light, backs stay dark
  vec2 p = f - .5;
  float blob = 1. - smoothstep(.22, .5, length(p*vec2(1.,1.1)));
  float head = 1. - smoothstep(.09, .19, length(p - vec2(0.,.14)));
  vec3 cloth = mix(vec3(.035,.04,.055), vec3(.62,.58,.56), h*h*h) * vec3(.75+.5*h3, .72+.5*fract(h3*7.), .72+.6*fract(h3*13.));
  vec3 skin = mix(vec3(.025,.02,.02), vec3(.60,.44,.35), face);
  vec3 person = mix(cloth*(.5+.5*face), skin, head)*blob;
  // empty seat: tip-up seat with a gap to its neighbours
  float sb = step(.07,f.x)*step(f.x,.93)*step(.22,f.y)*step(f.y,.86);
  vec3 seat = mix(vec3(.035), sc*(.75+.25*h), sb);
  vec3 det = mix(seat, person + seat*.12*(1.-blob), occ);
  det *= .5 + .5*smoothstep(0., .2, f.y);          // riser shadow between rows
  vec3 avgP = vec3(.078,.074,.078)*(.5+.5*face) + vec3(.012,.008,.006)*face;
  vec3 avg = mix(sc*.62 + .01, avgP, occP*.97)*.86;
  vec3 alb = mix(avg, det, detail);
  // radial aisles between sections
  float edge = vSec.x - abs(vUV.x);
  float aisle = 1. - smoothstep(.5, .62, edge);
  vec3 stair = vec3(.105,.11,.12)*(.62+.38*mix(1., step(.14,f.y), detail));
  alb = mix(alb, stair, aisle);
  // vomitory: dark portal with a warm-lit mouth
  float vr = (vUV.y - vom0)/4.5;
  float vom = step(abs(vUV.x), 1.7)*step(0., vr)*step(vr, 1.)*step(6., vSec.x);
  float frame = vom*(1.-step(abs(vUV.x),1.5)*step(.08,vr)*step(vr,.94));
  alb = mix(alb, vec3(.012), vom);
  vec3 amb = vec3(.030,.034,.048) + uCue*.03;
  vec3 c = alb*(amb + uCue*vSec.z*1.7 + vSec.z*.28);
  c += vom*(1.-frame)*vec3(1.,.6,.3)*.10*smoothstep(.45,1.,vr) + frame*vec3(.03);
  c += aisle*detail*step(.5,fract(cell.y*.5))*(1.-smoothstep(.02,.07,abs(f.y-.1)))*step(edge,.12)*vec3(1.,.8,.5)*.6;
  // light sticks (near: one dot per fan; far: their mean glow). Sparkle comes from the point crowd.
  float st = occ*step(.6,h3);
  float tw = .35+.65*pow(.5+.5*sin(uT*(1.+h*3.)+h*40.),3.);
  float dotm = 1.-smoothstep(.03,.11,length(f-vec2(.28+.44*h,.74)));
  vec3 stick = mix(uEdge, vec3(1.), step(.9,h)*.7);
  c += mix(uEdge*occP*.022, stick*st*dotm*tw*2.2, detail)*(1.-aisle)*(1.-vom);
  c = applyFog(c, vDist);
  gl_FragColor = vec4(c,1.);
  ${GLSL_OUT}
}`;

const RIBBON_VS = /* glsl */ `
attribute vec2 aUV; varying vec2 vUV; varying float vDist;
void main(){ vec4 mv = modelViewMatrix*vec4(position,1.); vDist = length(mv.xyz); vUV = aUV; gl_Position = projectionMatrix*mv; }`;
const RIBBON_FS = /* glsl */ `
${GLSL_ATMO}
varying vec2 vUV; varying float vDist;
void main(){
  float px = mix(1., smoothstep(.12,.3,abs(fract(vUV.x*4.)-.5)) , 1.-smoothstep(.2,.8,fwidth(vUV.x*4.)));
  float chase = .55+.45*sin(vUV.x*.045 - uT*1.3);
  float band = smoothstep(0.,.12,vUV.y)*smoothstep(1.,.88,vUV.y);
  vec3 c = uEdge*(1.9*chase*px*band) + vec3(.01);
  c = applyFog(c, vDist);
  gl_FragColor = vec4(c,1.);
  ${GLSL_OUT}
}`;

// ---------------------------------------------------------------------------------------
export const tierPoint = (spec, t, d, th) => {
  const [x, z] = bowlPoint(spec.eps, t.i[0] + (t.o[0] - t.i[0]) * d, t.i[1] + (t.o[1] - t.i[1]) * d, th);
  return [x, t.y[0] + (t.y[1] - t.y[0]) * d, z];
};
export const tierRows = (t) => Math.max(8, Math.round((t.o[0] - t.i[0] + (t.o[1] - t.i[1])) / 2 / 0.85));
export const slotIds = (spec) => [...Array(spec.slots).keys()].map((i) => i + (spec.slotBase ?? 0));

// Which radial ranges of each (tier, slot) are on sale → crowd; everything else → empty seats.
export function occupancy(venue) {
  const map = {};
  for (const s of venue.sections) if (s.kind === "bowl" && !s.unsold) (map[`${s.tier}:${s.slot}`] ??= []).push(s.d);
  return (tierKey, slot, d) => (map[`${tierKey}:${slot}`]?.some(([a, b]) => d >= a && d <= b) ? 0.94 : 0);
}

function buildStands(venue, detail) {
  const spec = venue.bowl, occ = occupancy(venue);
  const pos = [], uv = [], sec = [], face = [];
  const SEG = detail >= 1 ? 4 : 2, BANDS = 8, half = Math.PI / spec.slots;
  spec.tiers.forEach((t, ti) => {
    const rows = tierRows(t);
    for (const slot of slotIds(spec)) {
      const thc = spec.theta(slot);
      const rloc = (d) => {
        const a = tierPoint(spec, t, d, thc - 0.001), b = tierPoint(spec, t, d, thc + 0.001);
        return Math.hypot(b[0] - a[0], b[2] - a[2]) / 0.002;
      };
      const c0 = tierPoint(spec, t, 0.5, thc), fl = Math.hypot(c0[0], c0[2]), fx = -c0[0] / fl, fz = -c0[2] / fl;
      for (let b = 0; b < BANDS; b++) {
        const d0 = b / BANDS, d1 = (b + 1) / BANDS, o = occ(t.key, slot, (d0 + d1) / 2), r0 = rloc(d0), r1 = rloc(d1);
        for (let s = 0; s < SEG; s++) {
          const a0 = -half + (2 * half * s) / SEG, a1 = -half + (2 * half * (s + 1)) / SEG;
          const P = [[d0, a0, r0], [d0, a1, r0], [d1, a1, r1], [d1, a0, r1]].map(([d, a, r]) => ({ p: tierPoint(spec, t, d, thc + a), u: a * r, v: d * rows, hw: half * r }));
          const n = norm(cross(sub(P[1].p, P[0].p), sub(P[3].p, P[0].p)));
          if (n[1] < 0) n.forEach((_, i) => (n[i] = -n[i]));
          for (const k of [0, 1, 2, 0, 2, 3]) {
            const q = P[k];
            pos.push(...q.p);
            uv.push(q.u, q.v);
            sec.push(q.hw, o, bakeLight(q.p, n), ti);
            face.push(fx, fz);
          }
        }
      }
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("aUV", new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute("aSec", new THREE.Float32BufferAttribute(sec, 4));
  g.setAttribute("aFace", new THREE.Float32BufferAttribute(face, 2));
  g.computeBoundingSphere();
  return g;
}

const CONCRETE = [0.13, 0.135, 0.14], DARK = [0.05, 0.052, 0.058], RAIL = [0.34, 0.36, 0.38];

function buildStructure(venue, detail) {
  const spec = venue.bowl, mb = new MB(), rib = { p: [], uv: [] };
  const S = detail >= 1 ? 256 : detail >= 0.6 ? 160 : 96;
  const ringPt = (a, b, y, th) => {
    const [x, z] = bowlPoint(spec.eps, a, b, th);
    return [x, typeof y === "function" ? y(th) : y, z];
  };
  const band = (A, B, col, opts = {}, segs = S) => {
    for (let i = 0; i < segs; i++) {
      const t0 = (i / segs) * Math.PI * 2, t1 = ((i + 1) / segs) * Math.PI * 2;
      const c = typeof col === "function" ? col(i) : col;
      mb.quad(ringPt(A.a, A.b, A.y, t0), ringPt(A.a, A.b, A.y, t1), ringPt(B.a, B.b, B.y, t1), ringPt(B.a, B.b, B.y, t0), c, opts);
    }
  };
  const ribbon = (a, b, y0, y1) => {
    let u = 0;
    for (let i = 0; i < S; i++) {
      const t0 = (i / S) * Math.PI * 2, t1 = ((i + 1) / S) * Math.PI * 2;
      const p0 = ringPt(a, b, y0, t0), p1 = ringPt(a, b, y0, t1), len = Math.hypot(p1[0] - p0[0], p1[2] - p0[2]);
      const q0 = [p0[0], y1, p0[2]], q1 = [p1[0], y1, p1[2]];
      rib.p.push(...p0, ...p1, ...q1, ...p0, ...q1, ...q0);
      rib.uv.push(u, 0, u + len, 0, u + len, 1, u, 0, u + len, 1, u, 1);
      u += len;
    }
  };
  const T = spec.tiers;
  // front wall + parapet of the lower tier
  band({ a: T[0].i[0], b: T[0].i[1], y: 0 }, { a: T[0].i[0], b: T[0].i[1], y: T[0].y[0] + 1 }, DARK, { ao: 0.8 });
  band({ a: T[0].i[0], b: T[0].i[1], y: T[0].y[0] + 1 }, { a: T[0].i[0] + 0.25, b: T[0].i[1] + 0.25, y: T[0].y[0] + 1.02 }, RAIL);
  // concourse walkway + fascia wall + LED ribbon + handrail between tiers (closes the tier gaps)
  for (let k = 0; k < T.length - 1; k++) {
    const lo = T[k], up = T[k + 1], yb = Math.min(lo.y[1], up.y[0] - 2.2), yt = up.y[0] + 1;
    band({ a: lo.o[0], b: lo.o[1], y: lo.y[1] }, { a: up.i[0], b: up.i[1], y: lo.y[1] }, CONCRETE, { ao: 0.55 });
    band({ a: up.i[0], b: up.i[1], y: yb }, { a: up.i[0], b: up.i[1], y: yt }, DARK, { ao: 0.9 });
    band({ a: up.i[0], b: up.i[1], y: yt }, { a: up.i[0] + 0.3, b: up.i[1] + 0.3, y: yt + 0.02 }, RAIL);
    // dark back wall of the concourse behind the lower tier's last row
    band({ a: lo.o[0], b: lo.o[1], y: lo.y[1] }, { a: lo.o[0], b: lo.o[1], y: lo.y[1] + 1.05 }, DARK, { ao: 0.7 });
    ribbon(up.i[0] - 0.12, up.i[1] - 0.12, up.y[0] - 0.75, up.y[0] + 0.25);
  }
  // back wall behind the top tier
  const top = T[T.length - 1], wallTop = top.y[1] + 4.5;
  band({ a: top.o[0], b: top.o[1], y: top.y[1] }, { a: top.o[0], b: top.o[1], y: wallTop }, (i) => (i % 4 === 0 ? [0.09, 0.095, 0.1] : DARK), { ao: 0.9 });
  band({ a: top.o[0], b: top.o[1], y: wallTop }, { a: top.o[0] + 0.4, b: top.o[1] + 0.4, y: wallTop + 0.02 }, RAIL);

  const roof = spec.roof, rnd = lcg(91);
  if (roof.type === "wuxi") {
    const N = roof.trusses, STEEL = [0.56, 0.62, 0.64], IVORY = [0.8, 0.84, 0.82];
    const at = (th, f, dy = 0) => {
      const [xi, zi] = bowlPoint(0, roof.inner[0], roof.inner[1], th), [xo, zo] = bowlPoint(0, roof.outer[0], roof.outer[1], th);
      return [xi + (xo - xi) * f, roof.y(th) + 1.0 * f + 1.6 * Math.sin(Math.PI * f) + dy, zi + (zo - zi) * f];
    };
    const fm = (th) => {
      const a = at(th, 0), b = at(th, 1);
      return Math.min(0.62, roof.membraneDepth / Math.hypot(b[0] - a[0], b[2] - a[2]));
    };
    const dth = (Math.PI * 2) / N;
    for (let i = 0; i < N; i++) {
      const th = i * dth, thm = th + dth / 2, th1 = th + dth, f0 = fm(th), fmid = fm(thm), f1 = fm(th1);
      // cantilever truss: deep at the root, slender at the tip
      mb.beam(at(th, 1, -1.4), at(th, f0, -0.8), 0.9, 3.2, STEEL);
      mb.beam(at(th, f0, -0.5), at(th, 0, -0.3), 0.7, 1.3, STEEL);
      // inner cable-membrane ring: folded plate (ridge on each truss, valley between)
      const R = 3;
      for (let r = 0; r < R; r++) {
        const a = r / R, b = (r + 1) / R, shade = 0.9 + 0.1 * rnd();
        const col = IVORY.map((v) => v * shade);
        mb.quad(at(th, f0 * a), at(th, f0 * b), at(thm, fmid * b, -1.3), at(thm, fmid * a, -1.3), col, { two: true });
        mb.quad(at(thm, fmid * a, -1.3), at(thm, fmid * b, -1.3), at(th1, f1 * b), at(th1, f1 * a), col.map((v) => v * 0.9), { two: true });
      }
      // outer roof deck (standing-seam metal)
      const deck = i % 2 ? [0.2, 0.22, 0.23] : [0.17, 0.19, 0.2];
      mb.quad(at(th, f0), at(th, 1), at(th1, 1), at(th1, f1), deck, { two: true });
      // tension ring + dimmed house floodlight bank at the inner edge
      mb.beam(at(th, 0, -0.4), at(th1, 0, -0.4), 0.8, 1.2, STEEL);
      mb.quad(at(th + dth * 0.3, 0.012, -1.1), at(th + dth * 0.7, 0.012, -1.1), at(th + dth * 0.7, 0.012, -1.6), at(th + dth * 0.3, 0.012, -1.6), [0.1, 0.1, 0.1], { glow: [0.5, 0.46, 0.38] });
      // column from the back of the top tier up to the truss root
      mb.beam(ringPt(top.o[0] + 1, top.o[1] + 1, wallTop - 1, th), at(th, 0.92, -2.4), 0.9, 0.9, [0.2, 0.22, 0.23]);
    }
    // façade: plinth + finned belt, then the soffit up to the roof edge
    const F = roof.facade;
    band({ a: F[0], b: F[1], y: 0 }, { a: F[0] + 2, b: F[1] + 2, y: 46 }, (i) => (i % 5 === 0 ? [0.42, 0.5, 0.52] : [0.11, 0.15, 0.17]), { out: true, glow: [0.012, 0.016, 0.022] });
    for (let i = 0; i < S; i++) {
      const t0 = (i / S) * Math.PI * 2, t1 = ((i + 1) / S) * Math.PI * 2;
      mb.quad(ringPt(F[0] + 2, F[1] + 2, 46, t0), ringPt(F[0] + 2, F[1] + 2, 46, t1), at(t1, 1, -1.5), at(t0, 1, -1.5), [0.3, 0.34, 0.35], { out: true, glow: [0.01, 0.013, 0.018] });
    }
  } else {
    const [oa, ob] = roof.opening, [ra, rb] = roof.outer, y = roof.y, STEEL = [0.66, 0.72, 0.74], PANEL = [0.74, 0.79, 0.8];
    // translucent inner ceiling: irregular cushion panels
    const R = 4;
    for (let r = 0; r < R; r++) {
      const A = (r / R) ** 0.9, B = ((r + 1) / R) ** 0.9;
      const ring = (f) => ({ a: oa + (ra - oa) * f, b: ob + (rb - ob) * f, y: y - 1.6 + 1.6 * f });
      let shade = 1, run = 0;
      band(ring(A), ring(B), () => {
        if (run-- <= 0) (shade = 0.8 + 0.2 * rnd()), (run = 1 + Math.floor(rnd() * 5));
        return PANEL.map((v) => v * shade);
      }, { two: true });
    }
    band({ a: oa, b: ob, y: y - 3.2 }, { a: oa, b: ob, y: y - 1.2 }, STEEL, { two: true });
    // primary trusses: from each of the 24 columns, tangent to the roof opening
    const outerAt = (th) => [ra * Math.cos(th), y - 0.4, rb * Math.sin(th)];
    const chord = (P, dirx, dirz) => {
      // far intersection of the ray P + t·dir with the outer ellipse
      const A = (dirx / ra) ** 2 + (dirz / rb) ** 2, Bq = 2 * ((P[0] * dirx) / ra ** 2 + (P[2] * dirz) / rb ** 2);
      const t = -Bq / A;
      return [P[0] + dirx * t, P[1], P[2] + dirz * t];
    };
    for (let j = 0; j < roof.columns; j++) {
      const th = ((j + 0.5) / roof.columns) * Math.PI * 2, P = outerAt(th);
      const ux = P[0] / (oa * 1.04), uz = P[2] / (ob * 1.04), D = Math.hypot(ux, uz), phi = Math.atan2(uz, ux), al = Math.acos(1 / D);
      for (const sgn of [-1, 1]) {
        const Tn = [oa * 1.04 * Math.cos(phi + sgn * al), 0, ob * 1.04 * Math.sin(phi + sgn * al)];
        mb.beam(P, chord(P, Tn[0] - P[0], Tn[2] - P[2]), 2.2, 3.4, STEEL, { glow: [0.012, 0.012, 0.014] });
      }
    }
    // secondary members: chords that stay clear of the opening
    for (let k = 0, made = 0; made < (detail >= 1 ? 46 : 20) && k < 600; k++) {
      const a = rnd() * Math.PI * 2, b = a + 0.5 + rnd() * 1.3, P = outerAt(a), Q = outerAt(b);
      let clear = true;
      for (let s = 1; s < 12 && clear; s++) {
        const m = lerp3(P, Q, s / 12);
        if (Math.hypot(m[0] / oa, m[2] / ob) < 1.08) clear = false;
      }
      if (!clear) continue;
      made++;
      mb.beam(P, Q, 1.4, 2.4, STEEL.map((v) => v * 0.9));
    }
    // outer shell: 24 leaning columns each way + hoops, following the bulged profile
    const sc = (yy) => Math.max(0.74, 1 - 0.121 * ((y - yy) / 26) ** 1.45);
    const shellPt = (th, yy) => [ra * sc(yy) * Math.cos(th), yy, rb * sc(yy) * Math.sin(th)];
    const WARM = [0.2, 0.05, 0.028];
    const member = (thA, thB, w) => {
      const K = 7;
      for (let s = 0; s < K; s++) mb.beam(shellPt(thA + ((thB - thA) * s) / K, (y * s) / K), shellPt(thA + ((thB - thA) * (s + 1)) / K, (y * (s + 1)) / K), w, w, STEEL, { out: true, glow: WARM.map((v) => v * (1 - (0.7 * s) / K)) });
    };
    const step = (Math.PI * 2) / roof.columns;
    for (let j = 0; j < roof.columns; j++) {
      member(j * step, j * step + step * 1.6, 1.6);
      member(j * step, j * step - step * 1.6, 1.6);
      if (detail >= 0.6) member((j + 0.5) * step, (j + 0.5) * step + step * (rnd() * 2 - 1) * 2.4, 1.1);
    }
    for (const hy of [30, 55, 68, 80.5]) for (let i = 0; i < 96; i++) mb.beam(shellPt((i / 96) * Math.PI * 2, hy), shellPt(((i + 1) / 96) * Math.PI * 2, hy), 1.3, 1.3, STEEL, { out: true, glow: WARM.map((v) => v * 0.5) });
    // closing wall from the top-tier back wall to the roof rim
    band({ a: top.o[0] + 0.4, b: top.o[1] + 0.4, y: wallTop }, { a: ra * 0.985, b: rb * 0.985, y: y - 0.2 }, (i) => (i % 3 === 0 ? [0.07, 0.07, 0.08] : [0.03, 0.03, 0.035]), { ao: 0.8 });
  }

  const ribGeo = new THREE.BufferGeometry();
  ribGeo.setAttribute("position", new THREE.Float32BufferAttribute(rib.p, 3));
  ribGeo.setAttribute("aUV", new THREE.Float32BufferAttribute(rib.uv, 2));
  return { struct: mb.geometry(), ribbons: ribGeo };
}

// Wuxi cable net (CITED: 128 radial cables, 6 hoop cables) as hair-lines under the membrane.
function buildCables(venue) {
  const spec = venue.bowl, roof = spec.roof;
  if (roof.type !== "wuxi") return null;
  const mb = new MB(), col = [0.8, 0.85, 0.84];
  const at = (th, f) => {
    const [xi, zi] = bowlPoint(0, roof.inner[0], roof.inner[1], th), [xo, zo] = bowlPoint(0, roof.outer[0], roof.outer[1], th);
    return [xi + (xo - xi) * f, roof.y(th) + 1.0 * f + 1.6 * Math.sin(Math.PI * f) - 2.1, zi + (zo - zi) * f];
  };
  const seg = (a, b) => {
    for (const v of [a, b]) {
      mb.p.push(...v);
      mb.c.push(...col);
      mb.l.push(0.35, 0.02, 0.022, 0.024);
    }
  };
  const fm = 0.44;
  for (let i = 0; i < roof.radialCables; i++) {
    const th = (i / roof.radialCables) * Math.PI * 2;
    seg(at(th, 0), at(th, fm));
  }
  for (let h = 0; h < roof.hoops; h++) for (let i = 0; i < 128; i++) seg(at((i / 128) * Math.PI * 2, (fm * h) / roof.hoops), at(((i + 1) / 128) * Math.PI * 2, (fm * h) / roof.hoops));
  return mb.geometry();
}

function buildField(venue) {
  const spec = venue.bowl, t = spec.tiers[0], p = [], S = 96;
  for (let i = 0; i < S; i++) {
    const a = bowlPoint(spec.eps, t.i[0], t.i[1], (i / S) * Math.PI * 2), b = bowlPoint(spec.eps, t.i[0], t.i[1], ((i + 1) / S) * Math.PI * 2);
    p.push(0, 0.03, 0, a[0], 0.03, a[1], b[0], 0.03, b[1]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
  const n = p.length / 3;
  g.setAttribute("aCol", new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3));
  g.setAttribute("aLG", new THREE.Float32BufferAttribute(new Float32Array(n * 4), 4));
  return g;
}

// bowl: "glb" (full detail) | "lite" | "stub" — tier names kept from the approved quality table.
export function ProcBowl({ venue, bowl = "glb" }) {
  const detail = bowl === "glb" ? 1 : bowl === "lite" ? 0.6 : 0.35;
  const parts = useMemo(() => {
    const spec = venue.bowl;
    const { struct, ribbons } = buildStructure(venue, detail);
    const sm = structMaterial(spec.roof.type === "wuxi" ? 60 : 76);
    const col = (i) => ({ value: new THREE.Color(...spec.seatColors[i]) });
    const stands = new THREE.Mesh(
      buildStands(venue, detail),
      new THREE.ShaderMaterial({
        side: THREE.DoubleSide,
        uniforms: atmoUniforms({ uSeatCol0: col(0), uSeatCol1: col(1), uSeatCol2: col(2), uVom: { value: new THREE.Vector3(...spec.tiers.map((t) => Math.round(tierRows(t) * 0.42))) } }),
        vertexShader: STAND_VS,
        fragmentShader: STAND_FS,
      })
    );
    const f = spec.field;
    const field = new THREE.Mesh(buildField(venue), new THREE.ShaderMaterial({ uniforms: atmoUniforms({ uField: { value: new THREE.Vector4(f.turf[0], f.turf[1], f.track?.[0] ?? 0, f.track?.[1] ?? 0) } }), vertexShader: STRUCT_VS, fragmentShader: FLOOR_FS }));
    const rib = new THREE.Mesh(ribbons, new THREE.ShaderMaterial({ side: THREE.DoubleSide, uniforms: atmoUniforms(), vertexShader: RIBBON_VS, fragmentShader: RIBBON_FS }));
    const out = [field, new THREE.Mesh(struct, sm), stands, rib];
    const cables = detail >= 0.6 && buildCables(venue);
    if (cables) out.push(new THREE.LineSegments(cables, sm));
    out.forEach((o) => (o.matrixAutoUpdate = false));
    return out;
  }, [venue, detail]);
  return <group name="bowl">{parts.map((o, i) => <primitive key={i} object={o} />)}</group>;
}
