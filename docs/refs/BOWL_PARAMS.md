# Bowl params (cited meters only)

**Gate:** Do not remesh a venue bowl until its critical rows below are filled with citations.
Placeholder / invented meters are forbidden. Leave `UNKNOWN` when unsure.

## Nest · 国家体育场（鸟巢）

| Param | Value | Source / notes | Status |
|-------|-------|----------------|--------|
| Plan size (E–W × N–S outer) | ~333 m × ~298 m (often cited ~333×280) | Common published Nest dimensions; confirm against a measured plan before remesh | NEEDS_CONFIRM |
| Seating capacity | ~80,000 (Olympic config varies) | Public stadium profiles | NEEDS_CONFIRM |
| Top / rear row height above field | UNKNOWN (section drawings exist in some architecture pubs; extract before remesh) | — | UNKNOWN |
| Lower bowl rake | UNKNOWN | — | UNKNOWN |
| Mid / upper bowl rake | UNKNOWN | — | UNKNOWN |
| Tier elevation breaks | UNKNOWN | — | UNKNOWN |
| Field / pitch size inside bowl | UNKNOWN for concert overlay | — | UNKNOWN |
| Concert stage placement | Center / thrust varies by tour; kit `joker_xue_2026` is shared | Tour photos | STAGE_VIA_SHARED_KIT |

> Prior Mac-mini pass claimed ~47 m top-row E–W and rakes ~15°/28°/33° from a published section — **re-verify with a citable source on this redo before Nest remesh**. Do not copy unverified numbers.

## Wuxi · 无锡奥林匹克体育中心体育场

| Param | Value | Source / notes | Status |
|-------|-------|----------------|--------|
| Seating capacity | ~50,000–60,000 (sources conflict; often ~50k–60k) | Municipal / ticketing blurbs | NEEDS_CONFIRM |
| Plan size / footprint | UNKNOWN | Need site plan or surveyed outline | UNKNOWN |
| Stadium / bowl height | UNKNOWN | Some Chinese sources mention ~50 m building height — confirm what that measures | UNKNOWN |
| Top / rear row height above field | UNKNOWN | Required before remesh | UNKNOWN |
| Lower / upper rake | UNKNOWN | Required before remesh | UNKNOWN |
| Tier elevations | UNKNOWN | Required before remesh | UNKNOWN |
| Concert stage | Center 四面台 / shared kit `joker_xue_2026` (Nest stage photos transfer) | Tour practice | STAGE_VIA_SHARED_KIT |
| Seat map sections for 贴脸 / 黄金角 | UNKNOWN — pull from 大麦/猫眼 seat map for 万兽之王无锡站 | Ticketing | UNKNOWN |

## Research checklist (agents)

1. Prefer primary sources: architect drawings, municipal stadium pages, survey figures, peer-reviewed / book plans.
2. Secondary OK if they quote numbers with a clear figure — still cite URL/title/date.
3. Seat-map screenshots go under `assets/refs/web/` (lean; no duplicates).
4. Update Status column: `UNKNOWN` → `NEEDS_CONFIRM` → `CITED`.
5. Only then remesh GLB / R3F bowl for that venue.

Last updated: 2026-11-09 (iMac redo scaffold — values intentionally conservative / UNKNOWN).
