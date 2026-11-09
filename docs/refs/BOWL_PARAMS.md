# Bowl params (cited meters only)

**Gate:** Do not remesh a venue bowl until its critical rows below are filled with citations.
Placeholder / invented meters are forbidden. Leave `UNKNOWN` when unsure.

**Status key:** `CITED` = number read in a named source · `NEEDS_CONFIRM` = real source, but conflicting or unclear what it measures · `UNKNOWN` = no source found.

**Gate state (2026-11-10):** Nest remesh **BLOCKED** · Wuxi remesh **BLOCKED**. Both lack top-row height, tier elevations and rake.

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
| **Top / rear row height above field** | **UNKNOWN** | Not stated in any source read | UNKNOWN |
| **Lower bowl rake** | **UNKNOWN** | [N4] gives only ~1% slab drainage fall | UNKNOWN |
| **Mid / upper bowl rake** | **UNKNOWN** | — | UNKNOWN |
| **Tier elevation breaks** | **UNKNOWN** | — | UNKNOWN |
| Pitch / infield size for concert overlay | UNKNOWN | — | UNKNOWN |
| Concert stage placement | Central stage on field, per seat-map photo in `assets/refs/xhs/nest/`; kit `joker_xue_2026` | Tour photos | STAGE_VIA_SHARED_KIT |

### Nest source conflicts

- **E–W width: 296.4 m [N1][N3] vs 280 m [N2].** Using 296.4 m: [N1] is the designer's paper and the municipal page agrees. [N2] does not explain its 280 m. Neither figure is the concrete bowl's outline.
- **Height: 68.5 m [N1] vs 69.21 m [N2].** Probably different datums; not resolved.
- **Viewing distance: 129.90 m [N4] vs 140 m / 142 m** in tourism pages. [N4] says 140 m was the limit for the earlier 100,000-seat scheme, so use 129.90 m for the built 91,000.

### Prior "~47 m top row, rakes ~15°/28°/33°" claim

**Not verified; do not use.** No source read contains these figures.
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

Last updated: 2026-11-10.


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
