// node scripts/perf_table.mjs docs/perf/smoke_a.json [docs/perf/smoke_b.json …] → one line per case
import fs from "node:fs";
for (const f of process.argv.slice(2)) {
  const j = JSON.parse(fs.readFileSync(f));
  console.log(`\n${j.label}  quality=${j.quality ?? "high"} cpu×${j.cpuThrottle ?? 1}`);
  console.log("case".padEnd(18), "ok ", "flyin med/p95/max/>33ms".padEnd(26), "look med/max".padEnd(14), "cues med/max".padEnd(14), "idle med/max");
  for (const r of j.results) {
    const f3 = (s) => (s ? `${s.median}/${s.p95}/${s.max}/${s.jank33}` : "-"), f2 = (s) => (s ? `${s.median}/${s.max}` : "-");
    console.log(r.case.padEnd(18), r.ok ? "ok " : "FAIL", f3(r.flyin).padEnd(26), f2(r.look).padEnd(14), f2(r.cues).padEnd(14), f2(r.mapIdle), r.notes.join("; "));
  }
}
