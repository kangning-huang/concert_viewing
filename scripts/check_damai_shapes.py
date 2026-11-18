#!/usr/bin/env python3
"""Verify traced Damai hotspots against the official bitmap and draw an overlay PNG.

    /path/to/venv/bin/python scripts/check_damai_shapes.py ganzhou <src> [logs/shape_check_ganzhou.png]

Checks per hotspot polygon (in source-bitmap pixels):
  (a) label  — Vision OCR of the block's crop (all bands of the block) reads the id's label;
  (b) colour — mean bitmap colour inside the polygon (printed text excluded) is nearest to
               the map shade of the hotspot's legend swatch (legend-calibrated, see tracer);
  (c) mask   — share of the polygon's area on that tier's colour mask (text counts as on-mask);
  (d) overlap — pixels covered by more than one polygon.
"""
import json, os, sys
from pathlib import Path
import cv2
import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
from trace_damai_ganzhou_kunming import CITY_CFG, PRICES, RADIUS, legend_colours, to_lab, calibrate, classify, norm_label, ocr_texts, text_mask  # noqa: E402

city, src = sys.argv[1], sys.argv[2]
# Tier colour mask for (c): nearest legend-calibrated shade within this Lab distance. Wider than
# the tracer's seed radius so the printed shading across a big block counts as its colour; the
# dark background, grey, obstructed tints and dark borders stay off-mask.
MASK_RADIUS = float(sys.argv[4]) if len(sys.argv) > 4 else 26.0
out_png = sys.argv[3] if len(sys.argv) > 3 else f"logs/shape_check_{city}.png"
root = Path(__file__).resolve().parent.parent
data = json.load(open(root / f"src/ui/damai/{city}DamaiHotspots.json"))
cfg = CITY_CFG[city]
UP = cfg["up"]
full = np.array(Image.open(src).convert("RGB"))
img = cv2.resize(full, None, fx=UP, fy=UP, interpolation=cv2.INTER_CUBIC) if UP > 1 else full
H, W = img.shape[:2]
legend_lab = to_lab(legend_colours(img))
sm = cv2.bilateralFilter(cv2.medianBlur(img, 5), 7, 18, 5)
roi = np.zeros((H, W), bool)
roi[cfg["crop"][1] * UP:int(H * 0.905), cfg["crop"][0] * UP:cfg["crop"][2] * UP] = True
lab_sm, centres = calibrate(sm, legend_lab, roi)
cls = classify(lab_sm, centres, radius=MASK_RADIUS)
hsv = cv2.cvtColor(sm, cv2.COLOR_RGB2HSV)
text = text_mask(sm, UP, [b for _, _, b in ocr_texts(city, src, img, UP)]) > 0  # printed label glyphs (same mask the tracer inpaints)
k = cfg["k"] * UP
ox, oy = cfg["crop"][0] * UP, cfg["crop"][1] * UP


def poly_px(d):
    parts = []
    for part in d.split("Z"):
        if part:
            pts = [tuple(map(float, xy.split(","))) for xy in part.strip("M").split("L")]
            parts.append(np.array([[x * k + ox, y * k + oy] for x, y in pts], np.float64))
    return parts


hsv_v = hsv[:, :, 2]
_n, _l, _st, _ = cv2.connectedComponentsWithStats((hsv_v < (75 if UP == 1 else 125)).astype(np.uint8), connectivity=8)
_keep = np.zeros(_n, np.uint8)
_keep[1:] = (_st[1:, 2] <= 60 * UP) & (_st[1:, 3] <= 60 * UP)
polys = {sid: poly_px(d) for sid, d in data["hotspots"].items()}
fp = lambda parts, off=(0, 0): [np.round((p - off) * 8).astype(np.int32) for p in parts]
cover = np.zeros((H, W), np.uint16)
rows = []
for sid, p in polys.items():
    m = np.zeros((H, W), np.uint8)
    cv2.fillPoly(m, fp(p), 1, shift=3)
    cover += m
    sel = m > 0
    tier = PRICES.index(data["meta"][sid]["price"])
    body = sel & ~text
    mean = img[body].mean(axis=0)
    d = np.linalg.norm(centres - to_lab(mean.reshape(1, 3))[0], axis=1)
    # glyphs of the block's own label that OCR boxed only partly: small dark blobs well inside
    inner = cv2.erode(m, np.ones((4 * UP + 1, 4 * UP + 1), np.uint8)) > 0
    ids = np.unique(_l[sel & (_l > 0)])
    out_ids = np.unique(_l[(_l > 0) & ~inner & sel])  # blobs reaching the edge (borders) do not count
    inside_ids = np.setdiff1d(ids[_keep[ids] > 0], out_ids)
    glyph_in = cv2.dilate(np.isin(_l, inside_ids).astype(np.uint8), np.ones((2 * UP + 1, 2 * UP + 1), np.uint8)) > 0
    on = ((cls == tier) | text | glyph_in) & sel
    dist = np.linalg.norm(lab_sm[sel & ~text] - centres[tier], axis=1)
    rows.append(dict(p90=float(np.percentile(dist, 90)), id=sid, tier_ok=int(d.argmin()) == tier, dE=float(d[tier]), on=float(on.sum() / max(sel.sum(), 1)), area=int(sel.sum())))
overlap_px = int((cover > 1).sum())

# (a) label OCR per block (base id + its secondary bands)
from ocrmac import ocrmac
blocks = {}
for sid, m in data["meta"].items():
    blocks.setdefault(m.get("base", sid), []).append(sid)
ocr_ok = {}
raw = {}
for base, sids in blocks.items():
    if os.environ.get("SKIP_OCR"):
        ocr_ok[base] = (True, [])
        continue
    pts = np.vstack([q for s in sids for q in polys[s]])
    x0, y0 = pts.min(0)
    x1, y1 = pts.max(0)
    px, py = max((x1 - x0) * 0.4, 40 * UP), max((y1 - y0) * 0.4, 40 * UP)
    X0, Y0, X1, Y1 = int(max(0, x0 - px)), int(max(0, y0 - py)), int(min(W, x1 + px)), int(min(H, y1 + py))
    crop = img[Y0:Y1, X0:X1]
    sc0 = max(1.0, min(5.0, 500 / max(1, min(crop.shape[:2]))))
    found = set()
    for sc in (sc0, sc0 * 0.6, sc0 * 1.5):
        if base in found:
            break
        big = cv2.resize(crop, None, fx=sc, fy=sc, interpolation=cv2.INTER_CUBIC)
        for t, c, (bx0, by0, bx1, by1) in ocrmac.OCR(Image.fromarray(big), language_preference=["zh-Hans", "en-US"], recognition_level="accurate").recognize(px=True):
            lb = norm_label(city, t)
            raw.setdefault(base, []).append(t)
            if lb != base:
                continue
            # the label must be printed on (or within 16 px of) the block's own outline
            tc = (X0 + (bx0 + bx1) / 2 / sc, Y0 + (by0 + by1) / 2 / sc)
            dist = max(cv2.pointPolygonTest(q.astype(np.float32).reshape(-1, 1, 2), tc, True) for s_ in sids for q in polys[s_])
            if dist >= -16 * UP:
                found.add(lb)
    ocr_ok[base] = (base in found, sorted(found))

n = len(rows)
bad_tier = [r["id"] for r in rows if not r["tier_ok"]]
low = sorted([r for r in rows if r["on"] < 0.95], key=lambda r: r["on"])
bad_ocr = {b: sorted(set(raw.get(b, []))) for b, v in ocr_ok.items() if not v[0]}
print(f"{city}: {n} polygons, {len(blocks)} labelled blocks")
print(f"  (a) label OCR matches id: {len(blocks) - len(bad_ocr)}/{len(blocks)}" + (f"  misses: {bad_ocr}" if bad_ocr else ""))
print(f"  (b) mean colour → own price tier: {n - len(bad_tier)}/{n}  (max ΔE to own swatch {max(r['dE'] for r in rows):.1f})" + (f"  wrong: {bad_tier}" if bad_tier else ""))
ons = np.array([r["on"] for r in rows])
print(f"  (c) area on tier colour mask: min {ons.min() * 100:.1f}%  median {np.median(ons) * 100:.1f}%  ≥95%: {(ons >= 0.95).sum()}/{n}" + (f"  low: {[(r['id'], round(r['on'] * 100, 1)) for r in low]}" if low else ""))
print("  p90 Lab distance to own shade, worst:", sorted(((round(r["p90"], 1), r["id"]) for r in rows), reverse=True)[:8])
print(f"  (d) overlapping pixels between polygons: {overlap_px}")

# overlay PNG on the bitmap (crop shown in the app), polygons outlined
cx0, cy0, cx1, cy1 = [v * UP for v in cfg["crop"]]
vis = img[cy0:cy1, cx0:cx1].copy()
s = 1.0  # full source resolution (Kunming: the 3× tracing upscale)
vis = cv2.resize(vis, None, fx=1 / s, fy=1 / s, interpolation=cv2.INTER_AREA) if s != 1 else vis
for r in rows:
    ok = r["tier_ok"] and r["on"] >= 0.95
    col = (0, 255, 255) if ok else (255, 0, 255)
    cv2.polylines(vis, [np.round((q - [cx0, cy0]) / s * 8).astype(np.int32) for q in polys[r["id"]]], True, col, 1, cv2.LINE_AA, shift=3)
for base, (ok, _) in ocr_ok.items():
    if not ok:
        cv2.polylines(vis, [np.round((q - [cx0, cy0]) / s * 8).astype(np.int32) for q in polys[base]], True, (255, 60, 0), 2, cv2.LINE_AA, shift=3)
# hotspot ids at the polygon centroid (red), so the label mapping can be read against the print
from PIL import ImageDraw, ImageFont
pim = Image.fromarray(vis)
dr = ImageDraw.Draw(pim)
try:
    font = ImageFont.truetype("/System/Library/Fonts/STHeiti Medium.ttc", 11 * UP if UP > 1 else 18)
except OSError:
    font = ImageFont.load_default()
for sid, (lx, ly) in data["labels"].items():
    px_, py_ = (lx * k + ox - cx0) / s, (ly * k + oy - cy0) / s
    dr.text((px_, py_), sid, fill=(255, 30, 30), font=font, anchor="mm", stroke_width=2, stroke_fill=(255, 255, 255))
Path(out_png).parent.mkdir(parents=True, exist_ok=True)
pim.save(out_png)
print("  wrote", out_png, vis.shape[1], "x", vis.shape[0])
