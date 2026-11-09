# NOW — concert_viewing (iMac redo)

You are working in `/Users/kh3657/Documents/repos/concert_viewing` (Vite + React + R3F).

## Product locks
- Nest 鸟巢 = effect demo only.
- First delivery = 薛之谦「万兽之王」无锡站 at 无锡奥林匹克体育中心体育场 — shareable 贴脸 + 黄金角 seat POV links for 票务中介 WeChat quotes.
- Shared stage kit `joker_xue_2026` identical every city; Nest stage photos transfer to Wuxi; only bowl/seats differ.
- Phone-first; AAA photoreal when device allows; adaptive Ultra→Low (~60 FPS, floor ~45); never force max graphics on weak phones.
- Meridian-style map→3D fly-in.
- Read: `docs/DESIGN.md`, all root `STEER_*.md`, `docs/refs/BOWL_PARAMS.md`, `docs/refs/X_PHOTOREAL_PROMPTS.md`.

## Order (do not reorder)
**(A)** Research Nest + Wuxi bowl 3D params into `docs/refs/BOWL_PARAMS.md` with citations. Do not invent meters. Leave UNKNOWN.
**(B)** Only after photo gate (≥100 under `assets/refs/xhs/`): Nest / shared-stage AAA grounded in those XHS (and alt) refs. Keep kit id `joker_xue_2026`.
**(C)** Wuxi bowl remesh **only** when Wuxi params in BOWL_PARAMS are filled; always reuse shared stage.

## Constraints
- Disk tight (~13GB free) — lean assets, no Drive `.git`, no duplicate trees.
- Do not force-push destroy Pages `main` history; commit on `source`; publish build separately later.
- Prefer improving real geometry + adaptive quality over fake photoreal.
- Report blockers clearly (missing citations, missing photos, disk).

Start with (A) bowl research. Write sources into BOWL_PARAMS.md. Then check photo counts. Then proceed (B)/(C) only when gates pass.
