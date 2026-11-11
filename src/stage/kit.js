// Shared stage kit "joker_xue_2026": dimensions in metres, read off the Xiaohongshu photos
// of the Beijing Nest shows (docs/XHS_STAGE_MATCH.md lists the photo behind each number).
// Plain JS so node scripts (scripts/mascot_raycheck.mjs) use the same numbers as the scene.
// x = long axis of the stage, z = short axis, y = up, origin = field centre.
export const KIT = {
  // runway ring around the stage (outer footprint = the "舞台" rectangle on the seat map)
  ring: { hw: 28.5, hd: 18, r: 7, w: 3.2, h: 2 },
  // main deck inside the ring
  deck: { hw: 22, hd: 13, h: 2.6 },
  // four-sided LED volume, flown under the roof (long face 2.77:1, end face 1.53:1)
  box: { w: 40, d: 22, h: 14.4, y0: 11 },
  // six truss towers inside the LED volume carry the roof
  towers: { xs: [-16.5, 0, 16.5], z: 8.6, size: 2.4 },
  // mother-grid roof: wider than the LED volume on every side, rounded corners
  roof: { hw: 26, hd: 17, r: 6, y0: 25.8, y1: 28.2, yTop: 29 },
  // four portrait IMAG towers near the field corners
  imag: { at: [[-40, 24, 1], [40, 24, 1], [-40, -24, 0], [40, -24, 0]], w: 12, h: 20, base: 2.5, depth: 2.6 },
};
export const imagRotY = ([x, , front]) => Math.atan2(-Math.sign(x), front ? 1 : -1);
export const BOX_CY = KIT.box.y0 + KIT.box.h / 2;
