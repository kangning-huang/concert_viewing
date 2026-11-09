# concert_viewing

Phone-first stadium seat POV preview for China concerts (薛之谦「万兽之王」).

- **Nest 鸟巢** = effect demo only
- **First delivery** = 无锡奥林匹克体育中心体育场 — shareable 贴脸 + 黄金角 WeChat links
- Shared stage kit `joker_xue_2026` every city; bowls differ per venue

## Source vs Pages

- Branch `source` = Vite + React + R3F source of truth (this tree)
- Branch `main` / `gh-pages` = published static build for GitHub Pages
- Live: https://kangning-huang.github.io/concert_viewing/

Do **not** force-push over Pages history. Build with `npm run build`, then publish `dist/` deliberately.

## Dev

```bash
npm install
npm run dev
```

## Gates (do not skip)

1. Research Nest + Wuxi bowl params → `docs/refs/BOWL_PARAMS.md` (cited meters only)
2. ≥100 real stage-angle photos → `assets/refs/xhs/`
3. Then AAA photoreal remesh / materials (adaptive Ultra→Low)
