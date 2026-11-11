# AAA stadium + stage (branch `aaa-fable52`)

Starts from `restore-c941445`. Nothing was published or deployed.

## What stayed the same

- 2D start page: Damai Wuxi map, hotspots, per-seat picking. Nest keeps its map. No UI code changed.
- Camera fly-in and pan: `CameraRig.jsx` flight path, 1.6 s in, 1.25 s out, curves and damping are untouched.
- Real Nest photos on the LED volume and the four IMAG screens. Same files, same mapping.
- Mascots: same positions, above the stage. `npm run raycheck` reports 0 hits for Wuxi and Nest.
- One shared stage kit (`joker_xue_2026`) for both cities. Only the bowl differs.
- `/wuxi/`, `/beijing/` and `?venue=` still pick the venue. `?quality=` tiers and adaptive quality still work.

## What changed

**Bowl (new, `src/scene/venue/ProcBowl.jsx`)**

- The bowl is now built in code at start-up. No bowl file is downloaded. The two GLBs (3.1 MB) left the bundle.
- Tier rings, heights and rake are the same numbers as the approved build, so every seat POV sits where it did.
- Roof numbers come from the approved GLBs plus the cited figures in `BOWL_PARAMS.md`:
  Wuxi has 64 cantilever trusses, 128 radial cables, 6 hoop cables and a 30 m inner membrane.
  Nest has 24 columns, primary trusses tangent to the 185.3 × 127.5 m roof opening, and the lattice shell.
- Wuxi gaps are closed: concourse walkways, fascia walls and a back wall now join the three tiers and the roof.
- Added: aisles, vomitories, parapets with handrails, LED ribbon boards on the tier fronts, field with turf and track.
- Seats and people are drawn per seat cell in the stand shader. Far away they fade to their mean colour, so there is no shimmer. This is the impostor LOD.
- Closed sections show empty seats. Sections on sale show a crowd.
- Light on static geometry is baked per vertex and only tinted by the cue colour at runtime.
- Phones on the medium and low tiers now get this full bowl. Before, they got plain placeholder rings.

**Crowd (new, `src/scene/Crowd.jsx`)**

- Near a bowl seat: real 3D steps, tip-up seats and neighbours (instanced). The stand shader cuts a hole there.
- Floor: lit standing people with heads and clothing colours, instead of black capsules.
- Light sticks: instanced points, only where tickets are on sale.

**Stage (`src/stage/JokerXueStage.jsx`)**

- Matched to the Nest photos: flat roof canopy on four columns, bulbs around the rim, truss grid and moving heads under it, PA hangs at the corners. This replaces the arch.
- LED walls use an LED shader: visible diodes and cabinet seams up close, HDR glow.
- Beams are cheap cones with soft edges and drifting haze. No ray-marching.
- Added a singer with two follow spots, low floor smoke, a glossy deck, and a night sky.
- Screen positions and sizes did not move, so the ray check targets are still valid.

**Rendering (`src/scene/StageCanvas.jsx`)**

- HDR pipeline: bloom only on values above 1.0 (screens, bulbs, lasers, light sticks), then ACES tone mapping.
- Real-time shadows are off on every tier. Nothing used them.
- All screen photos are decoded off the main thread and uploaded before the first fly-in.
- Warm-up frames compile every shader behind the map.
- Cue changes no longer create materials.
- Phone pixel ratio cap is 1.5 on the high tier (was 1.25). Medium and low stay at 1.25.

## Sizes

Measured with `node scripts/transfer.mjs <dist> <venue>` at 390 × 844. "Wire" means text files gzipped, images as stored.

| | Before | After |
|---|---|---|
| First 3D frame, Wuxi | 2562 KB | 1358 KB |
| First 3D frame, Nest | 3029 KB | 1097 KB |
| Whole `dist`, wire | 5521 KB | 2394 KB |
| Whole `dist`, raw | 6337 KB | 3183 KB |
| JS bundle, gzip | 326 KB | 316 KB |

Budget was 5 MB first frame and 15 MB total. Both are met.

## Frame times

Measured with `scripts/smoke.mjs` at 390 × 844, headless Chrome on an Apple M1, vsync off. Times are ms per frame. All 8 cases pass.

High tier (`docs/perf/smoke_aaa_final.json` vs `smoke_aaa_baseline.json`):

| | Before | After |
|---|---|---|
| Fly-in median | 1.7–2.8 | 3.0–3.6 |
| Fly-in worst frame | 9.6–18.1 | 10.2–15.6 |
| Pan (look) worst frame | 4.7–12.9 | 5.5–6.9 |
| Cue switch worst frame | 57–91 | 5.6–8.1 |
| Frames over 33 ms | 0 | 0 |

Medium tier with 4× CPU throttle, a rough mid-phone proxy (`smoke_aaa_final_medium_cpu4.json` vs `smoke_aaa_baseline_medium_cpu4.json`):

| | Before | After |
|---|---|---|
| Fly-in median | 2.9–3.9 | 3.4–4.3 |
| Fly-in worst frame | 20.2–22.9 | 20.7–24.9 |
| Pan worst frame | 5.6–17.3 | 6.4–17.1 |
| Cue switch worst frame | 19.0–22.5 | 12.7–22.1 |
| Frames over 33 ms | 0 | 0 |

So the median frame costs about 1 ms more on this machine. The worst frames are the same or better. The old 60–90 ms hitch on the first cue switch is gone.

## Checks run on the final build

- `npm run build`: passes.
- `npm run raycheck`: PASS, 0 hits, Wuxi and Nest.
- `node scripts/smoke.mjs dist aaa_final`: 8 of 8 pass.

## Screenshots

In `docs/refs/screenshots/`: `aaa_map_wuxi_phone`, `aaa_map_nest_phone`, `aaa_pov_wuxi_D3_phone`, `aaa_pov_wuxi_C3_phone`, `aaa_pov_wuxi_409_phone`, `aaa_pov_nest_D3_phone`, `aaa_hero_wuxi`, `aaa_hero_nest`.

Review any angle with `?cam=x,y,z,tx,ty,tz` (no UI). Add `&cue=red` and so on.

## Known gaps

- **No real phone was tested.** All numbers are from an M1 Mac. The CPU throttle does not slow the GPU. The 60 fps on a mid phone target is not proven. Please test on a real device before publishing.
- **Not photoreal yet.** It reads as a stylised, detailed live show, not a photo. People are simple shapes. Mascots are still the old blob models.
- **Bowl proportions are still unverified.** `BOWL_PARAMS.md` lists rake, tier heights and top-row height as UNKNOWN for both venues. I kept the approved numbers and did not invent new ones.
- **Nest roof is flat at 81 m.** The cited roof is a saddle, 68.5 m to 40.1 m. I did not lower it because the approved top row sits at 70 m.
- **Wuxi has no reference photos** (`assets/refs/xhs/wuxi` is empty). Its interior is built from the GLB and the cited structure only.
- **No KTX2, meshopt or Draco.** There is no geometry file left to compress. The phone photo set is small (the largest is 1024 × 512), and a Basis transcoder would add about 0.5 MB. WebP decoded off-thread was the smaller download.
- **The stage still uses three real-time point lights** for the mascots, columns and roof slab. The bowl and crowd do not use them.
- **The stage roof canopy is new geometry above the LED box.** The ray check only tests mascots. Upper-tier views across the stage were checked by eye, not by a script.
- **Start-up cost was not measured.** The bowl is generated and shaders compile during the first frames, behind the map.
- The phone pixel-ratio cap moved from 1.25 to 1.5 on the high tier. If a high-tier phone runs hot, set it back in `dprRange` in `StageCanvas.jsx`.
- `@react-three/drei` is still in `package.json` but is no longer imported.

---

# Follow-up: rebuilt from the Xiaohongshu photos

Nothing was published or deployed. Only `aaa-fable52` was pushed.

All 150 photos in `assets/refs/xhs/` were viewed and grouped. The checklist with photo evidence is in `docs/XHS_STAGE_MATCH.md`. The first pass got the stage proportions wrong: the photos show a shorter, deeper LED volume, six towers, an open truss roof, a runway ring, and IMAG screens out at the field corners.

## Which photos drove which change

| 3D change | File | Photos |
|---|---|---|
| LED volume resized to 40 × 22 × 14.4 m (was 45 × 16 × 13), flown under the roof | `src/stage/kit.js` | `nest_首场_0001`, `nest_526_0004`, `nest_226_0001` |
| Six truss towers inside the LED volume (was four columns) | `JokerXueStage.jsx` | `nest_大对角_0006`, `nest_大对角_0003` |
| Roof is an open truss grid 52 × 34 m with a deep rim (was a solid slab 60 × 27 m) | `RoofCanopy` | `nest_526_0004`, `nest_首场_0001`, `nest_731_0003` |
| Rim: one row of blinders between two strip lines; rainbow on the confetti cue | `RoofCanopy`, `Bulbs` | `nest_大对角_0006`, `nest_226_0005`, `nest_917_0005` |
| Runway ring with rounded corners around a smaller deck, bridges, edge blinders (was one flat 57 × 36 m deck) | `DeckAndRunway` | `nest_526_0001`, `nest_526_0004`, `nest_首场_0001` |
| Lit floor tiles on the deck | `DECK_FS` | `nest_皇帝位_0010`, `nest_718_0006` |
| Reed belt on all four sides with speaker cubes (was one side) | `Reeds` | `nest_526_0001`, `nest_526_0004` |
| IMAG towers moved out to the field corners (±40, ±24), deep scaffold, screen on both faces | `ScreenTower`, `kit.js` | `nest_山顶_0005`, `nest_526_0001`, `nest_718_0001`, `nest_537_0012` |
| PA line arrays hang in front of the LED faces (were at the roof corners) | `PaHangs` | `nest_526_0004`, `nest_大对角_0006` |
| LED faces: lit bezel, 1.0 × 0.5 m cabinets; title card on all four faces before the show; real captures per cue | `LED_FS`, `useLedTextures` | `nest_537_0006`, `nest_526_0004`, `nest_917_0001`, `nest_226_0011` |
| About 130 narrow beams in one draw call: roof sunburst, rim curtain, runway up-lights, thin lasers (were 43 fat cones) | `Beams` | `nest_517_0004`, `nest_226_0002`, `nest_226_0006`, `nest_山顶_0005`, `nest_537_0008` |
| Cue colours resampled; blinders get their own colour | `CUES` | `nest_526_0001`, `nest_226_0005`, `nest_山顶_0005`, `nest_517_0004` |
| Elephant, whale, airship, giant: new shapes and paint | mascot components | `nest_首场_0004`, `nest_皇帝位_0006`, `nest_731_0005`, `nest_大对角_0005`, `unknown_全价位_0001` |
| Nest seats: red with white seats mixed in, all tiers (were red / purple / blue) | `venues.js`, `STAND_FS` | `nest_首场_0002`–`0004`, `nest_526_0005` |
| Nest ceiling: pale membrane with thin seams that takes the show colour and gobos (was exposed steel trusses) | `ProcBowl.jsx` | `nest_山顶_0005`, `nest_718_0008`, `nest_517_0011` |
| Follow-spot trusses and delay PA hung under the Nest roof opening | `ProcBowl.jsx` | `nest_首场_0001`, `nest_718_0009`, `nest_526_0002` |
| Light sticks: most fans hold one, warm white with a cue tint | `STAND_FS` | `nest_大对角_0003`, `nest_大对角_0006` |

Wuxi: no Wuxi photos exist, so the bowl look is unchanged. It gets the shared stage kit and the light-stick change. The 12 `unknown_全价位_*` photos show this stage in another stadium and agree with the kit.

## What stayed the same

- Camera curves (1.6 s in, 1.25 s out), Damai map, seat picking, `/wuxi/`, `/beijing/`, `?venue=`, `?quality=`. No UI code changed.
- Mascot positions. They stay above the stage roof. `npm run raycheck`: PASS, 0 hits, Wuxi and Nest. The ray check now reads its targets from `src/stage/kit.js`, and it tests both faces of each IMAG tower.
- Tier rings, heights and rake in both bowls.

## Sizes (after this pass)

Same method as above (`scripts/transfer.mjs`, 390 × 844).

| | First AAA pass | Now |
|---|---|---|
| First 3D frame, Wuxi | 1358 KB | 1198 KB |
| First 3D frame, Nest | 1097 KB | 937 KB |
| Whole `dist`, wire | 2394 KB | 2189 KB |
| Whole `dist`, raw | 3183 KB | 2985 KB |
| JS bundle, gzip | 316 KB | 320 KB |

One cue plate (`led_feed_red.jpg`) is no longer shipped; the red cue now uses the real red captures. Budget is 5 MB first frame and 15 MB total.

## Frame times (after this pass)

Same method as above. Apple M1, headless Chrome, vsync off, 390 × 844. All 8 cases pass on both runs. Files: `docs/perf/smoke_xhs_final.json`, `docs/perf/smoke_xhs_final_medium_cpu4.json`.

| High tier | First AAA pass | Now |
|---|---|---|
| Fly-in median | 3.0–3.6 ms | 3.0–3.5 ms |
| Fly-in worst frame | 10.2–15.6 ms | 9.8–14.6 ms |
| Pan worst frame | 5.5–6.9 ms | 5.8–9.5 ms |
| Cue switch worst frame | 5.6–8.1 ms | 7.5–9.9 ms |
| Frames over 33 ms | 0 | 0 |

| Medium tier, 4× CPU throttle | First AAA pass | Now |
|---|---|---|
| Fly-in median | 3.4–4.3 ms | 2.8–3.6 ms |
| Fly-in worst frame | 20.7–24.9 ms | 19.4–22.0 ms |
| Pan worst frame | 6.4–17.1 ms | 6.0–18.2 ms |
| Cue switch worst frame | 12.7–22.1 ms | 11.5–13.1 ms |
| Frames over 33 ms | 0 | 0 |

These are frame times on a Mac, well under the 16.7 ms that 60 fps needs. **No real phone was tested**, so 60 fps on a phone is still not proven.

## Checks run on the final build

- `npm run build`: passes.
- `npm run raycheck`: PASS, 0 hits, both venues.
- `node scripts/smoke.mjs dist xhs_final`: 8 of 8 pass. Medium tier with 4× CPU throttle: 8 of 8 pass.

## New screenshots

In `docs/refs/screenshots/`:

- `aaa_xhs_pov_wuxi_floor_D3`, `aaa_xhs_pov_wuxi_floor_C3`, `aaa_xhs_pov_wuxi_bowl_409`, `aaa_xhs_pov_nest_floor_D3` (the four asked for)
- `aaa_xhs_hero_nest`, `aaa_xhs_hero_nest_red`, `aaa_xhs_hero_wuxi`
- Extra from the smoke run: `aaa_xhs_pov_nest_floor_A1`, `aaa_xhs_pov_nest_bowl_636`, `aaa_xhs_pov_wuxi_bowl_224`, `aaa_xhs_pov_wuxi_band_409a`, `aaa_xhs_map_nest`, `aaa_xhs_map_wuxi`

Good pairs to compare: `aaa_xhs_hero_nest_red` with `nest_山顶_0005`; `aaa_xhs_hero_wuxi` with `unknown_全价位_0010`; `aaa_xhs_hero_nest` with `nest_226_0001`.

## Still not matched

- It is closer to the photos in layout, proportion and colour, but it is still not a photo. People are simple shapes. Mascots are built from spheres and tubes.
- The LED volume does not split into two bands (`nest_大对角_0003`) and is not see-through (`nest_226_0008`).
- Mascots float above the roof. In the Nest they stand on plinths over lower-tier seats, which the keep-out rule forbids. The lion and eagle are not modelled.
- Floor blocks show standing people. The photos show seated blocks.
- Stage sizes are read from photo ratios against the 57 × 36 m seat-map footprint. No drawing with metres was found.
- Nest roof height, tier heights and rake are unchanged and still unverified (`BOWL_PARAMS.md`).
- Views from behind an IMAG tower are partly blocked by it, as in the real show (`nest_317_0001`). The ray check only tests mascots.
- The "Known gaps" list above still applies where this section does not replace it.

# Follow-up 2: seated silhouette crowd, LED bands, lion and eagle

Nothing was published or deployed. Only `aaa-fable52` was pushed.

## What changed

### Crowd
- **Everyone sits.** There are no standing people anywhere. Floor blocks are rows of chairs facing the stage (0.5 m seats, 0.9 m rows).
- **People are silhouette cutout boards.** One alpha-tested card per fan, instanced, no sorting. Each card picks one of 32 outlines, with small size, lean and tint jitter and a slow sway.
- **The outlines come from the real photos.** 16 head outlines are cut from the dark foreground audience in 7 photos. The list, and what is drawn rather than photographed, is in `docs/XHS_STAGE_MATCH.md`.
- **Light.** Backs are near-black with a thin rim of the show colour on head and shoulders. Seen from the stage side, cards take the wash colour. Raised phones and light sticks glow and bloom. About one fan in six holds one up.
- **Three levels of detail.** Cards on the floor blocks and on the 3D seats around a bowl seat. Beyond that, the stand shader paints the same outlines per seat cell with one texture read. The twinkling light-stick points are kept.
- The seat sheet said "standing audience in front". It now says "heads of the audience in front".

### LED wall
- **Two bands.** The upper band (9.6 m) stays under the roof. The lower band (4.8 m) drops by cue: closed for the title and confetti songs, 3.6 m on the red song (`nest_226_0011`), 6.4 m on the blue song (`nest_大对角_0003`).
- **See-through mesh.** The black box inside the wall is gone. Where the content is dark, the towers and far stands show through. Bright content hides them (`nest_226_0008`).
- **Module grid.** 1.0 × 0.5 m cabinets, the 4 × 2.4 m carrying frame, a lit bezel round each band.
- **Content.** The red song has a new lower-band plate rectified from `nest_226_0011`. Other cues run the existing real captures across both bands.

### Mascots
- **Lion** (`nest_首场_0002`) and **eagle** (`nest_首场_0003`) are new. The **elephant** is rebuilt the same way.
- Each is one mesh: smooth lofted body, limbs, trunk, wings; paint in vertex colours. One draw call each, no textures.
- All inflatables carry a little of their own light, so the paint reads under a dark or strongly coloured wash.
- Whale, airship and giant keep their shapes. The whale gets the new skin material only.
- All six sit above the stage roof. `npm run raycheck`: PASS, 0 hits, Wuxi (3278 rays) and Nest (5056 rays), 0 footprint overlaps, 0 fly-path hits.

### A hitch found and fixed
- With the heavier scene, about one fly-in in ten had a single 100 ms frame at the start.
- Cause: the seat-marker ring was mounted on the first fly-in frame, so its shader was linked right then. The first-pass build had the same stall, but smaller (13–17 ms).
- Fix: the ring is always mounted, so it compiles during the hidden warm-up frames. 30 of 30 repeat runs were clean afterwards.

## What stayed the same

Damai map, seat picking, camera curves (1.6 s in, 1.25 s out), real photos on screens, `/wuxi/`, `/beijing/`, `?venue=`, `?quality=`. One review-only addition: `?seat=<section id>` opens straight on a seat, for screenshots.

## Sizes

Same method as before (`scripts/transfer.mjs`, 390 × 844).

| | XHS pass | Now |
|---|---|---|
| First 3D frame, Wuxi | 1198 KB | 1267 KB |
| First 3D frame, Nest | 937 KB | 1006 KB |
| Whole `dist`, wire | 2189 KB | 2307 KB |
| Whole `dist`, raw | 2985 KB | 3112 KB |
| JS bundle, gzip | 320 KB | 327 KB |

New files: silhouette atlas 45 KB, lower-band LED plate 20 KB (phone) and 53 KB (desktop). Budget is 5 MB first frame and 15 MB total.

## Frame times

Same method as before. Apple M1, headless Chrome, vsync off, 390 × 844. All 8 cases pass on both runs. Files: `docs/perf/smoke_sil_final.json`, `docs/perf/smoke_sil_final_medium_cpu4.json`.

| High tier | XHS pass | Now |
|---|---|---|
| Fly-in median | 3.0–3.5 ms | 3.0–3.3 ms |
| Fly-in worst frame | 9.8–14.6 ms | 10.4–16.9 ms |
| Pan worst frame | 5.8–9.5 ms | 5.1–8.0 ms |
| Cue switch worst frame | 7.5–9.9 ms | 6.5–8.7 ms |
| Frames over 33 ms | 0 | 0 |

| Medium tier, 4× CPU throttle | XHS pass | Now |
|---|---|---|
| Fly-in median | 2.8–3.6 ms | 2.8–3.5 ms |
| Fly-in worst frame | 19.4–22.0 ms | 19.8–22.6 ms |
| Pan worst frame | 6.0–18.2 ms | 5.6–13.4 ms |
| Cue switch worst frame | 11.5–13.1 ms | 11.2–18.3 ms |
| Frames over 33 ms | 0 | 0 |

**No real phone was tested.** These times are measured on the page's main thread on a Mac. They do not show GPU fill cost, and the cards and the see-through wall add overdraw. A check on a real phone is still needed.

## Checks run on the final build

- `npm run build`: passes.
- `npm run raycheck`: PASS, 0 hits, both venues, six mascots.
- `node scripts/smoke.mjs dist sil_final`: 8 of 8 pass. Medium tier with 4× CPU throttle: 8 of 8 pass.

## Screenshots

In `docs/refs/screenshots/`:

- Seat views with the UI: `aaa_sil_pov_wuxi_D3`, `aaa_sil_pov_wuxi_C3`, `aaa_sil_pov_wuxi_409`, `aaa_sil_pov_nest_D3`, `aaa_sil_pov_nest_floor_A1`.
- Seat views without the UI: `aaa_sil_hero_nest_seat_red` (Nest 119), `aaa_sil_hero_wuxi_seat_blue` (Wuxi 224), `aaa_sil_hero_nest_floor_purple` (Nest A1).
- LED: `aaa_sil_hero_led_split_red`, `aaa_sil_hero_led_split_blue`, `aaa_sil_hero_led_mesh_title`.
- Mascots: `aaa_sil_hero_lion`, `aaa_sil_hero_eagle`, `aaa_sil_hero_elephant`.
- Side by side: `aaa_sil_compare_nest_top_red`. Left is the real photo `nest_山顶_0005`; right is Nest section 602 on the red song.

## Still not matched

- **The side-by-side shows the bowl is too steep.** From the top tier the model looks down on the stage much more than the photo does. Tier heights and rake are still the unverified numbers in `BOWL_PARAMS.md`.
- **Outlines are heads only.** Shoulders and backs share one drawn template, so the crowd is more uniform than a real one. Raised arms, phones and sticks are drawn, not cut from photos.
- **The rim light draws a thin coloured line** round the nearest heads. It reads a little like an outline on the floor seats.
- **Cards are flat.** A neighbour in your own row turns to face the camera, which is right for a cutout board but not for a person.
- **The eye height is unchanged** (1.65 m above the step), which is higher than a seated head. The heads in front sit lower in the frame than in the photos.
- **LED content.** Only the red song has a second plate. The split heights are read from two photos; the real show moves the bands more freely.
- **Lion and eagle are simple.** They have the right pose, colours and big shapes, but no fur or sculpted feather relief, and the lion's face is plainer than the real one. Whale, airship and giant were not remodelled.
- Mascots fly above the roof instead of standing on their plinths over the lower tier.

# Follow-up 3: gaps pass

Nothing was pushed, published or deployed. Five commits on `aaa-fable52` after `889ee91`. No UI code, camera curve, stage kit dimension or mascot position changed.

**One thing first:** web search was not available in this session, so no new venue source was read. The Nest bowl was corrected from the figures already cited in `docs/refs/BOWL_PARAMS.md` plus measurements on the photos. Those numbers are marked `DERIVED` there, not `CITED`.

## What changed

### 1. Backs, shoulders and hair (crowd atlas)
- The single drawn shoulder template is gone. Eight back views are traced by hand from two photos: four seated people in `nest_首场_0001`, four in `unknown_全价位_0006`. They cover long loose hair, low and high ponytails, hair up, a bun, a hair curtain and short hair with broad shoulders.
- The 16 photo heads from the last pass now continue into whichever traced back fits them best.
- 24 plain outlines (was 16) and 8 with a phone or stick (was 16, half of them mirrored copies).
- The table of which photo each outline came from is in `docs/XHS_STAGE_MATCH.md`.

### 2. Lion and eagle relief
- **Lion** (`nest_首场_0002`): 15 mane locks are real geometry. The chest gets the dark bib from the photo. The body has mottled printed fur. Fine strands come from a normal map.
- **Eagle** (`nest_首场_0003`): 7 finger-like primaries run along each wing as ribs. Legs are slate. Body and wing coverts get scalloped feather rows from a normal map.
- The two normal maps are 64 × 64 and generated in code at start-up. Nothing is downloaded.
- Vertices: mane 974 → 2503, each wing 614 → 1769. Still one draw call per animal.

### 3. Bird's Nest bowl
- **Top-row eye height 71.7 m → 46.2 m.** This is 129.90 m × tan 19°35′, both from the stand designer's paper. Photo `nest_山顶_0005` independently measures 41–43 m a few rows down.
- **Tiers** are now 2–13.5 m, 14.5–27 m and 30.5–44.5 m (were 2–27, 26–45, 45–70). The split follows `nest_首场_0002`, including the box level between middle and upper tier.
- **Roof top 81 m → 68.5 m** (the cited maximum). **The ceiling now slopes**, from 39 m at the opening edge (measured on `nest_山顶_0005`) up over the stands. The concrete bowl ends at the cited 51.1 m.
- The plan rings did not move, so the 2D map, seat distances and angles on the seat sheet are the same.
- Method, numbers and what is still open: `docs/refs/BOWL_PARAMS.md`, section "Nest heights used in the model".
- Wuxi was not touched. Its Damai hotspots were re-checked by the smoke test: C3, D3, 224, 409 (¥717 band) and 409 (¥917 band) all open the right section and price.

### 4. Rim light
- The rim now depends on distance. The nearest rows get none and read as plain dark shapes. It comes in softly between 2.4 m and 8 m and fades out by 20 m.
- The band is wider and fainter, so it reads as a glow and not a line.

### 5. GPU-side cost
- New probe: `node scripts/overdraw.mjs <dist> <label>`. It uses a review-only URL mode (`?overdraw=<layer>`) that counts rasterised fragments per screen pixel, and GPU timer queries on the normal render. Viewport 390 × 844 at device pixel ratio 3, medium tier (the app renders 487 × 1055 there).
- **Finding:** cards and the see-through LED wall were not the main cost. The haze sprites were: about 5 full-screen additive layers from a floor seat.
- **Haze:** 32 sprites → 16 at twice the opacity. Same light in the air, half the fill, 16 fewer draw calls.
- **Cards:** plain cards are trimmed to the part of the atlas cell that holds the outline. The rim's second texture read is skipped where there is no rim.
- **LED wall and beams:** measured, small (0.03–0.35 and 0.3–0.6 fragments per pixel), left alone.

## Results

Overdraw, fragments per screen pixel, medium tier (`docs/perf/overdraw_gaps_before_medium.json`, `overdraw_gaps_after_medium.json`). This count depends on the scene only, not on the GPU. It is an upper bound: it ignores the depth test.

| View | All layers, before | All layers, after | Cards, before | Cards, after |
|---|---|---|---|---|
| Nest floor A1 | 13.5 | 8.7 | 1.46 | 1.11 |
| Nest floor D3 | 14.0 | 9.0 | 1.05 | 0.77 |
| Wuxi floor D3 | 7.7 | 5.3 | 1.38 | 1.00 |
| Wuxi floor C3 | 12.4 | 8.3 | 1.79 | 1.34 |
| Wuxi 409 | 9.0 | 7.9 | 1.57 | 1.12 |
| Nest 602 (top tier) | 4.5 | 8.9 | 0.04 | 0.95 |

Nest 602 is not a like-for-like row: the seat is 26 m lower now and looks across at the stage and its haze instead of down on it.

GPU time per frame from timer queries, **on an Apple M1, not a phone**: 2.4–2.9 ms median before, 2.4–2.7 ms after. That is no measurable change. The M1 is not fill-limited at this size, so this says nothing about a phone either way.

Frame times, same method as before (`smoke_gaps_final.json`, `smoke_gaps_final_medium_cpu4.json`). All 8 cases pass on both runs.

| | Last pass | Now |
|---|---|---|
| High: fly-in median | 3.0–3.3 ms | 3.0–3.2 ms |
| High: fly-in worst frame | 10.4–16.9 ms | 10.0–17.2 ms |
| High: pan worst frame | 5.1–8.0 ms | 5.0–6.6 ms |
| High: cue switch worst frame | 6.5–8.7 ms | 5.9–7.2 ms |
| Medium, 4× CPU: fly-in median | 2.8–3.5 ms | 3.3–4.0 ms |
| Medium, 4× CPU: fly-in worst frame | 19.8–22.6 ms | 20.0–22.9 ms |
| Medium, 4× CPU: pan worst frame | 5.6–13.4 ms | 6.3–15.5 ms |
| Medium, 4× CPU: cue switch worst frame | 11.2–18.3 ms | 9.8–15.8 ms |
| Frames over 33 ms | 0 | 0 |

Sizes (`scripts/transfer.mjs`, 390 × 844):

| | Last pass | Now |
|---|---|---|
| First 3D frame, Wuxi | 1267 KB | 1284 KB |
| First 3D frame, Nest | 1006 KB | 1023 KB |
| Whole `dist`, wire | 2307 KB | 2324 KB |
| JS bundle, gzip | 327 KB | 328 KB |

The crowd atlas grew from 45 KB to 59 KB.

## Checks run on the final build

- `npm run build`: passes.
- `npm run raycheck`: PASS, 0 hits, 0 footprint overlaps, 0 fly-path hits, Wuxi and Nest, six mascots.
- `node scripts/smoke.mjs dist gaps_final`: 8 of 8 pass. Medium tier with 4× CPU throttle: 8 of 8 pass.

## Screenshots

In `docs/refs/screenshots/`:

- Seat views with the UI: `aaa_gaps_pov_wuxi_D3`, `aaa_gaps_pov_wuxi_C3`, `aaa_gaps_pov_wuxi_409`, `aaa_gaps_pov_nest_D3`, `aaa_gaps_pov_nest_floor_A1`. Extra: `aaa_gaps_pov_nest_636`, `aaa_gaps_map_wuxi`, `aaa_gaps_map_nest`.
- Mascots: `aaa_gaps_hero_lion`, `aaa_gaps_hero_eagle`.
- Side by side: `aaa_gaps_compare_nest_top_red`. Left is `nest_山顶_0005`. Right is Nest 602 on the red song, cropped to the photo's field of view (about 51°).
- Near heads without the UI: `aaa_gaps_hero_nest_floor_red`.

## Still not fixed

- **No real phone was tested.** The overdraw count is device-independent, but how many milliseconds it buys on a phone is unknown.
- **No new venue research.** Web search was not available. Tier heights, the tier split and the ceiling height are derived, not published figures. They could be off by a few metres.
- **Nest plan is unverified and partly wrong.** End seats sit up to 142 m from the centre, beyond the cited 129.90 m. The real front row follows the running track and is more elongated. The model's outer roof plan (174 × 145 m half-axes) does not match the cited 166 × 148 m.
- **Nest roof saddle is not modelled.** The top is 68.5 m all round. The cited 40.1 m low points are missing because no source read says where they are.
- **The middle tier does not overhang the lower tier**, as it does in the real stadium.
- **Wuxi bowl heights were not reviewed.** Its top row is at 57 m, while the only cited building height is 50 m (unclear what that measures).
- **The side-by-side still differs.** Layout and steepness now agree. The model's ceiling is plain (no panel texture or lamps), its IMAG screens look larger, and the stage sits a little lower in the frame.
- **Traced outlines are coarse.** The people are 40–260 px across in the photos and traced by eye. Two of the eight are half-mirrored because a neighbour hides one side. Raised arms, phones and sticks are still drawn.
- **Near heads still have a hard cut edge.** The rim is gone, but the photos show soft, out-of-focus heads. Alpha-tested cards cannot blur.
- **Mascots.** The lion's face is still plain and the mane locks are regular. The eagle's primaries are ribs on one surface, not separate feathers with gaps. Under strongly coloured cues the relief is hard to see. Elephant, whale, airship and giant were not touched.
- **Truss lattices** (alpha-tested, lit) are the next largest overdraw layer after haze: about 4 fragments per pixel from a floor seat. Not reduced.
- Cards are flat boards, the eye height is still 1.65 m above the step, and mascots still fly above the roof. These are unchanged from the last pass.
