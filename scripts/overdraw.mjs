// GPU-side cost probe (what the frame-time smoke test on a Mac cannot see).
//   node scripts/overdraw.mjs <builtDir> <label> [--quality medium] [--cpu 4]
// Phone-sized viewport (390 x 844, device pixel ratio 3; the app caps its own render scale per
// tier). For each view:
//   1. overdraw: the app's ?overdraw=<layer> mode draws every rasterised fragment as one step
//      of red (no depth test, no discard). Mean red / step = fragment-shader runs per screen
//      pixel for that layer. This number does not depend on the GPU, only on the scene.
//   2. GPU time: EXT_disjoint_timer_query_webgl2 around each animation frame of the normal
//      render, when the browser offers it. This is the Mac's GPU, not a phone's.
// Writes docs/perf/overdraw_<label>.json.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";
import { VENUES } from "../src/venues.js";

const [dir, label = "run"] = process.argv.slice(2);
const argOf = (name, def) => (process.argv.indexOf(name) > 0 ? process.argv[process.argv.indexOf(name) + 1] : def);
const QUALITY = argOf("--quality", "medium"), CPU = Number(argOf("--cpu", 1)), STEP = 4;
const BASE = "/concert_viewing/";
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".jpg": "image/jpeg", ".webp": "image/webp", ".png": "image/png", ".json": "application/json" };
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
const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist", "--disable-gpu-vsync", "--disable-frame-rate-limit"] });
const PHONE = { viewport: { width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true }, userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1" };

// seat views: the eye of the section, looking at the stage (no UI on top of the canvas)
const VIEWS = [["nest", "A1"], ["nest", "D3"], ["nest", "602"], ["wuxi", "D3"], ["wuxi", "C3"], ["wuxi", "409g"]];
const LAYERS = ["all", "silhouettes", "led-volume", "beams", "bowl"];
const camOf = (venue, id) => {
  const s = VENUES[venue].byId(id).seat;
  return `venue=${venue}&seat=${id}&cam=${s.x.toFixed(2)},${s.y.toFixed(2)},${s.z.toFixed(2)},0,12,0&quality=${QUALITY}`;
};
const meter = await browser.newPage();
async function meanRed(b64) {
  return meter.evaluate(async (b64) => {
    const img = new Image();
    img.src = "data:image/png;base64," + b64;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    const x = c.getContext("2d");
    x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data;
    let sum = 0, max = 0, sat = 0;
    for (let i = 0; i < d.length; i += 4) (sum += d[i]), d[i] > max && (max = d[i]), d[i] >= 252 && sat++;
    return { mean: sum / (d.length / 4), max, saturated: sat / (d.length / 4) };
  }, b64);
}

const results = [];
for (const [venue, id] of VIEWS) {
  const r = { view: `${venue}_${id}`, overdraw: {} };
  for (const layer of LAYERS) {
    const page = await browser.newPage();
    await page.emulate(PHONE);
    await page.goto(`${origin}?${camOf(venue, id)}&overdraw=${layer}`, { waitUntil: "load" });
    await new Promise((s) => setTimeout(s, 4500));
    const m = await meanRed(await page.screenshot({ encoding: "base64" }));
    r.overdraw[layer] = { perPixel: +(m.mean / STEP).toFixed(3), max: Math.round(m.max / STEP), saturated: +m.saturated.toFixed(4) };
    await page.close();
  }
  // GPU time of the normal render
  const page = await browser.newPage();
  await page.emulate(PHONE);
  if (CPU > 1) await page.emulateCPUThrottling(CPU);
  await page.evaluateOnNewDocument(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...a) {
      const gl = getContext.call(this, type, ...a);
      if (gl && type === "webgl2" && !window.__probe) {
        const ext = gl.getExtension("EXT_disjoint_timer_query_webgl2");
        window.__probe = { gl, ext, gpu: [], frame: [], pending: [] };
      }
      return gl;
    };
    const raf = window.requestAnimationFrame.bind(window);
    let queue = [], last = 0;
    window.requestAnimationFrame = (cb) => {
      if (!queue.length)
        raf((t) => {
          const run = queue, p = window.__probe;
          queue = [];
          let q = null;
          if (p?.ext && p.record) {
            for (let i = p.pending.length - 1; i >= 0; i--)
              if (p.gl.getQueryParameter(p.pending[i], p.gl.QUERY_RESULT_AVAILABLE)) {
                if (!p.gl.getParameter(p.ext.GPU_DISJOINT_EXT)) p.gpu.push(p.gl.getQueryParameter(p.pending[i], p.gl.QUERY_RESULT) / 1e6);
                p.gl.deleteQuery(p.pending[i]);
                p.pending.splice(i, 1);
              }
            q = p.gl.createQuery();
            p.gl.beginQuery(p.ext.TIME_ELAPSED_EXT, q);
          }
          for (const f of run) f(t);
          if (q) p.gl.endQuery(p.ext.TIME_ELAPSED_EXT), p.pending.push(q);
          if (p?.record && last) p.frame.push(t - last);
          last = t;
        });
      queue.push(cb);
      return queue.length;
    };
  });
  await page.goto(`${origin}?${camOf(venue, id)}`, { waitUntil: "load" });
  await new Promise((s) => setTimeout(s, 4000));
  await page.evaluate(() => window.__probe && (window.__probe.record = true));
  await new Promise((s) => setTimeout(s, 4000));
  const g = await page.evaluate(() => {
    const p = window.__probe, st = (a) => (a.length ? { n: a.length, median: +[...a].sort((x, y) => x - y)[a.length >> 1].toFixed(2), p95: +[...a].sort((x, y) => x - y)[Math.floor(a.length * 0.95)].toFixed(2) } : null);
    const dbg = p?.gl.getExtension("WEBGL_debug_renderer_info");
    return { timerQuery: !!p?.ext, gpuMs: p ? st(p.gpu) : null, frameMs: p ? st(p.frame) : null, buffer: p ? [p.gl.drawingBufferWidth, p.gl.drawingBufferHeight] : null, renderer: dbg ? p.gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : "?" };
  });
  Object.assign(r, g);
  await page.close();
  results.push(r);
  console.log(JSON.stringify(r));
}
await browser.close();
server.close();
const out = { label, quality: QUALITY, cpuThrottle: CPU, viewport: "390x844 @3 (app caps render scale per tier)", at: new Date().toISOString(), note: "overdraw.perPixel = rasterised fragments per screen pixel for that layer (no depth test, no discard). GPU times are from this Mac, not a phone.", results };
fs.mkdirSync("docs/perf", { recursive: true });
fs.writeFileSync(`docs/perf/overdraw_${label}.json`, JSON.stringify(out, null, 1));
