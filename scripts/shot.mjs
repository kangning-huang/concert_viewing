// Review screenshots: node scripts/shot.mjs <dist> <out.png> "<query>" [w h dpr waitMs]
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";
const [dir, out, query, w = 390, h = 844, dpr = 2, wait = 3500] = process.argv.slice(2);
const BASE = "/concert_viewing/";
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".jpg": "image/jpeg", ".webp": "image/webp", ".png": "image/png", ".wasm": "application/wasm", ".json": "application/json" };
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
const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
const outs = out.split("|"), queries = query.split("|");
for (let i = 0; i < queries.length; i++) {
  const page = await browser.newPage();
  page.on("pageerror", (e) => console.log("PAGEERROR", String(e)));
  page.on("console", (m) => (m.type() === "error" || m.type() === "warning") && console.log(m.type(), m.text().slice(0, 600)));
  await page.setViewport({ width: +w, height: +h, deviceScaleFactor: +dpr, isMobile: +w < 720, hasTouch: +w < 720 });
  await page.goto(`http://127.0.0.1:${server.address().port}${BASE}?${queries[i]}`, { waitUntil: "load" });
  await new Promise((r) => setTimeout(r, +wait));
  await page.screenshot({ path: outs[i] });
  await page.close();
}
await browser.close();
server.close();
