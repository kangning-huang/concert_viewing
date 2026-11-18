# Bowl params (cited meters only)

**Gate:** Do not remesh a venue bowl until its critical rows below are filled with citations.
Placeholder / invented meters are forbidden. Leave `UNKNOWN` when unsure.

**Status key:** `CITED` = number read in a named source · `DERIVED` = worked out from cited numbers and/or measured on a photo, method given below, not a published figure · `NEEDS_CONFIRM` = real source, but conflicting or unclear what it measures · `UNKNOWN` = no source found.

**Gate state (2026-11-10):** Nest remesh **BLOCKED** · Wuxi remesh **BLOCKED**. Both lack top-row height, tier elevations and rake.

**Update 2026-11-11 (gaps pass, branch `aaa-fable52`):** the Nest bowl heights were corrected anyway, on Ken's instruction, because the old model contradicted the cited figures (top row at 70 m, above the 68.5 m roof). No new source was read in that pass: web search was not available in the session. The new heights are `DERIVED`, not `CITED`; see "Nest heights used in the model". The plan and all of Wuxi are unchanged and still open.

## Nest · 国家体育场（鸟巢）

| Param | Value | Source | Status |
|-------|-------|--------|--------|
| Outer plan, roof top surface (N–S × E–W) | 332.3 m × 296.4 m max | [N1] designer paper | CITED |
| Same, rounded | 333 m × 296 m | [N3] | CITED |
| Same, conflicting E–W | 333 m × **280 m** | [N2] builder paper | NEEDS_CONFIRM: see conflicts |
| Roof height, max / min | 68.5 m / 40.1 m | [N1] | CITED |
| Building height (conflicting datum) | 69.21 m; concrete structure 51.1 m; ±0.00 = 43.50 m elevation | [N2] | CITED |
| Roof opening (N–S × E–W) | 185.3 m × 127.5 m | [N1] ([N2] gives ~185 × ~125) | CITED |
| Roof column spacing | 24 truss columns at 37.958 m | [N1] | CITED |
| Capacity | 80,000 fixed + 11,000 temporary | [N1] | CITED |
| Tier count | 3 (lower / middle / upper); boxes between middle and upper | [N3][N4] | CITED |
| Middle tier | Cantilevered; front 15 rows extend over lower tier | [N5] secondary copy of Arup Journal | NEEDS_CONFIRM |
| Bowl structure | 6 independent segments, 200 mm joints | [N5] | NEEDS_CONFIRM |
| Lower-tier front edge | Just over 1 m from the 110 m hurdles pre-run line | [N4] | CITED |
| Photographers' trench | 2.1 m wide × 1.05 m deep | [N4] | CITED |
| Track | Sight-line curve covers nearly all 9 lanes | [N4] | CITED |
| Sight-line design | C = 0.06 m; focal point height 0 m; eye 1.2 m high, 150 mm forward of row's rear edge; seat height 0.42 m | [N4] | CITED |
| Max viewing distance to field centre | 129.90 m | [N4] | CITED |
| Max depression angle to field centre | 19°35′ | [N4] | CITED |
| **Top / rear row height above field** | eye about 46 m (model: 46.2 m), row step 44.5 m | Worked out from [N4] and from photo `nest_山顶_0005`; see below | DERIVED |
| **Lower bowl rake** | model: 14.6° (ends) to 18.3° (sides) | Follows from the tier heights below and the unchanged plan | DERIVED |
| **Mid / upper bowl rake** | model: mid 22–27°, upper 27–32° | Same | DERIVED |
| **Tier elevation breaks** | model: 2–13.5 m / 14.5–27 m / 30.5–44.5 m | Split read off photo `nest_首场_0002`; see below | DERIVED |
| Membrane ceiling at the opening edge | about 38–40 m (model: 39 m) | Measured on photo `nest_山顶_0005`; see below | DERIVED |
| Pitch / infield size for concert overlay | UNKNOWN | — | UNKNOWN |
| Concert stage placement | Central stage on field, per seat-map photo in `assets/refs/xhs/nest/`; kit `joker_xue_2026` | Tour photos | STAGE_VIA_SHARED_KIT |

### Nest source conflicts

- **E–W width: 296.4 m [N1][N3] vs 280 m [N2].** Using 296.4 m: [N1] is the designer's paper and the municipal page agrees. [N2] does not explain its 280 m. Neither figure is the concrete bowl's outline.
- **Height: 68.5 m [N1] vs 69.21 m [N2].** Probably different datums; not resolved.
- **Viewing distance: 129.90 m [N4] vs 140 m / 142 m** in tourism pages. [N4] says 140 m was the limit for the earlier 100,000-seat scheme, so use 129.90 m for the built 91,000.

### Nest heights used in the model (gaps pass, 2026-11-11)

What was wrong: the model had the top row at 70 m (eye 71.7 m) and a flat roof at 81 m. The cited roof is 68.5 m at its highest [N1] and the concrete bowl is 51.1 m [N2]. From the top tier the model looked down on the stage much more steeply than photo `nest_山顶_0005`.

**Top-row eye height: 46.2 m.**
- [N4] gives a maximum viewing distance to the field centre of 129.90 m and a maximum depression angle of 19°35′. If both belong to the same top side seat and the distance is horizontal, the eye is at 129.90 × tan 19°35′ = 46.2 m. If the distance is the sight line, it is 43.5 m. [N4] does not say which, so this is a bound, not a quoted height.
- The model's top side row is 129.6 m from the centre in plan, so it takes the 46.2 m value.
- Independent check on photo `nest_山顶_0005` (taken from the top tier, long side): the far IMAG towers and the LED wall give a camera about 117 m from the centre (lens about 51° wide); the visible strip of the stage roof's top surface (about 45 px deep) puts the camera 12–14 m above that roof, so the eye is at 41–43 m. That is 19.7° to the field centre, against the cited maximum of 19°35′. The stage sizes this uses are themselves read off photos (`src/stage/kit.js`), so treat it as ±5 m.

**Tier split: 2–13.5 m, 14.5–27 m, 30.5–44.5 m** (front row to back row of the lower, middle and upper tier).
- Photo `nest_首场_0002` shows the far stand nearly square-on: lower tier, middle tier (sections 221, 222), a dark box level, then the upper tier. Their heights in the picture are about 350 : 440 : 130 px (lower : middle : boxes), with a 90 px shadow gap where the middle tier overhangs the lower.
- Those proportions were fitted between the field and the 44.5 m top row. The box level between middle and upper tier is cited [N3][N4]; its height is not.
- The model cannot overhang tiers (they follow one another in plan), so the cantilevered front of the middle tier [N5] is not modelled.

**Ceiling: 39 m at the opening edge, rising outwards.** In `nest_山顶_0005` the near edge of the membrane ceiling cuts the view 3–4° below the horizon, 53 m in front of the camera (opening 127.5 m wide [N1]). That puts the edge at 38–40 m. The model raises the ceiling to 2 m above the 51.1 m concrete bowl [N2] over the top row. The roof top is 68.5 m [N1] all round: **the saddle (40.1 m low points) is still not modelled**, because no source read says where the low points are.

**Not corrected, still open:**
- **Plan.** *Partly corrected in the Blender pass (2026-11-16, below).* Map rings are unchanged: 53–164 m on the long axis, ×0.79 on the short axis. The real front row follows the running track and is much more elongated than the model's. A plan drawing is needed.
- **Model outer roof plan** is 174 × 145 m (half-axes), from the old GLB; the cited outline is 166.15 × 148.2 m.
- **Rake** is a result of the heights and the unverified plan, not a cited number.

### Nest 3D plan, Blender pass (2026-11-16, branch `aaa-blender`)

- **What changed:** in 3D only, the long axis of every tier ring is pulled in linearly between the front edge (53 m, unchanged, still unsourced) and **129.90 m** at the back of the top tier, the cited maximum viewing distance [N4]. Short axis unchanged (top row 129.6 m already fits). Result: lower 53–83.5 m, middle 86.3–107.7 m, upper 110.5–129.9 m on the long axis. No point of the 3D bowl lies beyond 129.90 m from the centre; the farthest seat camera (636) is at 124.6 m. Status: `DERIVED` (cited bound, linear fit is a modelling choice).
- **What did not change:** the 2D map polygons, labels and hotspots (still drawn from the old rings), every tier height, the roof.
- **Side effect:** the seat sheet's "距舞台" for end sections is now measured from the corrected 3D seat, so it is shorter than before (e.g. 636: 94 m).
- **Still not modelled, no source:** the roof saddle (where the 40.1 m low points are; web search and fetch were refused in this session, so [N1] could not be re-read) and the middle-tier overhang. [N5] says the front 15 rows overhang the lower tier (`NEEDS_CONFIRM`), but with the derived heights (lower tier ends at 13.5 m, middle tier starts at 14.5 m) a 15-row (~12.7 m) overhang leaves no headroom over the lower tier's back rows, so the two cannot both be right; left as is.

### Prior "~47 m top row, rakes ~15°/28°/33°" claim

**Not verified; do not use.** No source read contains these figures. (The derived heights above land close to it, 46 m and about 15–18° / 22–27° / 27–32°, but that is not a citation.)
A consistency check only: if the 129.90 m and 19°35′ in [N4] were the same seat and the distance horizontal, eye height would be about 46 m. [N4] states neither, so this is not a citable height. Depression angle to field centre is also not the same thing as tier rake.

### Nest sources (accessed 2026-11-10)

- **[N1]** 范重 et al., 国家体育场大跨度钢结构设计与研究, 《建筑结构学报》28(2), 2007. http://www.xiaonianduan.com/media/Design_and_reserach_of_large-span_steel_structure_for_the_National_Stadium.pdf
- **[N2]** 李久林 et al., 国家体育场（鸟巢）工程施工新技术综述, 《建筑技术》vol. 39. https://demo.ltpower.net/web/gzgcxm/news/upload/video/20181210/194536.pdf
- **[N3]** 北京市人民政府, 国家体育场. https://www.beijing.gov.cn/renwen/rwzyd/qxdw/shaozhcqychy/gjtyc/202309/t20230921_3263702.html
- **[N4]** 谭泽阳, 国家体育场看台设计, 《建筑创作》2011(12). http://xueshu.qikan.com.cn/preview/1/284/2833817
- **[N5]** Extract from The Arup Journal, secondary copy. https://felicityparsons.co.uk/index.php/extract-from-the-arup-journal/

**Best lead for the UNKNOWN rows:** *The Arup Journal*, Beijing National Stadium Special Issue (2009), "The bowl" articles by Tony Choi & Thomas Lam and by Xiaonian Duan & Goman Ho. The only copy found is paywalled on Studocu. The full text of [N4] may also include section figures.

## Wuxi · 无锡奥林匹克体育中心体育场

> **Venue trap:** this is the new 60,000-seat stadium. The old 无锡市体育中心 (28,146 seats, built 1994) is a different building; do not use its figures.

| Param | Value | Source | Status |
|-------|-------|--------|--------|
| Capacity | 60,000 | [W1][W2][W3] | CITED |
| Stadium floor area | ~116,000 m² | [W1] planning figure, 2023 | CITED |
| Building height | 50 m | [W1] planning figure, 2023; datum and what it measures not stated | NEEDS_CONFIRM |
| Roof outline | "四心拟合圆形", long axis ~246 m, short axis ~185.2 m | [W2] | NEEDS_CONFIRM: see below |
| Inner membrane roof depth | ~30 m | [W2] | CITED |
| Roof structure | 64 outward-leaning cantilever trusses; 128 radial cables, 6 hoop cables | [W2] | CITED |
| Bowl form | Saddle-shaped stands (马鞍形看台); massing narrower below, wider above | [W4] | CITED |
| Complex site | ~56 ha | [W3] | CITED |
| **Plan size / bowl footprint** | **UNKNOWN** | — | UNKNOWN |
| **Top / rear row height above field** | **UNKNOWN** | — | UNKNOWN |
| **Lower / upper rake** | **UNKNOWN** | — | UNKNOWN |
| **Tier count and elevations** | **UNKNOWN** | — | UNKNOWN |
| Concert stage | Shared kit `joker_xue_2026` | [STEER_SHARED_STAGE] | STAGE_VIA_SHARED_KIT |
| Show dates | 11.13–15, 11.20–22, 18:30 | [W5] | CITED |
| Price tiers | 内场 1717 / 1517 / 1317; 看台 917 / 717 / 517 / 317 | [W5] | CITED |
| Seat map for 贴脸 / 黄金角 | Damai diagram on disk (`assets/refs/web/wuxi/damai_seatmap.jpg`) | [开票雷达/大麦 alicdn] | CITED |

### Do not use 246 × 185.2 m as the bowl footprint

[W2] calls it the roof outline, but it looks too small for a 60,000-seat bowl around an athletics field. It may describe an inner ring or opening. The wording does not settle this, so the plan-size row stays `UNKNOWN`.

### Wuxi sources (accessed 2026-11-10)

- **[W1]** 无锡本地宝, 无锡奥体中心可以容纳多少人, 2023-08-24. https://m.wx.bendibao.com/xiuxian/77537.shtm
- **[W2]** 无锡发布 via 澎湃, 无锡奥体中心最新进展！, 2025-06-09. https://m.thepaper.cn/newsDetail_forward_30954388
- **[W3]** gmp Architekten, Wuxi Olympic Sports Center. https://www.gmp.de/en/projects/14146/wuxi-olympic-sports-center
- **[W4]** 无锡日报 via 中国江苏网, 2025-02-27. https://jsnews.jschina.com.cn/wx/a/202502/t20250227_s67d91658e4b0ed434077a1ab.shtml
- **[W5]** 澎湃号·政务, 又有一波重磅演唱会定档无锡, 2026-10-24. https://www.thepaper.cn/newsDetail_forward_34323428

**Leads for the UNKNOWN rows:** gmp or sbp directly (gmp publishes a masterplan and an arena section, but no stadium section was found); CNKI for 无锡奥体中心 structural papers; 江苏省公共资源交易平台 tender documents; a 大麦/猫眼 seat-map screenshot. Save drawings under `assets/refs/web/`.

## Research checklist (agents)

1. Prefer primary sources: architect drawings, municipal stadium pages, survey figures, peer-reviewed / book plans.
2. Secondary OK if they quote numbers with a clear figure — still cite URL/title/date.
3. Seat-map screenshots go under `assets/refs/web/` (lean; no duplicates).
4. Update Status column: `UNKNOWN` → `NEEDS_CONFIRM` → `CITED`.
5. Only then remesh GLB / R3F bowl for that venue.

Last updated: 2026-11-16 (Nest 3D plan pulled inside the cited 129.90 m; no new sources).


## Seat map found (2026-11-09)

Damai official seat/zone diagram saved at `assets/refs/web/wuxi/damai_seatmap.jpg` (3305×2361).
Source: https://img.alicdn.com/imgextra/i4/2251059038/O1CN01IP1U7bZncwG6i2uw_!!2251059038.jpg (via https://piao.zalize.com/show/1089011559335/).
Damai item: https://m.damai.cn/shows/item.html?itemId=1089011559335 · Maoyan: https://show.maoyan.com/detail/512082

Readable from the diagram (verify labels by eye):
- Price tiers: 内场 1717 / 1517 / 1317; 看台 917 / 717 / 517 / 317
- Floor blocks A/B/C/D around the stage; lower bowl ~200s; upper ~400s
- 224–226 labeled 主席台 on lower bowl
- Some sections behind stage marked closed / restricted view

This closes the seat-map row for broker 贴脸 / 黄金角 links. It does **not** fill plan size, top-row height, or rake — those remain UNKNOWN for remesh.

## Ganzhou · 赣州市全民健身中心体育场

| Param | Value | Source | Status |
|-------|-------|--------|--------|
| Outer plan (长轴 × 短轴) | 307 m × 297 m | [G1][G2] 蓉江新区发布, steel-roof closure 26 Dec 2022 | CITED |
| Steel roof, max height | 59.7 m | [G1][G2][G3][G4] | CITED |
| Steel roof, inward cantilever | 39 m | [G1][G2][G3][G4] | CITED |
| Building height (conflicting datum) | 49 m | Baidu Baike “建筑高度49米” | NEEDS_CONFIRM vs 59.7 m (likely different elements) |
| Capacity | 40,000 fixed + 10,000 movable; 4.5万 commonly cited; design up to 5万 | [G1][G2] | CITED |
| Track | 400 m Class I | [G5] 金陵体育 | CITED |
| Site / building area | 13.53万 m² / 14.02万 m² | [G1][G2] | CITED |
| Infield / track plan (3D) | track outer half-axes [88.155, 45.96] m; stand inner = track + 3 m apron | Standard 400 m track (straights 84.39 m, lane-1 radius 36.50 m, kerb 36.20 m, 8 × 1.22 m lanes). Method: DERIVED from the certified 400 m Class I track, not a site survey. The 3 m apron is a modelling allowance, not surveyed. | DERIVED |
| 3D outer seating ring | half-axes [153.5, 148.5] m | Uses the cited building plan as an **upper bound**. Last-row vs façade is UNKNOWN. The Damai map is schematic (pixel aspect ~1.50 vs real 1.034) and is **not** copied into the 3D plan. Ring depths are fractions of (stand inner → this outer) read off the official map's seating-ellipse rho. | DERIVED from [G1][G2] |
| **Top / rear row height** | — | No cited section or surveyed photo in this pass | UNKNOWN |
| **Tier elevation breaks / rake** | — | No cited section or surveyed photo in this pass | UNKNOWN |
| Heights used in the preview model | lower 2–12 m, mid 13–22 m, upper 23–32 m | **UNKNOWN modelling placeholders**, kept under the cited 59.7 m roof. Not surveyed. Not copied from Wuxi's 2–57 m stack. Do not present as measured. | UNKNOWN |
| Roof form in the preview model | schematic cantilever, max 59.7 m, inward 39 m; no truss count | Height and cantilever CITED; rib/truss count is not cited and is not modelled as a count | CITED dimensions, schematic form |
| Concert stage | Central stage on the field, kit `joker_xue_2026` | Same shared kit as Wuxi / Nest | STAGE_VIA_SHARED_KIT |
| Official Damai map | `assets/refs/web/ganzhou/damai_seatmap.jpg` (3700×2689) | [G6] item 1095292691789; map https://img.alicdn.com/imgextra/i2/2251059038/O1CN01iWRwOPjaYUJ7Vlpd_!!2251059038.jpg. Title: 万兽之王 赣州站 2026 / 12.04-06. A is at the **top** of the image (same as Wuxi). 控台 (gray, not sold) sits between A2-1区 and A2-3区. Dark blocks are obstructed / not sold. | CITED |

**[G1]** 土木在线, 赣州市全民健身中心钢屋盖顺利合龙, thread-10399421, citing 蓉江新区发布 (steel-roof closure 26 Dec 2022). https://bbs.co188.com/thread-10399421-1-1.html

**[G2]** 9iHome, same roof-closure report (307 m × 297 m, 59.7 m, 39 m cantilever). http://news.9ihome.com/news/54381.cshtml

**[G3]** 兴赣监理, https://www.jxxinggan.com/news/313.html

**[G4]** 兴赣监理, https://www.jxxinggan.com/news/325.html

**[G5]** 金陵体育, 400 m Class I track. http://www.jlsports.com/NewsDetail/7007912.html

**[G6]** 大麦网 赣州站票页, item 1095292691789. https://detail.damai.cn/item.htm?id=1095292691789


## Kunming · 昆明拓东体育场

| Param | Value | Source | Status |
|-------|-------|--------|--------|
| Capacity (after 2026 renovation) | 40,070 | 云南省体育局 / 滇超 coverage | CITED |
| Aisles | 26 aisles, 1.2 m wide | Renovation reports | CITED |
| Tier count | Two seating tiers 上/下 | Official Damai map + renovation reports of upper and lower stands | CITED |
| Track | 400 m, World Athletics Class 1 B | Renovation / World Athletics coverage | CITED |
| Renovation scope | Kept original outline, floors, and height | Kunming natural-resources façade notice | CITED (qualitative; no meter figure) |
| Historical | 1987–89 expansion to ~42,000; four-storey surrounding rooms; canopies later covering all four stands | Official tdzx.cn page, 2015 | CITED (historical) |
| Plan size (building / bowl) | — | No cited drawing in this pass. Do **not** use the OSM 拓东体育馆 (indoor arena) bbox as if it were the stadium. A 52.96 mu / 35,307 m² figure is site area, not bowl plan. | UNKNOWN |
| Infield / track plan (3D) | same DERIVED 400 m track as Ganzhou (both venues have a certified 400 m track) + 3 m apron | See Ganzhou infield row | DERIVED |
| 3D outer seating ring | half-axes ≈ [124.9, 67.1] m | DERIVED: official-map mean stand-depth ratio (r_out / r_in ≈ 1/0.729 ≈ 1.372) applied to (track outer + apron). Keeps the track aspect. **Not** an independently surveyed building plan. | DERIVED |
| **Top / rear row height** | — | No cited section or surveyed photo in this pass | UNKNOWN |
| **Tier elevation breaks / rake** | — | No cited section or surveyed photo in this pass | UNKNOWN |
| Heights used in the preview model | 下 2–11 m, 上 13–22 m | **UNKNOWN modelling placeholders**. Not surveyed. Not copied from Wuxi. Do not present as measured. | UNKNOWN |
| Roof / façade height | — | Renovation “kept original height” is qualitative only. No meter figure. The 3D preview has **no roof**. | UNKNOWN |
| Concert stage | Central stage on the field, kit `joker_xue_2026` | Same shared kit | STAGE_VIA_SHARED_KIT |
| Official Damai map | `assets/refs/web/kunming/damai_seatmap.jpg` (1280×914; no sharper official original found) | [K1] item 1094660857964; map https://img.alicdn.com/imgextra/i1/2251059038/O1CN01Y1PNiRzNzgK2b8AE_!!2251059038.jpg. Dates 12.19–20 and 12.25–26. Two-tier stands, sections 1–26 each split A/B and 上/下. 主席台1–3区 on the A-side inner ring at the **bottom** of the image. Floor letters are **mirrored** vs Ganzhou/Wuxi: Kunming A is at the bottom (front of stage, with 主席台). | CITED |

**[K1]** 大麦网 昆明站票页, item 1094660857964. https://detail.damai.cn/item.htm?id=1094660857964

Last updated: 2026-11-18 (Ganzhou and Kunming preview bowls added; heights remain UNKNOWN).
