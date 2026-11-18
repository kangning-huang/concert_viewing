import gzHot from "./ui/damai/ganzhouDamaiHotspots.json" with { type: "json" };
import kmHot from "./ui/damai/kunmingDamaiHotspots.json" with { type: "json" };
// Venue data — reconstructed 1:1 from the c941445 bundle.
// Each section is individually pickable; picking a section flies the camera to
// that section's seat point (`seat`).

// ============================ 鸟巢 (Nest) ============================
// Tier heights (y0 = front row, rise = front row to back row, metres above the field) were
// lowered in the gaps pass: the old bowl put the top row at 70 m, higher than the real roof.
// Now the top-row eye sits at 46.2 m = 129.90 m x tan(19°35'), the two maxima cited in
// docs/refs/BOWL_PARAMS.md [N4]; the photo fit of nest_山顶_0005 gives 41-43 m a few rows
// lower. The split between the tiers follows nest_首场_0002. The plan (r0, r1) is unchanged.
const NEST_TIERS = { lower: { r0: 53, r1: 97, y0: 2, rise: 11.5 }, mid: { r0: 101, r1: 132, y0: 14.5, rise: 12.5 }, upper: { r0: 136, r1: 164, y0: 30.5, rise: 14 } };
const NEST_TIERS_R1 = 164;
const NEST_SQUASH = 0.79;
// 3D plan only (Blender pass): the map rings above put the end seats up to 164 m from the
// field centre, but the farthest seat is CITED at 129.90 m ([N4], docs/refs/BOWL_PARAMS.md).
// The long axis of every 3D ring is therefore pulled in linearly between the unchanged front
// edge (53 m, unknown, kept) and the cited 129.90 m at the back of the top tier; the short
// axis (r x 0.79, top row 129.6 m) already fits and is unchanged. The 2D map keeps the old
// rings, so its polygons, labels and hotspots are exactly as before.
const NEST_FRONT = 53, NEST_MAXVIEW = 129.9;
const nestLong = (r) => NEST_FRONT + ((r - NEST_FRONT) * (NEST_MAXVIEW - NEST_FRONT)) / (NEST_TIERS_R1 - NEST_FRONT);
export const NEST_STAGE = { halfX: 28.5, halfZ: 18 };
const NEST_COLORS = { red: "#e8605f", peach: "#f2b58f", yellow: "#eddc5c", lavender: "#b7a3dc", green: "#a8cf78", blue: "#7fb6e6", rose: "#c67a86", unsold: "#34363f" };
const NEST_PRICES = { red: 1717, peach: 1517, yellow: 1317, lavender: 917, green: 717, blue: 517, rose: 317 };
const NEST_MAP = { cx: 355, cy: 336, sx: 0.25, sz: 0.32 };

const nestFloor = (id, tone, x0, y0, x1, y1) => {
  const ax = (x0 - NEST_MAP.cx) * NEST_MAP.sx, bx = (x1 - NEST_MAP.cx) * NEST_MAP.sx, az = (y0 - NEST_MAP.cy) * NEST_MAP.sz, bz = (y1 - NEST_MAP.cy) * NEST_MAP.sz;
  const center = { x: (ax + bx) / 2, z: (az + bz) / 2 };
  return { id, tone, color: NEST_COLORS[tone], price: NEST_PRICES[tone], kind: "floor", points: [[ax, az], [bx, az], [bx, bz], [ax, bz]], center, seat: { x: center.x, y: 1.55, z: center.z }, label: center };
};
const nestFloorSecs = [];
[[241, 276], [283, 315], [326, 358], [364, 398], [404, 436], [442, 472]].forEach(([a, b], i) => nestFloorSecs.push(nestFloor(`A${i + 1}`, "red", a, 416, b, 438)));
[[244, 278], [282, 314], [318, 352], [358, 392], [396, 430], [436, 468]].forEach(([a, b], i) => nestFloorSecs.push(nestFloor(`C${6 - i}`, "red", a, 245, b, 268)));
[[303, 328], [331, 357], [360, 385]].forEach(([a, b], i) => {
  nestFloorSecs.push(nestFloor(`D${i + 1}`, "peach", 198, a, 232, b));
  nestFloorSecs.push(nestFloor(`D${i + 4}`, "yellow", i === 1 ? 157 : 168, a, 191, b));
  nestFloorSecs.push(nestFloor(`B${3 - i}`, "peach", 478, a, 512, b));
  nestFloorSecs.push(nestFloor(`B${6 - i}`, "yellow", 519, a, i === 1 ? 553 : 542, b));
});

const NEST_N = 56, NEST_ROT = -1.5 / NEST_N;
const nestPolar = (r, f) => [r * Math.sin(f * 2 * Math.PI), r * NEST_SQUASH * Math.cos(f * 2 * Math.PI)];
function nestBowl(id, slot, tier, d0, d1, tone) {
  const t = NEST_TIERS[tier], ri = t.r0 + (t.r1 - t.r0) * d0, ro = t.r0 + (t.r1 - t.r0) * d1, f0 = NEST_ROT + (slot - 0.47) / NEST_N, f1 = NEST_ROT + (slot + 0.47) / NEST_N, pts = [];
  for (let k = 0; k <= 4; k++) pts.push(nestPolar(ri, f0 + ((f1 - f0) * k) / 4));
  for (let k = 4; k >= 0; k--) pts.push(nestPolar(ro, f0 + ((f1 - f0) * k) / 4));
  const dm = (d0 + d1) / 2, rm = t.r0 + (t.r1 - t.r0) * dm, f = NEST_ROT + slot / NEST_N, [x, z] = nestPolar(rm, f), y = t.y0 + t.rise * dm + 0.45;
  // seat = the camera in the 3D bowl (long axis pulled in, see nestLong); map uses the old rings
  const seat = { x: nestLong(rm) * Math.sin(f * 2 * Math.PI), y: y + 1.2, z };
  return { id: String(id), tone, color: NEST_COLORS[tone], price: NEST_PRICES[tone], unsold: tone === "unsold", kind: "bowl", tier, slot, d: [d0, d1], points: pts, center: { x, z }, seat, label: { x, z } };
}
const inR = (n, ...rs) => rs.some(([a, b]) => n >= a && n <= b);
const nestLowerTone = (n) => (inR(n, [111, 113], [120, 122], [139, 141], [148, 150]) ? "unsold" : inR(n, [114, 119], [142, 147]) ? "green" : "lavender");
const nestMidTone = (n) =>
  inR(n, [201, 204], [211, 213], [220, 222], [239, 241], [248, 250]) ? "unsold" : inR(n, [210, 210], [214, 219], [223, 223], [238, 238], [242, 247], [251, 251]) ? "blue" : inR(n, [209, 209], [224, 224], [237, 237], [252, 252]) ? "green" : "lavender";
const nestUpperTone = (n) =>
  inR(n, [511, 513], [515, 515], [518, 518], [520, 522], [539, 541], [543, 543], [546, 546], [548, 550])
    ? "unsold"
    : inR(n, [510, 510], [514, 514], [519, 519], [523, 523], [538, 538], [542, 542], [547, 547], [551, 551])
    ? "rose"
    : inR(n, [509, 509], [524, 524], [537, 537], [552, 552])
    ? "blue"
    : "green";
const NEST_UPPER_GAPS = new Set([516, 517, 544, 545]);
const nestBowlSecs = [];
for (let i = 0; i < NEST_N; i++) {
  nestBowlSecs.push(nestBowl(101 + i, i, "lower", 0.05, 0.95, nestLowerTone(101 + i)));
  nestBowlSecs.push(nestBowl(201 + i, i, "mid", 0.05, 0.95, nestMidTone(201 + i)));
  NEST_UPPER_GAPS.has(501 + i) || nestBowlSecs.push(nestBowl(501 + i, i, "upper", 0, 0.5, nestUpperTone(501 + i)));
}
[...Array(12).keys()].forEach((i) => nestBowlSecs.push(nestBowl(625 + i, 24 + i, "upper", 0.54, 0.98, "blue")));
[...Array(12).keys()].forEach((i) => {
  const slot = (52 + i) % NEST_N;
  nestBowlSecs.push(nestBowl(601 + slot, slot, "upper", 0.54, 0.98, "blue"));
});
const NEST_SECTIONS = [...nestBowlSecs, ...nestFloorSecs];

// ============================ 无锡 (Wuxi) ============================
export const WUXI_STAGE = { halfX: 46.5, halfZ: 26.5, height: 36 };
const WUXI_GLB_SCALE = [1.5, 1, 1.5], WS = WUXI_GLB_SCALE[0];
const ring = (i, o, y) => ({ i: [i[0] * WS, i[1] * WS], o: [o[0] * WS, o[1] * WS], y });
const WUXI_TIERS = { lower: ring([64, 42], [83, 57], [2, 20]), mid: ring([86, 60], [101, 71], [23, 39]), upper: ring([104, 74], [115, 81], [42, 57]) };
const WUXI_COLORS = { red: "#e8605f", peach: "#f2b58f", yellow: "#eddc5c", lavender: "#b7a3dc", green: "#a8cf78", blue: "#7fb6e6", rose: "#e0718f", unsold: "#34363f" };
const WUXI_PRICES = { red: 1717, peach: 1517, yellow: 1317, lavender: 917, green: 717, blue: 517, rose: 317 };
const superEllipse = (a, b, t) => {
  const k = 1 + 0.012 * Math.cos(4 * t);
  return [a * Math.cos(t) * k, b * Math.sin(t) * k];
};
const WUXI_N = 32, wuxiAngle = (n) => ((n - 1) * 2 * Math.PI) / WUXI_N;
function wuxiBowl(id, name, slot, tier, d0, d1, tone, mapLabel) {
  const t = WUXI_TIERS[tier], at = (d) => [t.i[0] + (t.o[0] - t.i[0]) * d, t.i[1] + (t.o[1] - t.i[1]) * d];
  const a0 = wuxiAngle(slot) - (0.47 * 2 * Math.PI) / WUXI_N, a1 = wuxiAngle(slot) + (0.47 * 2 * Math.PI) / WUXI_N, [ia, ib] = at(d0), [oa, ob] = at(d1), pts = [];
  for (let k = 0; k <= 4; k++) pts.push(superEllipse(ia, ib, a0 + ((a1 - a0) * k) / 4));
  for (let k = 4; k >= 0; k--) pts.push(superEllipse(oa, ob, a0 + ((a1 - a0) * k) / 4));
  const dm = (d0 + d1) / 2, [x, z] = superEllipse(...at(dm), wuxiAngle(slot)), y = t.y[0] + (t.y[1] - t.y[0]) * dm + 0.45;
  return { id, name, tone, color: WUXI_COLORS[tone], price: WUXI_PRICES[tone], unsold: tone === "unsold", kind: "bowl", tier, slot, d: [d0, d1], mapLabel, points: pts, center: { x, z }, seat: { x, y: y + 1.2, z }, label: { x, z } };
}
const WUXI_CLOSED = new Set([3, 4, 14, 15, 19, 20, 30, 31]);
const WUXI_END = new Set([2, 16, 18, 32]);
const wuxiLowerTone = (n) => (WUXI_CLOSED.has(n) ? "unsold" : (n >= 5 && n <= 13) || (n >= 21 && n <= 29) ? "lavender" : "green");
const wuxiBowlSecs = [];
for (let n = 1; n <= WUXI_N; n++) {
  const lo = 200 + n;
  wuxiBowlSecs.push(wuxiBowl(String(lo), `${lo}区`, n, "lower", 0.05, 0.95, wuxiLowerTone(n), String(lo)));
  if (n === 1 || n === 17) continue;
  const up = 400 + n, name = `${up}区`;
  if (WUXI_CLOSED.has(n)) {
    wuxiBowlSecs.push(wuxiBowl(String(up), name, n, "mid", 0.05, 0.95, "unsold", String(up)));
    wuxiBowlSecs.push(wuxiBowl(`${up}u`, name, n, "upper", 0.05, 0.95, "unsold", null));
  } else if (WUXI_END.has(n)) {
    wuxiBowlSecs.push(wuxiBowl(`${up}b`, name, n, "mid", 0.05, 0.95, "blue", String(up)));
    wuxiBowlSecs.push(wuxiBowl(`${up}r`, name, n, "upper", 0.05, 0.95, "rose", null));
  } else {
    wuxiBowlSecs.push(wuxiBowl(`${up}a`, name, n, "mid", 0.05, 0.48, "lavender", null));
    wuxiBowlSecs.push(wuxiBowl(`${up}g`, name, n, "mid", 0.52, 0.95, "green", String(up)));
    wuxiBowlSecs.push(wuxiBowl(`${up}b`, name, n, "upper", 0.05, 0.95, "blue", null));
  }
}
const WUXI_MAP = { cx: 1002, cy: 751, sx: 93 / 435, sz: 53 / 200 }, FLOOR_GAP = 3;
function wuxiFloor(id, tone, x0, z0, x1, z1) {
  const near = Math.abs(z0) < Math.abs(z1) ? z0 : z1, far = near === z0 ? z1 : z0;
  const endSide = Math.abs(near) > WUXI_STAGE.halfZ && Math.abs(x0 + x1) / 2 < WUXI_STAGE.halfX;
  const center = { x: (x0 + x1) / 2, z: (z0 + z1) / 2 };
  const seat = endSide
    ? { x: center.x, y: 1.55, z: near + (far - near) * 0.25 }
    : { x: Math.sign(center.x) * (Math.min(Math.abs(x0), Math.abs(x1)) + Math.abs(x1 - x0) * 0.25), y: 1.55, z: center.z };
  return { id, name: `${id}区`, tone, color: WUXI_COLORS[tone], price: WUXI_PRICES[tone], kind: "floor", mapLabel: id, points: [[x0, z0], [x1, z0], [x1, z1], [x0, z1]], center, seat, label: center };
}
const mx = (px) => (px - WUXI_MAP.cx) * WUXI_MAP.sx, mz = (py) => (py - WUXI_MAP.cy) * WUXI_MAP.sz;
const wuxiFloorSecs = [];
[[791, 846, 576], [854, 922, 559], [931, 1e3, 549], [1007, 1076, 549], [1084, 1152, 559], [1161, 1216, 576]].forEach(([a, b, y], i) => {
  const depth = mz(y) + WUXI_STAGE.halfZ;
  wuxiFloorSecs.push(wuxiFloor(`A${6 - i}`, "red", mx(a), -WUXI_STAGE.halfZ - FLOOR_GAP, mx(b), -WUXI_STAGE.halfZ - FLOOR_GAP + depth));
  wuxiFloorSecs.push(wuxiFloor(`C${i + 1}`, "red", mx(a), WUXI_STAGE.halfZ + FLOOR_GAP, mx(b), WUXI_STAGE.halfZ + FLOOR_GAP - depth));
});
[[656, 708], [726, 778], [795, 847]].forEach(([a, b], i) => {
  wuxiFloorSecs.push(wuxiFloor(`B${i + 1}`, "peach", mx(689), mz(a), mx(760), mz(b)));
  wuxiFloorSecs.push(wuxiFloor(`B${i + 4}`, "yellow", mx(606), mz(a), mx(677), mz(b)));
  wuxiFloorSecs.push(wuxiFloor(`D${3 - i}`, "peach", mx(1246), mz(a), mx(1316), mz(b)));
  wuxiFloorSecs.push(wuxiFloor(`D${6 - i}`, "yellow", mx(1328), mz(a), mx(1399), mz(b)));
});
const WUXI_SECTIONS = [...wuxiBowlSecs, ...wuxiFloorSecs];

// ============================ crowd bands ============================
const nestCrowd = [["lower", 24], ["mid", 18], ["upper", 22]].map(([k, rows]) => {
  const t = NEST_TIERS[k];
  return {
    rows,
    count: (d) => Math.floor((t.r0 + (t.r1 - t.r0) * d) * 3.6),
    at: (d, a) => {
      const r = t.r0 + (t.r1 - t.r0) * d;
      return [nestLong(r) * Math.sin(a), t.y0 + t.rise * d + 1.25, r * NEST_SQUASH * Math.cos(a)];
    },
  };
});
const wuxiCrowd = [["lower", 24], ["mid", 18], ["upper", 12]].map(([k, rows]) => {
  const t = WUXI_TIERS[k], at = (d) => [t.i[0] + (t.o[0] - t.i[0]) * d, t.i[1] + (t.o[1] - t.i[1]) * d];
  return {
    rows,
    count: (d) => Math.floor(at(d)[0] * 3.6),
    at: (d, a) => {
      const [ra, rb] = at(d);
      return [ra * Math.sin(a), t.y[0] + (t.y[1] - t.y[0]) * d + 1.25, rb * Math.cos(a)];
    },
  };
});

// ============================ procedural bowl specs ============================
// Proportions are NOT new: tier rings are the ones above (same as the approved GLBs and
// every seat POV). Roof numbers are read from the approved GLBs, plus the CITED figures in
// docs BOWL_PARAMS.md (Nest: 24 truss columns, roof opening 185.3 × 127.5 m; Wuxi: 64
// cantilever trusses, 128 radial cables, 6 hoop cables, ~30 m inner membrane).
// Angles use x = a·cos θ, z = b·sin θ (× the Wuxi super-ellipse factor).
export const bowlPoint = (eps, a, b, th) => {
  const k = 1 + eps * Math.cos(4 * th);
  return [a * Math.cos(th) * k, b * Math.sin(th) * k];
};
const NEST_BOWL = {
  eps: 0,
  slots: NEST_N,
  theta: (slot) => Math.PI / 2 - 2 * Math.PI * (NEST_ROT + slot / NEST_N),
  tiers: ["lower", "mid", "upper"].map((key) => {
    const t = NEST_TIERS[key];
    return { key, i: [nestLong(t.r0), t.r0 * NEST_SQUASH], o: [nestLong(t.r1), t.r1 * NEST_SQUASH], y: [t.y0, t.y0 + t.rise] };
  }),
  // every Nest tier has red seats with white ones mixed in (nest_首场_0002..0004, nest_526_0005)
  seatColors: [[0.6, 0.09, 0.11], [0.6, 0.09, 0.11], [0.58, 0.09, 0.11]],
  whiteSeats: 0.3,
  field: { turf: [58, 39], track: null },
  // top: highest point of the steel roof (CITED 68.5 m). ceil: height of the membrane ceiling at
  // the opening edge and at the outer rim (39 m is read off nest_山顶_0005; the outer value puts
  // the ceiling 2 m above the 51.1 m concrete bowl). wallTop: top of the concrete bowl (CITED).
  roof: { type: "nest", opening: [185.3 / 2, 127.5 / 2], outer: [174, 145], top: 68.5, ceil: [39, 56.3], columns: 24 },
  wallTop: 51.1,
};
const WUXI_BOWL = {
  eps: 0.012,
  slots: WUXI_N,
  slotBase: 1,
  theta: (slot) => wuxiAngle(slot),
  tiers: ["lower", "mid", "upper"].map((key) => ({ key, i: WUXI_TIERS[key].i, o: WUXI_TIERS[key].o, y: WUXI_TIERS[key].y })),
  seatColors: [[0.1, 0.3, 0.29], [0.12, 0.25, 0.34], [0.18, 0.28, 0.37]],
  field: { turf: [47.6 * WS, 30.4 * WS], track: [61.7 * WS, 39.5 * WS] },
  roof: { type: "wuxi", trusses: 64, radialCables: 128, hoops: 6, membraneDepth: 30, inner: [77.9 * WS, 52.6 * WS], outer: [123.5 * WS, 92.6 * WS], y: (th) => 69 + 5.5 * Math.cos(2 * th), facade: [124.5 * WS, 92.1 * WS] },
};

// ============================ 赣州 / 昆明 (preview) ============================
// Ganzhou + Kunming venue data. Shared stage kit is joker_xue_2026, same deck as Wuxi;
// only the bowl and seats differ. Plan numbers are CITED / DERIVED in docs/refs/BOWL_PARAMS.md.
// Heights are UNKNOWN modelling placeholders and are not surveyed.


const COLORS = { red: "#e8605f", peach: "#f2b58f", yellow: "#eddc5c", lavender: "#b7a3dc", green: "#a8cf78", blue: "#7fb6e6", rose: "#e0718f", unsold: "#34363f" };
const PRICES = { red: 1717, peach: 1517, yellow: 1317, lavender: 917, green: 717, blue: 517, rose: 317 };

// Same deck as Wuxi — one shared stage kit.
export const TOUR_STAGE = { halfX: 46.5, halfZ: 26.5, height: 36 };

// Standard 400 m track (World Athletics): straights 84.39 m, curve radius 36.50 m to the
// lane-1 running line. Kerb radius 36.20 m (= 36.50 − 0.30). Eight lanes × 1.22 m = 9.76 m,
// so the track outer half-axes are [84.39/2 + 45.96, 45.96] = [88.155, 45.96]. Documented
// as DERIVED in BOWL_PARAMS.md. (2×84.39 + 2π×36.50 ≈ 398.12 m; the 0.30 m running-line
// offset is the usual remainder toward 400 m.)
const TRACK_OUTER = [88.155, 45.96];
const APRON = 3; // modelling allowance between track outer and first row, not surveyed
const STAND_IN = [TRACK_OUTER[0] + APRON, TRACK_OUTER[1] + APRON];

// Ganzhou building plan CITED 307 m × 297 m. Last-row vs façade is UNKNOWN; the 3D outer
// seating ring uses the cited building plan as an upper bound, not a surveyed last row.
const GZ_OUT = [153.5, 148.5];
// Map t-bands (seating-ellipse rho) → depth fraction of (STAND_IN → GZ_OUT).
// inner 0.650–0.755, mid 0.765–0.868, outer 0.868–1.020 (span 0.650–1.020).
const gzFrac = (t) => (t - 0.65) / (1.02 - 0.65);
const gzRing = (t0, t1, y) => {
  const a = (t) => [STAND_IN[0] + (GZ_OUT[0] - STAND_IN[0]) * t, STAND_IN[1] + (GZ_OUT[1] - STAND_IN[1]) * t];
  return { i: a(gzFrac(t0)), o: a(gzFrac(t1)), y };
};
// Heights: UNKNOWN placeholders, kept well under the CITED 59.7 m roof. Not surveyed, not Wuxi's 2–57 m stack.
const GZ_TIERS = {
  lower: gzRing(0.65, 0.755, [2, 12]),
  mid: gzRing(0.765, 0.868, [13, 22]),
  upper: gzRing(0.868, 1.02, [23, 32]),
};

// Kunming plan size is UNKNOWN. Outer ring DERIVED from the official-map mean stand-depth
// ratio (r_out / r_in ≈ 1/0.729 ≈ 1.372) applied to STAND_IN (standard track + apron).
// This keeps the track aspect; it is not an independently surveyed building plan.
const KM_RATIO = 1.372;
const KM_OUT = [STAND_IN[0] * KM_RATIO, STAND_IN[1] * KM_RATIO];
const kmFrac = (t) => (t - 0.73) / (1.03 - 0.73);
const kmRing = (t0, t1, y) => {
  const a = (t) => [STAND_IN[0] + (KM_OUT[0] - STAND_IN[0]) * t, STAND_IN[1] + (KM_OUT[1] - STAND_IN[1]) * t];
  return { i: a(kmFrac(t0)), o: a(kmFrac(t1)), y };
};
// Heights: UNKNOWN placeholders. Roof / façade height uncited. Two tiers only (上/下).
const KM_TIERS = {
  lower: kmRing(0.73, 0.872, [2, 11]),
  upper: kmRing(0.878, 1.03, [13, 22]),
};

const SLOTS = 64;
const thetaOf = (slot) => -Math.PI + ((slot + 0.5) / SLOTS) * 2 * Math.PI;
export const slotOfAngle = (th) => {
  const u = (th + Math.PI) / (2 * Math.PI);
  return ((Math.floor(u * SLOTS) % SLOTS) + SLOTS) % SLOTS;
};

const floorBlock = (id, tone, x0, z0, x1, z1, name) => {
  const center = { x: (x0 + x1) / 2, z: (z0 + z1) / 2 };
  const nearZ = Math.abs(z0) < Math.abs(z1) ? z0 : z1, farZ = nearZ === z0 ? z1 : z0;
  const endSide = Math.abs(nearZ) > TOUR_STAGE.halfZ && Math.abs(center.x) < TOUR_STAGE.halfX;
  const seat = endSide
    ? { x: center.x, y: 1.55, z: nearZ + (farZ - nearZ) * 0.25 }
    : { x: Math.sign(center.x || 1) * (Math.min(Math.abs(x0), Math.abs(x1)) + Math.abs(x1 - x0) * 0.25), y: 1.55, z: center.z };
  return { id, name: name ?? `${id}区`, tone, color: COLORS[tone], price: PRICES[tone], kind: "floor", mapLabel: id, points: [[x0, z0], [x1, z0], [x1, z1], [x0, z1]], center, seat, label: center };
};

// Four blocks along each side of the shared deck. Ganzhou: A at −Z (top of Damai map).
// Kunming: A at +Z (bottom of Damai map — floor letters are mirrored).
const TOUR_GAP = 3, BW = 13.5, BD = 11, BG = 1.6;
function endBlocks(ids, tone, zSign) {
  const z0 = zSign * (TOUR_STAGE.halfZ + TOUR_GAP);
  const z1 = z0 + zSign * BD;
  const total = ids.length * BW + (ids.length - 1) * BG;
  const xStart = -total / 2;
  return ids.map((id, i) => {
    const x0 = xStart + i * (BW + BG), x1 = x0 + BW;
    return floorBlock(id, tone, x0, z0, x1, z1);
  });
}
function sideBlocks(closeIds, farIds, closeTone, farTone, xSign) {
  // closeIds: [upper, lower] (upper = −Z), two rows
  const xClose0 = xSign * (TOUR_STAGE.halfX + TOUR_GAP);
  const xClose1 = xClose0 + xSign * BD;
  const xFar0 = xClose1 + xSign * BG;
  const xFar1 = xFar0 + xSign * BD;
  const zPairs = [[-BW - BG / 2, -BG / 2], [BG / 2, BW + BG / 2]]; // upper, lower
  const out = [];
  closeIds.forEach((id, i) => out.push(floorBlock(id, closeTone, xClose0, zPairs[i][0], xClose1, zPairs[i][1])));
  farIds.forEach((id, i) => out.push(floorBlock(id, farTone, xFar0, zPairs[i][0], xFar1, zPairs[i][1])));
  return out;
}

// Floor tones come from the colour sampled inside each traced Damai block. A block printed in
// two prices (e.g. A3区: red rows + peach rows) is split along its depth: the second band
// ("A3-1517") takes its traced area share on the side the map prints it (farther from / nearer to the stage).
function damaiFloor(blocks, hot) {
  const cy = hot.ellipse.cy, out = [];
  for (const b of blocks) {
    const m = hot.meta[b.id];
    if (!m) continue;
    const [[x0, z0], , [x1, z1]] = b.points;
    const band = Object.entries(hot.meta).find(([, v]) => v.kind === "floor" && v.base === b.id);
    if (!band) {
      out.push(floorBlock(b.id, m.tone, x0, z0, x1, z1));
      continue;
    }
    const [bid, bm] = band;
    const near = Math.abs(z0) < Math.abs(z1) ? z0 : z1, far = near === z0 ? z1 : z0;
    const bandFar = Math.abs(hot.labels[bid][1] - cy) > Math.abs(hot.labels[b.id][1] - cy);
    const zs = near + (far - near) * (bandFar ? 1 - bm.frac : bm.frac);
    const [pNear, pFar] = bandFar ? [[b.id, m], [bid, bm]] : [[bid, bm], [b.id, m]];
    out.push(floorBlock(pNear[0], pNear[1].tone, x0, near, x1, zs, pNear[1].name), floorBlock(pFar[0], pFar[1].tone, x0, zs, x1, far, pFar[1].name));
  }
  return out;
}

const gzFloor = damaiFloor(
  [
    ...endBlocks(["A4", "A3", "A2", "A1"], "red", -1),
    ...endBlocks(["C1", "C2", "C3", "C4"], "red", +1),
    ...sideBlocks(["B1", "B2"], ["B3", "B4"], "peach", "yellow", -1),
    ...sideBlocks(["D2", "D1"], ["D4", "D3"], "peach", "yellow", +1),
  ],
  gzHot,
);
const kmFloor = damaiFloor(
  [
    ...endBlocks(["C4", "C3", "C2", "C1"], "red", -1),
    ...endBlocks(["A1", "A2", "A3", "A4"], "red", +1),
    ...sideBlocks(["D1", "D2"], ["D3", "D4"], "peach", "yellow", -1),
    ...sideBlocks(["B2", "B1"], ["B4", "B3"], "peach", "yellow", +1),
  ],
  kmHot,
);

function sectorPoints(t, a0, a1, d0, d1) {
  const wrap = (x) => ((x + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  const da = wrap(a1 - a0), at = (d) => [t.i[0] + (t.o[0] - t.i[0]) * d, t.i[1] + (t.o[1] - t.i[1]) * d], pts = [];
  const [ia, ib] = at(d0), [oa, ob] = at(d1);
  for (let k = 0; k <= 4; k++) pts.push([ia * Math.cos(a0 + (da * k) / 4), ib * Math.sin(a0 + (da * k) / 4)]);
  for (let k = 4; k >= 0; k--) pts.push([oa * Math.cos(a0 + (da * k) / 4), ob * Math.sin(a0 + (da * k) / 4)]);
  return pts;
}
function bowlSections(hot, tiers) {
  const out = [];
  for (const [id, m] of Object.entries(hot.meta)) {
    if (m.kind !== "bowl") continue;
    const t = tiers[m.tier];
    if (!t) continue;
    // Angular span (a0..a1, centroid angle) and depth band (d0..d1 within the tier) are the
    // traced Damai polygon's own extent about the map ellipse.
    const d0 = m.d0 ?? 0.08, d1 = m.d1 ?? 0.92, dm = (d0 + d1) / 2, th = m.ang;
    const at = (d) => [t.i[0] + (t.o[0] - t.i[0]) * d, t.i[1] + (t.o[1] - t.i[1]) * d];
    const [ra, rb] = at(dm);
    const x = ra * Math.cos(th), z = rb * Math.sin(th);
    const y = t.y[0] + (t.y[1] - t.y[0]) * dm + 0.45;
    out.push({
      id,
      name: m.name,
      tone: m.tone,
      color: COLORS[m.tone],
      price: m.price,
      kind: "bowl",
      tier: m.tier,
      slot: slotOfAngle(th),
      d: [d0, d1],
      span: [m.a0, m.a1],
      points: sectorPoints(t, m.a0, m.a1, d0, d1),
      seat: { x, y: y + 1.2, z },
      center: { x, z },
      label: { x, z },
    });
  }
  return out;
}

function crowdBands(tiers) {
  return Object.entries(tiers).map(([key, t]) => {
    const rows = Math.max(8, Math.round((t.o[0] - t.i[0] + (t.o[1] - t.i[1])) / 2 / 0.85));
    const at = (d) => [t.i[0] + (t.o[0] - t.i[0]) * d, t.i[1] + (t.o[1] - t.i[1]) * d];
    return {
      rows,
      count: (d) => Math.floor(at(d)[0] * 3.6),
      at: (d, a) => {
        const [ra, rb] = at(d);
        return [ra * Math.cos(a), t.y[0] + (t.y[1] - t.y[0]) * d + 1.25, rb * Math.sin(a)];
      },
    };
  });
}

function bowlSpec(tiers, roof, fieldOuter) {
  return {
    eps: 0,
    slots: SLOTS,
    slotBase: 0,
    theta: thetaOf,
    tiers: Object.entries(tiers).map(([key, t]) => ({ key, i: t.i, o: t.o, y: t.y })),
    seatColors: [[0.1, 0.3, 0.29], [0.12, 0.25, 0.34], [0.18, 0.28, 0.37]],
    field: { turf: [TRACK_OUTER[0] - 9, TRACK_OUTER[1] - 9], track: TRACK_OUTER },
    roof,
  };
}

const gzSecs = [...bowlSections(gzHot, GZ_TIERS), ...gzFloor];
const kmSecs = [...bowlSections(kmHot, KM_TIERS), ...kmFloor];

const GANZHOU = {
  id: "ganzhou",
  sections: gzSecs,
  byId: (id) => gzSecs.find((s) => s.id === id),
  stage: TOUR_STAGE,
  thresholds: { close: 90, far: 55 },
  defaultId: "C3",
  quick: ["C3", "C05"],
  compare: ["C3", "C05"],
  povs: { close: "C3", sweet: "C05" },
  crowdBands: crowdBands(GZ_TIERS),
  bowl: bowlSpec(GZ_TIERS, { type: "cantilever", top: 59.7, inward: 39, outer: GZ_OUT }),
  barriers: [[0, 28, 96, 0.06], [0, -28, 96, 0.06], [-49, 0, 0.06, 56], [49, 0, 0.06, 56]],
  placeholderRings: Object.values(GZ_TIERS).map((t) => ({ inner: t.i, outer: t.o, y: t.y })),
  meta: { title: "赣州站", dates: ["12.04–06"], ledDate: "2026.12.04", place: "赣州市全民健身中心体育场", pageTitle: "薛之谦 · 赣州站选座预览", aria: "赣州站座位图" },
};

const KUNMING = {
  id: "kunming",
  sections: kmSecs,
  byId: (id) => kmSecs.find((s) => s.id === id),
  stage: TOUR_STAGE,
  thresholds: { close: 90, far: 55 },
  defaultId: "A2",
  quick: ["A2", "主席台2"],
  compare: ["A2", "主席台2"],
  povs: { close: "A2", sweet: "主席台2" },
  crowdBands: crowdBands(KM_TIERS),
  bowl: bowlSpec(KM_TIERS, { type: "none" }),
  barriers: [[0, 28, 96, 0.06], [0, -28, 96, 0.06], [-49, 0, 0.06, 56], [49, 0, 0.06, 56]],
  placeholderRings: Object.values(KM_TIERS).map((t) => ({ inner: t.i, outer: t.o, y: t.y })),
  meta: { title: "昆明站", dates: ["12.19–20　12.25–26"], ledDate: "2026.12.19", place: "昆明拓东体育场", pageTitle: "薛之谦 · 昆明站选座预览", aria: "昆明站座位图" },
};

export const VENUES = {
  nest: {
    id: "nest",
    glb: "nest_bowl.glb",
    glbScale: [1, 1, 1],
    sections: NEST_SECTIONS,
    byId: (id) => NEST_SECTIONS.find((s) => s.id === id),
    stage: NEST_STAGE,
    thresholds: { close: 60, far: 30 },
    defaultId: "A1",
    quick: ["A1", "636"],
    compare: ["A1", "636"],
    crowdBands: nestCrowd,
    bowl: NEST_BOWL,
    barriers: [[0, 24.6, 64, 0.06], [0, -24.6, 64, 0.06], [-48.2, 0, 0.06, 34], [48.2, 0, 0.06, 34]],
    placeholderRings: [
      ...Object.values(NEST_TIERS).map((t) => ({ inner: [nestLong(t.r0), t.r0 * NEST_SQUASH], outer: [nestLong(t.r1), t.r1 * NEST_SQUASH], y: [t.y0, t.y0 + t.rise] })),
      { inner: [125, 125 * NEST_SQUASH], outer: [174, 174 * NEST_SQUASH], y: [68.5, 68.5], roof: true },
    ],
    meta: { title: "北京站", dates: ["07.10–12　07.17–19　07.24–26", "07.31　08.01–02"], ledDate: "2026.07.17", place: "国家体育场 · 鸟巢", pageTitle: "薛之谦 · 鸟巢选座预览", aria: "北京站座位图" },
  },
  wuxi: {
    id: "wuxi",
    glb: "wuxi_stadium.glb",
    glbScale: WUXI_GLB_SCALE,
    sections: WUXI_SECTIONS,
    byId: (id) => WUXI_SECTIONS.find((s) => s.id === id),
    stage: WUXI_STAGE,
    thresholds: { close: 90, far: 55 },
    defaultId: "C3",
    quick: ["C3", "409a"],
    compare: ["C3", "409a"],
    povs: { close: "C3", sweet: "409a" },
    crowdBands: wuxiCrowd,
    bowl: WUXI_BOWL,
    barriers: [[0, 28, 96, 0.06], [0, -28, 96, 0.06], [-49, 0, 0.06, 56], [49, 0, 0.06, 56]],
    placeholderRings: [...Object.values(WUXI_TIERS).map((t) => ({ inner: t.i, outer: t.o, y: t.y }))],
    meta: { title: "无锡站", dates: ["11.13–15　11.20–22"], ledDate: "2026.11.13", place: "无锡奥林匹克体育中心体育场", pageTitle: "薛之谦 · 无锡站选座预览", aria: "无锡站座位图" },
  },
  ganzhou: GANZHOU,
  kunming: KUNMING,
};

export const sectionName = (s) => s.name ?? `${s.id}区`;
