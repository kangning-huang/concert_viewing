# iMac redo status

Machine local times below; Ken zone Europe/London = UTC+0 (same as box).

## Done
- Path: `/Users/kh3657/Documents/repos/concert_viewing`
- Branch: `source` @ `e22eb24` (Pages-only preserved at `../concert_viewing_pages_only`)
- Remote: `origin` → `kangning-huang/concert_viewing` — **not pushed**; **Pages not published**
- Docs/steers: DESIGN, BOWL_PARAMS (scaffold), X_PHOTOREAL_PROMPTS, all STEER_*, prompts/steer-bowl-then-aaa.md
- Vite + React + R3F scaffold; `npm install && npm run build` OK (`dist/` present)
- XHS on disk: **150** images (138 nest / 12 unknown / 0 wuxi) + `manifest.jsonl`
  - gh release `xhs-refs-2026-11-09` was missing
  - Used prior box tar from QR-login collect (`xhs_inbox_150_2026-11-09.tar.gz`)
  - Photo blobs gitignored (disk lean); manifest tracked

## Agents running / blocked
| Agent | ID / PID | Status |
|-------|----------|--------|
| Claude `-p` (opus) | session `a3035333-6ffa-44e3-925c-cbedbf7eb577`, PID **87838** | **busy** — researching Nest bowl (found cited 332.3×296.4 m, height 68.5/40.1 m from construction PDF); reviewing XHS thumbs. Log file buffered empty; transcript growing under `~/.claude/projects/-Users-kh3657-Documents-repos-concert-viewing/` |
| Claude `--bg -n concert-bowl-aaa` | `43943b7c` / `1eb8cd91` | **stopped** — stuck on startup trust dialog (`needs: open this session to continue setup`) |
| Codex `exec --yolo` gpt-6-luna | session `01a1c164-66dd-7a63-a8ba-eeea02f0c4f2` | **failed 401** `invalid_jwt` / token refresh — needs `codex login` on iMac. Log: `logs/codex-bowl-aaa-20261110-013903.log` |

## Blockers for parent
1. **Codex auth** — Ken must re-login Codex on iMac
2. **Claude --bg trust** — open `claude` once in `concert_viewing` and accept trust if you want named bg sessions; `-p` path is working without that
3. **Disk** — ~11 GB free (98%); keep assets lean
4. **Mac mini / LaCie** still offline — iMac is the redo host
5. Wuxi bowl params still to be filled by Claude research; no remesh yet (correct per gate)

## Not done (agents / later)
- Finish BOWL_PARAMS citations for Nest + Wuxi
- AAA shared-stage pass after research
- Wuxi bowl remesh when params filled
- Astra vs Opus screenshots
- Pages publish

## Poster-styled seat start page (2026-11-09 evening London / iMac local)
- Start phase uses **official Damai seat-map bitmap** `public/refs/wuxi/damai_seatmap.jpg` (copied from `assets/refs/web/wuxi/`). **Not** the old Meridian SVG oval / abstract bowl.
- Chrome / deep-space skin: tokens in `styles.css` (`--bg #0b0c12`, chrome gradients, Damai tier colors). No mint `#6fffd2`, no Songti masthead.
- Flow: map → pick 贴脸 / 黄金角 / 全场 → 「查看视角」 → R3F view. Hud restyled to same chrome chips; 「选座图」 returns to map.
- Bowl remesh still gated on BOWL_PARAMS; camera seeds are placeholders only.
