# Task: AAA photoreal stadium + stage version (branch aaa-fable52)

You work in ~/Documents/repos/concert_viewing_aaa on branch `aaa-fable52`. It starts from `restore-c941445`, the approved live build. That build must stay intact.

## Hard rules
- Do NOT touch branches main, gh-pages, source, or restore-c941445. Do NOT touch ~/Documents/repos/concert_viewing_restore. Do NOT publish or deploy anywhere. Commit on aaa-fable52 and `git push origin aaa-fable52` only.
- No .git checkout in Google Drive.
- Keep everything Ken already approved working exactly as now:
  - The 2D start page is the official Damai Wuxi seat map with clickable hotspots (floor blocks, 2xx sections, 4xx price bands). Specific-seat picking must still work. Nest keeps its current map.
  - The camera fly-in and pan must stay as smooth as now (1.6 s in, 1.25 s out, same curves). Do not retune it.
  - Real Nest concert photos stay on the LED volume and IMAG screens.
  - Mascots must never block any audience seat. Keep them above or behind the stage. Run `npm run raycheck` after any change. It must report 0 hits for Wuxi and Nest.
  - One shared stage kit (joker_xue_2026) for every city. Only the bowl and seats differ per city.
  - `/wuxi/`, `/beijing/`, and `?venue=` keep picking the venue.

## Goal
Make a new version of the stadium and stage 3D with insanely detailed, AAA-looking photoreal graphics. It must be small to download and run smooth as butter, phone-first.

Reference material (read first):
- ~/Documents/repos/concert_viewing/docs/refs/BOWL_PARAMS.md (researched bowl geometry: use it, do not invent proportions)
- ~/Documents/repos/concert_viewing/docs/refs/X_PHOTOREAL_PROMPTS.md (photoreal three.js techniques)
- ~/Documents/repos/concert_viewing/assets/refs/xhs/{nest,wuxi,unknown} + manifest.jsonl (100+ real concert-goer stage photos), assets/refs/web
- docs/refs/screenshots in this repo (current approved look)

Suggested direction (you decide the details):
- Bowl: real rake and tier heights, concourse gaps, vomitories, railings, roof/canopy structure, light towers; close the gaps in the Wuxi bowl. Instanced seats with LOD; distant seats become textured impostors.
- Stage: match the real 万兽之王 stage from the photos: truss, LED volume, IMAG, catwalk, lighting rigs. Volumetric-looking beams (cheap cones/sprites, not ray-marching on phones), haze, crowd light-sticks as instanced points.
- Lighting: baked lightmaps/AO for static geometry, PBR materials, ACES/AgX tone mapping, bloom only on emissive. Avoid real-time shadows on low tier.
- Size: KTX2/Basis textures, meshopt or Draco geometry, procedural detail where possible. Budget: first meaningful 3D frame under ~5 MB transferred, total under ~15 MB. Report real numbers.
- Smoothness: 60 fps on a mid phone, no frame over 33 ms during fly-in or pan, no hitch when the 3D loads (preload/compile shaders before fly-in, decode textures off the main thread). Keep the `?quality=` tiers and adaptive quality.

## Verify before you finish
- `npm run build` passes. `npm run raycheck` = 0 hits. scripts/smoke.mjs passes.
- Measure fps and worst frame (fly-in + pan) at phone viewport, and report bundle/asset sizes before vs after.
- Save screenshots to docs/refs/screenshots/aaa_*.png: Wuxi map (phone), Wuxi D3, Wuxi C3, Wuxi 409, Nest D3, plus a wide hero shot.
- Write docs/AAA_FABLE52.md: what changed, sizes, fps numbers, known gaps. Plain short sentences.
- Commit in small steps and push aaa-fable52.
