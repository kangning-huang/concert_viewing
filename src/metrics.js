import { NEST_STAGE } from "./venues.js";

const deg = (r) => (r * 180) / Math.PI;

// Seat → distance / stage angle / zone label (1:1 from c941445).
export function seatMetrics(section, venue) {
  const st = venue?.stage ?? NEST_STAGE;
  const { close, far } = venue?.thresholds ?? { close: 60, far: 30 };
  const { x, z } = section.seat;
  const dx = Math.max(Math.abs(x) - st.halfX, 0), dz = Math.max(Math.abs(z) - st.halfZ, 0), dist = Math.hypot(dx, dz);
  const heading = Math.atan2(-x, -z);
  const angles = [[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([sx, sz]) => {
    let a = Math.atan2(sx * st.halfX - x, sz * st.halfZ - z) - heading;
    while (a > Math.PI) a -= 2 * Math.PI;
    while (a < -Math.PI) a += 2 * Math.PI;
    return a;
  });
  const hfov = deg(Math.max(...angles) - Math.min(...angles));
  const endOn = Math.abs(z) / st.halfZ >= Math.abs(x) / st.halfX;
  const offset = Math.abs(endOn ? x : z);
  let zone = "黄金角";
  if (hfov > close) zone = "贴脸";
  else if (hfov < far) zone = "全景看台";
  return { distance_m: dist, stage_hfov_deg: hfov, offset_m: offset, zone, price_cny: section.price, promise: promise(zone, section), occlusion: occlusion(section) };
}
function promise(zone, s) {
  return zone === "贴脸"
    ? s.kind === "floor"
      ? "竖屏比你的视野还高，要抬头看；舞台另一侧主要靠大屏"
      : "离舞台很近，但角度偏，整体画面要转头看"
    : zone === "黄金角"
    ? "人和屏都看得清，舞台构图完整"
    : "整套舞台尽收眼底，人很小，主要看大屏";
}
function occlusion(s) {
  return s.kind === "floor" ? "前排观众的头和围栏会入画" : s.tier === "lower" ? "舞台塔架可能遮挡部分视线" : "顶棚边缘会进入画面上方";
}
