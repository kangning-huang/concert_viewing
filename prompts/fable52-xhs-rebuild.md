# Follow-up: rebuild the 3D from the 150 Xiaohongshu concert photos

You already finished a first AAA pass on branch `aaa-fable52` in ~/Documents/repos/concert_viewing_aaa. Keep that branch. Do not touch main, gh-pages, source, restore-c941445, or ~/Documents/repos/concert_viewing_restore. Do not publish. Commit and `git push origin aaa-fable52` only.

Your first report said the result is "not photoreal" and "a detailed, stylised live show." That is not enough. Ken now asks you to rebuild the 3D model from the 100+ concert-goer photos we already gathered from 小红书 (Xiaohongshu / XHS).

## Photo set (read and look at these, do not skip)
They are already linked in this worktree:
- `assets/refs/xhs/nest/` — 139 WebP photos from 薛之谦「万兽之王」at the Beijing Nest
- `assets/refs/xhs/unknown/` — 13 more show photos
- `assets/refs/xhs/wuxi/` — empty (only a .gitkeep). There are no Wuxi photos. The shared stage kit is the same in every city, so use the Nest photos for the stage. Do not invent a Wuxi-only stage look.
- `assets/refs/xhs/manifest.jsonl` — 150 rows with venue and section hints
- `assets/refs/web/` — a few extra web refs
- `~/Documents/repos/concert_viewing/docs/refs/X_PHOTOREAL_PROMPTS.md`
- `~/Documents/repos/concert_viewing/docs/refs/BOWL_PARAMS.md`

Open many of the photos. Group them by what they show: stage front, LED volume content and frame, IMAG screens, truss and lighting rig, catwalk, mascots (whale, elephant, giant, airship), roof/bowl from the seats, crowd and light-sticks, haze and beam colour. Write a short photo-derived checklist into `docs/XHS_STAGE_MATCH.md` (what each part should look like, with photo file names as evidence). Then change the 3D until those parts match the photos, not a stylised stand-in.

## What to change
- Rebuild the shared stage kit (`joker_xue_2026`) so a seat POV looks like the Nest photos: proportions, materials, LED bezels, truss density, lighting colours, haze, mascot shapes and paint, and the real show photos already used on the LED/IMAG.
- Keep mascots outside the audience (above or behind the stage). `npm run raycheck` must still report 0 hits.
- Bowl: match what the photos show of the Nest interior (rails, vomitories, roof steel where visible). For Wuxi, keep the Damai seat layout and close gaps, but do not invent a look the photos do not support.
- Stay small and smooth: first 3D frame under ~5 MB, total under ~15 MB, 60 fps target, same camera curves (1.6 s in, 1.25 s out). Keep Damai map, seat picking, `/wuxi/` `/beijing/` `?venue=`, and `?quality=` tiers.

## Verify
- `npm run build`, `npm run raycheck` (0 hits), `scripts/smoke.mjs`.
- New screenshots at `docs/refs/screenshots/aaa_xhs_*.png` for Wuxi D3, C3, 409 and Nest D3, plus a hero shot. In `docs/AAA_FABLE52.md`, add a section that lists which photo files drove which 3D change, plus new size and fps numbers.
- Commit in small steps and push `aaa-fable52`.
