// Venue data — reconstructed 1:1 from the c941445 bundle.
// Each section is individually pickable; picking a section flies the camera to
// that section's seat point (`seat`).

// ============================ 鸟巢 (Nest) ============================
const NEST_TIERS = { lower: { r0: 53, r1: 97, y0: 2, rise: 25 }, mid: { r0: 101, r1: 132, y0: 26, rise: 19 }, upper: { r0: 136, r1: 164, y0: 45, rise: 25 } };
const NEST_SQUASH = 0.79;
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
  const dm = (d0 + d1) / 2, [x, z] = nestPolar(t.r0 + (t.r1 - t.r0) * dm, NEST_ROT + slot / NEST_N), y = t.y0 + t.rise * dm + 0.45;
  return { id: String(id), tone, color: NEST_COLORS[tone], price: NEST_PRICES[tone], unsold: tone === "unsold", kind: "bowl", tier, slot, d: [d0, d1], points: pts, center: { x, z }, seat: { x, y: y + 1.2, z }, label: { x, z } };
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
      return [r * Math.sin(a), t.y0 + t.rise * d + 1.25, r * NEST_SQUASH * Math.cos(a)];
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
    return { key, i: [t.r0, t.r0 * NEST_SQUASH], o: [t.r1, t.r1 * NEST_SQUASH], y: [t.y0, t.y0 + t.rise] };
  }),
  // every Nest tier has red seats with white ones mixed in (nest_首场_0002..0004, nest_526_0005)
  seatColors: [[0.6, 0.09, 0.11], [0.6, 0.09, 0.11], [0.58, 0.09, 0.11]],
  whiteSeats: 0.3,
  field: { turf: [58, 39], track: null },
  roof: { type: "nest", opening: [185.3 / 2, 127.5 / 2], outer: [174, 145], y: 81, columns: 24 },
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
      ...Object.values(NEST_TIERS).map((t) => ({ inner: [t.r0, t.r0 * NEST_SQUASH], outer: [t.r1, t.r1 * NEST_SQUASH], y: [t.y0, t.y0 + t.rise] })),
      { inner: [125, 125 * NEST_SQUASH], outer: [174, 174 * NEST_SQUASH], y: [81, 81], roof: true },
    ],
    meta: { title: "北京站", dates: ["07.10–12　07.17–19　07.24–26", "07.31　08.01–02"], place: "国家体育场 · 鸟巢", pageTitle: "薛之谦 · 鸟巢选座预览", aria: "北京站座位图" },
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
    meta: { title: "无锡站", dates: ["11.13–15　11.20–22"], place: "无锡奥林匹克体育中心体育场", pageTitle: "薛之谦 · 无锡站选座预览", aria: "无锡站座位图" },
  },
};

export const sectionName = (s) => s.name ?? `${s.id}区`;
