# concert_viewing — Design locks

Phone-first stadium seat POV for China concerts. Live demo:
https://kangning-huang.github.io/concert_viewing/

## Product

| Role | Venue | Status |
|------|-------|--------|
| Effect demo only | 国家体育场（鸟巢）Nest | Demo map → 3D fly-in |
| **First delivery** | 无锡奥林匹克体育中心体育场 · 薛之谦「万兽之王」 | Shareable **贴脸** + **黄金角** seat POV links for 票务中介 WeChat quotes |

Buyer v0 = Ken’s existing 票务中介 contact (not Damai/Maoyan/venue HQ yet).

UX bar: Meridian-style **2D seat map → 3D fly-in** with distance / FOV / offset metrics and zone tags (贴脸 / 黄金角 / 全景).

Start-page skin: **Damai「万兽之王」poster / seat-map** — deep-space `#0b0c12`, chrome silver title, Damai tier colors. The seat layout itself is the **official Damai bitmap** (`public/refs/wuxi/damai_seatmap.jpg`), not a redrawn SVG bowl. No Meridian mint / Songti masthead on the Wuxi start screen.

## § Shared stage

- One tour stage kit id: **`joker_xue_2026`**
- Identical in every city (Nest, Wuxi, …)
- Nest concert-goer stage-angle photos **transfer** as stage grounding for Wuxi
- Only the **bowl / seat structure** around the stage changes per stadium

## § Bowl params gate

**Before ANY bowl remesh** (Nest or Wuxi):

1. Research real venue sources for:
   - plan size / footprint (length × width or radius)
   - capacity / bowl outline
   - rear / top-row seat height above field
   - tier elevations and rake angles
2. Write cited meters into `docs/refs/BOWL_PARAMS.md`
3. Mark UNKNOWN explicitly — **do not invent meters**
4. Remesh only fields that are filled with citations

Wuxi remesh is blocked until Wuxi plan size, top-row height, tier elevations, and rake are filled.

## § Adaptive quality

- Target look: AAA photoreal **when the device can take it**
- Tiers: **Ultra → High → Medium → Low**
- Keep ~**60 FPS**, floor ~**45** on fly-in + look-around
- Drop post-FX / shadows / DPR / anisotropy / LOD first on slow phones
- Never force max graphics on weak phones
- Override: `?quality=ultra|high|medium|low`

Tier contents live in `src/quality.ts`. Going down a tier drops bloom, then shadows, reflection probe, grass, haze, beams and texture size. Auto-downgrade needs two 1.5 s windows under 45 FPS and is off when `?quality=` is set or a tier is picked in the HUD.

## § Photoreal pass status

- `joker_xue_2026` materials are procedural (`src/stageTextures.ts`), matched by eye to `assets/refs/xhs/nest/`. LED content is an in-house stand-in: title in a system font, no official wordmark or show footage.
- **Bowl is still the flat non-metric placeholder** (materials only). Wuxi plan size, rake and top-row height are UNKNOWN in `BOWL_PARAMS.md`, so the sparkle on it is not seat data and 黄金角 elevation is a placeholder.
- Sightlines: field props stay under `FLOOR_PROP_MAX_HEIGHT`, below floor eye height. Mascots or sculptures, if added, go behind or below seats, never between floor seats and the stage.
- `?fly=0` skips the fly-in (captures, reduced motion).

## § Wuxi delivery

Minimum shippable sample:

1. Phone-first Pages (or preview) build
2. Two deep links with seat/zone in the URL:
   - 贴脸 (close / on-field adjacent)
   - 黄金角 (sweet-spot angle on shared stage)
3. Shared `joker_xue_2026` stage (Nest-photo grounded after XHS gate)
4. Wuxi bowl geometry only after `BOWL_PARAMS.md` Wuxi rows are filled

Nest remains the visual / fly-in effect demo; do not block Wuxi delivery on full Nest polish.

## § Photo gate (before AAA)

≥ **100** real concert-goer **stage-angle** photos under `assets/refs/xhs/`
(`nest/`, `wuxi/`, `unknown/` + `manifest.jsonl`).

If 小红书 is blocked, use alt sources per `STEER_ALT_SOURCES.md` — still ≥100 before AAA remesh/materials.

## § Storage

- Source of truth: iCloud `~/Documents/repos/concert_viewing` (this tree) or LaCie when Mac mini is back
- **Never** put a live `.git` inside Google Drive
- Drive only for deliberate uploads (e.g. photo tarballs), not the working tree
- Keep assets lean on the iMac (~13 GB free)

## Source vs Pages git

- Branch **`source`**: Vite + R3F source (this repo)
- Branch **`main` / `gh-pages`**: published static site (do not force-push destroyively)
- Publish: `npm run build` → copy `dist/` deliberately to Pages branch
