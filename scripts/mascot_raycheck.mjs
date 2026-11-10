// Mascot sight-line check: no mascot may block any seat's view of the stage.
//   node scripts/mascot_raycheck.mjs <builtDir>
// Loads the built app with ?raycheck (exposes the R3F state), finds every mesh under the
// stage kit's "mascot:*" groups, and for EVERY section POV hotspot in both venues (all floor
// blocks, all bowl sections incl. unsold) casts rays from the POV to
//   - stage centre (performer chest height on the deck),
//   - the corners of every LED-building face and IMAG screen that faces the seat.
// Asserts zero hits on mascot meshes. Also asserts no mascot overlaps any section's
// footprint (nothing sits on/above a seat or floor block) and that no fly-in camera path
// passes through a mascot. Exit code 1 on any failure.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";
import * as THREE from "three";
import { VENUES } from "../src/venues.js";

const [dir = "dist"] = process.argv.slice(2);
const BASE = "/concert_viewing/";
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".jpg": "image/jpeg", ".webp": "image/webp", ".png": "image/png", ".glb": "model/gltf-binary", ".json": "application/json" };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (!p.startsWith(BASE)) return res.writeHead(404).end();
  p = p.slice(BASE.length) || "index.html";
  const f = path.join(dir, p);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) return res.writeHead(404).end();
  res.writeHead(200, { "content-type": MIME[path.extname(f)] ?? "application/octet-stream" });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const origin = `http://127.0.0.1:${server.address().port}${BASE}`;

// ---- targets (stage kit constants, src/stage/JokerXueStage.jsx) ----
const INSET = 0.1;
const targets = [{ name: "stage-centre", p: [0, 2.4 + 1.7, 0], n: null }];
const face = (name, centre, right, up, hw, hh, n) => {
  for (const sx of [-1, 1])
    for (const sy of [-1, 1]) {
      const p = centre.map((c, i) => c + right[i] * sx * (hw - INSET) + up[i] * sy * (hh - INSET));
      targets.push({ name: `${name}${sy > 0 ? "T" : "B"}${sx > 0 ? "R" : "L"}`, p, n });
    }
};
face("led-front:", [0, 21, 8.05], [1, 0, 0], [0, 1, 0], 22.5, 6.5, [0, 0, 1]);
face("led-back:", [0, 21, -8.05], [-1, 0, 0], [0, 1, 0], 22.5, 6.5, [0, 0, -1]);
face("led-east:", [23.05, 21, 0], [0, 0, -1], [0, 1, 0], 4.9, 6.5, [1, 0, 0]);
face("led-west:", [-23.05, 21, 0], [0, 0, 1], [0, 1, 0], 4.9, 6.5, [-1, 0, 0]);
[[-33, 17, 1], [33, 17, 1], [-33, -17, 0], [33, -17, 0]].forEach(([x, z, front], i) => {
  const ry = Math.atan2(-Math.sign(x), front ? 1 : -1), n = [Math.sin(ry), 0, Math.cos(ry)], r = [Math.cos(ry), 0, -Math.sin(ry)];
  face(`imag${i + 1}:`, [x + n[0] * 0.05, 13, z + n[2] * 0.05], r, [0, 1, 0], 6, 10, n);
});

// ---- fly-in paths (copied from src/scene/CameraRig.jsx; keep in sync) ----
const POV_HFOV = THREE.MathUtils.degToRad(65), MAP_BOX = { w: 360, h: 320 };
const vfovFor = (aspect) => 2 * Math.atan(Math.tan(POV_HFOV / 2) / aspect);
const mapHeight = (w, h) => h / Math.min(w / MAP_BOX.w, h / MAP_BOX.h) / (2 * Math.tan(vfovFor(w / h) / 2));
function flightPath(section, topY) {
  const s = section.seat;
  const out = new THREE.Vector3(s.x, 0, s.z).normalize();
  const seat = new THREE.Vector3(s.x, s.y, s.z);
  const top = new THREE.Vector3(0, topY, 0.01);
  const pts =
    section.kind === "floor"
      ? [top, new THREE.Vector3(s.x * 0.9, 58, s.z * 1.05), seat.clone().addScaledVector(out, 7).setY(4.6), seat]
      : [top, new THREE.Vector3(s.x * 0.62, 72, s.z * 0.62), seat.clone().addScaledVector(out, -15).setY(s.y + 8), seat];
  return new THREE.CatmullRomCurve3(pts, false, "centripetal");
}
const VIEWPORTS = [[390, 844], [390, 520], [844, 390], [1280, 800], [1920, 1080]];

const pointInPoly = (x, z, pts) => {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, zi] = pts[i], [xj, zj] = pts[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
};
const rectOverlapsPoly = (b, pts) => {
  for (let i = 0; i <= 6; i++)
    for (let j = 0; j <= 6; j++) if (pointInPoly(b.min[0] + ((b.max[0] - b.min[0]) * i) / 6, b.min[2] + ((b.max[2] - b.min[2]) * j) / 6, pts)) return true;
  return pts.some(([x, z]) => x >= b.min[0] && x <= b.max[0] && z >= b.min[2] && z <= b.max[2]);
};

const browser = await puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: "new",
  args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"],
});

let failed = false;
const report = {};
for (const vid of ["wuxi", "nest"]) {
  const venue = VENUES[vid];
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  await page.goto(`${origin}?venue=${vid}&quality=high&raycheck`, { waitUntil: "load", timeout: 60000 });
  await page.waitForFunction(() => window.__r3f?.scene.getObjectByName("mascot:giant"), { timeout: 20000 });

  const seats = venue.sections.map((s) => ({ id: s.id, p: [s.seat.x, s.seat.y, s.seat.z] }));
  const res = await page.evaluate(
    (seats, targets) => {
      const st = window.__r3f, V = st.camera.position.constructor, rc = new st.raycaster.constructor();
      st.scene.updateMatrixWorld(true);
      const roots = [], meshes = [];
      st.scene.traverse((o) => o.name.startsWith("mascot:") && roots.push(o));
      for (const r of roots)
        r.traverse((o) => {
          if (!o.isMesh) return;
          o.material.side = 2; // DoubleSide: also catch rays that start inside a mascot
          o.userData.mascot = r.name;
          meshes.push(o);
        });
      // world AABB per mascot mesh (for footprint + fly-path checks)
      const meshBoxes = meshes.map((m) => {
        m.geometry.computeBoundingBox();
        const b = m.geometry.boundingBox.clone().applyMatrix4(m.matrixWorld);
        return { name: m.userData.mascot, min: b.min.toArray(), max: b.max.toArray() };
      });
      const o = new V(), t = new V(), d = new V(), hits = [];
      let rays = 0;
      const perSeat = {};
      for (const s of seats) {
        o.fromArray(s.p);
        let n = 0;
        for (const tg of targets) {
          t.fromArray(tg.p);
          if (tg.n && (s.p[0] - tg.p[0]) * tg.n[0] + (s.p[1] - tg.p[1]) * tg.n[1] + (s.p[2] - tg.p[2]) * tg.n[2] <= 0) continue; // face not visible from this side
          d.subVectors(t, o);
          const len = d.length();
          rc.set(o, d.normalize());
          rc.near = 0;
          rc.far = len;
          rays++;
          n++;
          const h = rc.intersectObjects(meshes, false)[0];
          if (h) hits.push({ seat: s.id, target: tg.name, mascot: h.object.userData.mascot, at: h.point.toArray().map((v) => +v.toFixed(1)) });
        }
        perSeat[s.id] = n;
      }
      return { mascots: roots.map((r) => ({ name: r.name, pos: r.getWorldPosition(new V()).toArray().map((v) => +v.toFixed(1)) })), meshBoxes, rays, perSeat, hits };
    },
    seats,
    targets
  );

  // mascot world AABB (union per mascot)
  const union = {};
  for (const b of res.meshBoxes) {
    const u = (union[b.name] ??= { min: [...b.min], max: [...b.max] });
    for (let i = 0; i < 3; i++) (u.min[i] = Math.min(u.min[i], b.min[i])), (u.max[i] = Math.max(u.max[i], b.max[i]));
  }

  // 1) nothing on/above a seat or floor block
  const footprint = [];
  for (const b of res.meshBoxes) for (const s of venue.sections) if (rectOverlapsPoly(b, s.points)) footprint.push(`${b.name} over ${s.id}`);

  // 2) fly-in paths never enter a mascot (AABB grown by 1 m for the near plane / camera body)
  const flyHits = new Set();
  const P = new THREE.Vector3();
  for (const [w, h] of VIEWPORTS)
    for (const s of venue.sections) {
      const c = flightPath(s, mapHeight(w, h));
      for (let i = 0; i <= 600; i++) {
        c.getPoint(i / 600, P);
        for (const b of res.meshBoxes)
          if (P.x > b.min[0] - 1 && P.x < b.max[0] + 1 && P.y > b.min[1] - 1 && P.y < b.max[1] + 1 && P.z > b.min[2] - 1 && P.z < b.max[2] + 1) flyHits.add(`${s.id}@${w}x${h} → ${b.name}`);
      }
    }

  // per-section summary: floor blocks, then bowl grouped by tier
  const bySec = {};
  for (const s of venue.sections) bySec[s.id] = { rays: res.perSeat[s.id], hits: res.hits.filter((h) => h.seat === s.id).length };
  const groups = {};
  for (const s of venue.sections) {
    const g = s.kind === "floor" ? "floor" : `${s.id[0]}xx`;
    const G = (groups[g] ??= { sections: 0, rays: 0, hits: 0 });
    G.sections++;
    G.rays += bySec[s.id].rays;
    G.hits += bySec[s.id].hits;
  }
  report[vid] = {
    mascots: res.mascots.map((m) => ({ ...m, aabb: union[m.name] && { min: union[m.name].min.map((v) => +v.toFixed(1)), max: union[m.name].max.map((v) => +v.toFixed(1)) } })),
    rays: res.rays,
    groups,
    floor: Object.fromEntries(venue.sections.filter((s) => s.kind === "floor").map((s) => [s.id, bySec[s.id]])),
    hits: res.hits.slice(0, 40),
    footprintOverlaps: footprint,
    flyPathHits: [...flyHits].slice(0, 40),
    ok: res.mascots.length === 4 && res.hits.length === 0 && footprint.length === 0 && flyHits.size === 0,
  };
  if (!report[vid].ok) failed = true;
  await page.close();
}
await browser.close();
server.close();
console.log(JSON.stringify(report, null, 1));
fs.mkdirSync("docs/perf", { recursive: true });
fs.writeFileSync("docs/perf/mascot_raycheck.json", JSON.stringify({ at: new Date().toISOString(), report }, null, 1));
console.log(failed ? "MASCOT RAYCHECK: FAIL" : "MASCOT RAYCHECK: PASS");
process.exit(failed ? 1 : 0);
