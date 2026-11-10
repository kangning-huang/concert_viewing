// Phone smoke test + frame-time probe (390×844 @3x, touch).
//   node scripts/smoke.mjs <builtDir> <label> [--shots <prefix>]
// Serves <builtDir> at /concert_viewing/, then for each venue:
//   map renders → tap a SPECIFIC section on the SVG map → pick-card shows it →
//   进入视角 → record rAF frame deltas through the fly-in → POV sheet appears →
//   drag look-around (verify view changes) → 换座 fly-out back to map.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";

const [dir, label = "run"] = process.argv.slice(2);
const shotIdx = process.argv.indexOf("--shots");
const shotPrefix = shotIdx > 0 ? process.argv[shotIdx + 1] : null;
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

const browser = await puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: "new",
  args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist", "--disable-gpu-vsync", "--disable-frame-rate-limit"],
});

const stats = (a) => {
  const s = [...a].sort((x, y) => x - y), q = (p) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
  return { n: s.length, median: +q(0.5).toFixed(2), p95: +q(0.95).toFixed(2), max: +s[s.length - 1].toFixed(2), jank33: s.filter((x) => x > 33.4).length, mean: +(s.reduce((x, y) => x + y, 0) / s.length).toFixed(2) };
};

async function recordFrames(page, ms) {
  return page.evaluate(
    (ms) =>
      new Promise((res) => {
        const d = [];
        let last = performance.now();
        const t0 = last;
        const tick = (t) => {
          d.push(t - last);
          last = t;
          t - t0 < ms ? requestAnimationFrame(tick) : res(d.slice(1));
        };
        requestAnimationFrame(tick);
      }),
    ms
  );
}

// Tap the n-th visible (non-unsold) section whose map label equals `text`.
async function tapSection(page, text, nth = 0) {
  const box = await page.evaluate(
    (text, nth) => {
      const gs = [...document.querySelectorAll(".seat-svg g.sec[role=button]")].filter((g) => (g.querySelector("text")?.textContent ?? "") === text);
      const g = gs[nth];
      if (!g) return null;
      const r = g.querySelector("polygon,path,rect").getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2, aria: g.getAttribute("aria-label") };
    },
    text,
    nth
  );
  if (!box) throw new Error(`section "${text}" not on map`);
  await page.touchscreen.tap(box.x, box.y);
  return box;
}

// Downsampled pixels of a real screenshot (WebGL readback is blank without preserveDrawingBuffer).
async function shotPixels(page) {
  const b64 = await page.screenshot({ encoding: "base64", clip: { x: 0, y: 60, width: 390, height: 360 } });
  return page.evaluate(async (b64) => {
    const img = new Image();
    img.src = "data:image/png;base64," + b64;
    await img.decode();
    const g = document.createElement("canvas");
    g.width = 48;
    g.height = 44;
    const x = g.getContext("2d");
    x.drawImage(img, 0, 0, 48, 44);
    return [...x.getImageData(0, 0, 48, 44).data];
  }, b64);
}
const diff = (a, b) => a.reduce((s, v, i) => s + Math.abs(v - b[i]), 0) / a.length;

const CASES = [
  { venue: "wuxi", label: "C3", nth: 0, expect: "C3区", key: "wuxi_floor_C3" },
  { venue: "wuxi", label: "409", nth: 0, expect: "409区", key: "wuxi_bowl_409" },
  { venue: "nest", label: "A1", nth: 0, expect: "A1区", key: "nest_floor_A1" },
  { venue: "nest", label: "636", nth: 0, expect: "636区", key: "nest_bowl_636" },
];

const results = [];
let failed = false;
for (const c of CASES) {
  const page = await browser.newPage();
  await page.emulate({ viewport: { width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true }, userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1" });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  const r = { case: c.key, ok: true, notes: [] };
  try {
    await page.goto(`${origin}?venue=${c.venue}&quality=high`, { waitUntil: "load", timeout: 60000 });
    await page.waitForSelector(".seat-svg g.sec", { timeout: 20000 });
    await new Promise((s) => setTimeout(s, 4000));
    r.renderer = await page.evaluate(() => {
      const gl = document.createElement("canvas").getContext("webgl");
      const e = gl.getExtension("WEBGL_debug_renderer_info");
      return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : "?";
    });
    if (shotPrefix && c.nth === 0 && !results.some((x) => x.case.startsWith(c.venue))) await page.screenshot({ path: `${shotPrefix}_map_${c.venue}.png` });
    r.mapIdle = stats(await recordFrames(page, 1500));
    const tapped = await tapSection(page, c.label, c.nth);
    await new Promise((s) => setTimeout(s, 250));
    const picked = await page.$eval(".pick-card h2", (e) => e.textContent);
    r.picked = picked;
    if (picked !== c.expect) throw new Error(`picked "${picked}" expected "${c.expect}" (tapped ${tapped.aria})`);
    const selOn = await page.$$eval(".seat-svg g.sec.on", (gs) => gs.length);
    if (selOn !== 1) throw new Error(`expected 1 highlighted section, got ${selOn}`);
    await page.tap(".go");
    r.flyin = stats(await recordFrames(page, 1900));
    await page.waitForSelector(".sheet", { timeout: 6000 });
    await new Promise((s) => setTimeout(s, 600));
    const sheetTitle = await page.$eval(".sheet h2", (e) => e.textContent);
    if (sheetTitle !== c.expect) throw new Error(`POV sheet "${sheetTitle}"`);
    if (shotPrefix) await page.screenshot({ path: `${shotPrefix}_pov_${c.key}.png` });
    // look-around: drag on the upper canvas area (above the sheet)
    const a0 = await shotPixels(page);
    await new Promise((s) => setTimeout(s, 450));
    const a1 = await shotPixels(page);
    r.controlDelta = +diff(a0, a1).toFixed(2);
    const rec = recordFrames(page, 1400);
    await page.mouse.move(200, 200);
    await page.mouse.down();
    for (let i = 1; i <= 20; i++) {
      await page.mouse.move(200 - i * 9, 200 + i * 3);
      await new Promise((s) => setTimeout(s, 16));
    }
    await page.mouse.up();
    r.look = stats(await rec);
    const a2 = await shotPixels(page);
    r.lookDelta = +diff(a1, a2).toFixed(2);
    if (r.lookDelta < Math.max(3, r.controlDelta * 2)) throw new Error(`look-around did not move the view (delta ${r.lookDelta} vs control ${r.controlDelta})`);
    // 换座 → fly-out → map
    await page.tap(".change");
    await page.waitForSelector(".pick-card", { timeout: 6000 });
  } catch (e) {
    r.ok = false;
    r.notes.push(String(e.message ?? e));
    failed = true;
  }
  if (errors.length) r.notes.push(...errors.slice(0, 3));
  results.push(r);
  await page.close();
}
await browser.close();
server.close();
const out = { label, at: new Date().toISOString(), results };
console.log(JSON.stringify(out, null, 1));
fs.mkdirSync("docs/perf", { recursive: true });
fs.writeFileSync(`docs/perf/smoke_${label}.json`, JSON.stringify(out, null, 1));
process.exit(failed ? 1 : 0);
