// What a phone actually downloads: node scripts/transfer.mjs <dist> [venue]
// Lists every request up to the first idle 3D frame (390×844 phone), with raw bytes and
// the bytes a gzip-ing host (GitHub Pages) would send for text assets. Also dist totals.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import puppeteer from "puppeteer-core";
const [dir, venue = "wuxi"] = process.argv.slice(2);
const BASE = "/concert_viewing/";
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".jpg": "image/jpeg", ".webp": "image/webp", ".png": "image/png", ".glb": "model/gltf-binary", ".json": "application/json" };
const seen = [];
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (!p.startsWith(BASE)) return res.writeHead(404).end();
  p = p.slice(BASE.length) || "index.html";
  const f = path.join(dir, p);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) return res.writeHead(404).end();
  seen.push(p);
  res.writeHead(200, { "content-type": MIME[path.extname(f)] ?? "application/octet-stream" });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
const page = await browser.newPage();
await page.emulate({ viewport: { width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true }, userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1" });
await page.goto(`http://127.0.0.1:${server.address().port}${BASE}?venue=${venue}&quality=high`, { waitUntil: "networkidle0" });
await new Promise((r) => setTimeout(r, 3000));
await browser.close();
server.close();
const size = (p) => {
  const b = fs.readFileSync(path.join(dir, p)), text = /\.(js|css|html|json)$/.test(p);
  return { raw: b.length, wire: text ? zlib.gzipSync(b, { level: 9 }).length : b.length };
};
let raw = 0, wire = 0;
for (const p of [...new Set(seen)]) {
  const s = size(p);
  raw += s.raw;
  wire += s.wire;
  console.log(String(s.wire).padStart(9), String(s.raw).padStart(9), p);
}
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const all = walk(dir).map((f) => size(path.relative(dir, f)));
console.log(JSON.stringify({ venue, firstFrame: { requests: new Set(seen).size, rawKB: +(raw / 1024).toFixed(0), wireKB: +(wire / 1024).toFixed(0) }, distTotal: { files: all.length, rawKB: +(all.reduce((a, s) => a + s.raw, 0) / 1024).toFixed(0), wireKB: +(all.reduce((a, s) => a + s.wire, 0) / 1024).toFixed(0) } }));
