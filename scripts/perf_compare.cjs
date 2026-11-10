// Aggregate repeated smoke runs: node scripts/perf_compare.cjs <dir> <prefixA> <prefixB>
// Pools every frame-time sample per phase across runs and cases, so single-frame
// outliers are judged by rate, not by one unlucky run.
const fs = require("fs");
const path = require("path");
const [dir, A, B] = process.argv.slice(2);

function pool(prefix) {
  const files = fs.readdirSync(dir).filter((f) => f.startsWith(`smoke_${prefix}_`));
  const out = { runs: files.length, cases: 0, fails: 0, flyin: [], look: [], cues: [], idle: [], lookDelta: [] };
  for (const f of files) {
    const o = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    for (const r of o.results) {
      if (r.skipped) continue;
      out.cases++;
      if (!r.ok) out.fails++;
      // per-run stats only kept summary numbers; rebuild weighted summaries
      for (const k of ["flyin", "look", "cues", "idle"]) {
        const s = k === "idle" ? r.mapIdle : r[k];
        if (s) out[k].push(s);
      }
      if (r.lookDelta) out.lookDelta.push(r.lookDelta);
    }
  }
  return out;
}

const agg = (arr) => {
  const n = arr.reduce((a, s) => a + s.n, 0);
  const jank = arr.reduce((a, s) => a + s.jank33, 0);
  const med = arr.map((s) => s.median).sort((a, b) => a - b);
  const p95 = arr.map((s) => s.p95).sort((a, b) => a - b);
  const max = arr.map((s) => s.max).sort((a, b) => a - b);
  const mid = (v) => v[v.length >> 1];
  return { frames: n, medianOfMedians: mid(med), medianP95: mid(p95), worstP95: p95[p95.length - 1], medianMax: mid(max), worstMax: max[max.length - 1], framesOver33ms: jank, per1000: +((jank / n) * 1000).toFixed(2) };
};

const rows = [];
for (const [label, p] of [[A, pool(A)], [B, pool(B)]]) {
  rows.push({ build: label, runs: p.runs, cases: p.cases, fails: p.fails });
  for (const k of ["idle", "flyin", "look", "cues"]) rows.push({ build: label, phase: k, ...agg(p[k]) });
}
console.table(rows);
