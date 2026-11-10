// node scripts/summarize.cjs docs/perf/smoke_X.json [...]
for (const f of process.argv.slice(2)) {
  const o = JSON.parse(require("fs").readFileSync(f, "utf8"));
  console.log(`== ${o.label}`);
  for (const r of o.results)
    console.log(`${r.case.padEnd(15)} ${r.skipped ? "SKIP" : r.ok ? "OK  " : "FAIL"} tap=${r.tapTarget ? r.tapTarget.w + "x" + r.tapTarget.h : "-"} pick=${r.picked ?? "-"} idle=${r.mapIdle?.median}/${r.mapIdle?.p95}ms flyin med=${r.flyin?.median} p95=${r.flyin?.p95} max=${r.flyin?.max} jank=${r.flyin?.jank33}/${r.flyin?.n} look med=${r.look?.median} p95=${r.look?.p95} Δ=${r.lookDelta} ctl=${r.controlDelta} cues max=${r.cues?.max} ${r.notes.join("; ")}`);
}
