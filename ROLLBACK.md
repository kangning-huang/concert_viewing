# Rollback — interactive baseline (2026-11-09)

## Why
The iMac `source` Damai-poster path (commits through `b4ad787`) shipped on
`kangning-huang.com/joker-xue-3d/*` with an **un-clickable** seat bitmap and a
**hard cut** into 3D (map faded to black, then Canvas mounted). Ken asked to
roll back and rebuild on the previous live interactive version.

## What was “previous live”
- GitHub Pages: https://kangning-huang.github.io/concert_viewing/
- Artifact: `kangning-huang/concert_viewing` `main` @ `c941445`
  (vendored here as `pages-baseline/` — Meridian mint UI, SVG seats, smooth leave).
- Layout note: that SVG bowl is **not** the official Damai Wuxi geometry.

## What we restored (this baseline)
1. **Official Damai seatmap art** (`public/refs/wuxi/damai_seatmap_web.jpg`) —
   same zones / numbers / stage / closed sections as Damai.
2. **Clickable hotspots** overlaid on that bitmap (贴脸 / 黄金角×2 / 全场) —
   not the abstract Meridian SVG as the default map.
3. **Meridian-style leave**: perspective rotateX + opacity, and **3D mounts
   underneath during leave** so map→view is a crossfade, not a black cut.
4. Quick tabs +「进入视角」kept in sync with hotspot selection.

## For graphics work (Opus / next)
- Improve **SharedStage / stageTextures / lights / LED** using
  `assets/refs/xhs/nest/` (≥100 Nest shots). Shared stage kit across cities;
  per-city = seats/bowl only.
- **Do not** replace `SeatMapStart` with the abstract `pages-baseline` SVG.
- After every graphics change: smoke-test map clicks + fly-in; revert if either
  regresses.
- Damai exact hotspot polygons can be refined later; keep clickability.

## Deploy targets
- `kangning-huang.com/joker-xue-3d/wuxi|beijing` — Vite build with
  `VITE_BASE=/joker-xue-3d/{venue}/`
- GitHub Pages `/concert_viewing/` — Vite build with default base
