#!/usr/bin/env python3
"""Trace the official Damai Ganzhou / Kunming seat maps into per-block tap hotspots.

Every hotspot is a contour traced FROM THE BITMAP (no analytic ellipse model):
  1. the 7 price colours are sampled from the legend swatches at the bottom of the map and
     calibrated to the (lighter) shade the blocks are printed in;
  2. printed labels are inpainted, then each pixel is classified to its nearest tier shade
     (Lab, tight radius), so darker 3D side faces, block borders, grey (控台 / numbered strips)
     and the dark obstructed blocks fall out of every class;
  3. connected components of each class are the printed cells; a cell printed in two prices
     splits into one component per price band;
  4. the printed label of each block is read with macOS Vision OCR (ocrmac) and parsed
     (16A区(上) → 16A上, 主席台2区 → 主席台2). A label owns the lit cell(s) its text sits on or
     straddles (thin strips: the two cells either side of the line it is printed on; same-colour
     cells are joined across that line). Other-price bands of the block get "<label>-<price>"
     (e.g. A23-517). Kunming's 8 px stand labels are assigned by printed order, OCR cross-checks;
  5. contours are simplified with approxPolyDP (epsilon 0.5 px of the displayed image), 1 px
     inset so neighbouring polygons never overlap.
Blocks labelled 控台 / *中*区 and unlabelled lit cells (small numbered strips) get no
hotspot; obstructed (dark) blocks never enter a colour class. The displayed bitmap
(src/ui/damai/<city>_damai_map.webp) is the official map cropped; it is not rewritten here.
Verify with scripts/check_damai_shapes.py (overlay PNG + label / colour / mask / overlap checks).

Per hotspot meta: sampled tone/price (median colour inside the contour → nearest legend
swatch), polygon centroid angle / min-max angle (eccentric angle about the map ellipse) and
rho band, which venues.js turns into the 3D section layout.

    /path/to/venv/bin/python scripts/trace_damai_ganzhou_kunming.py ganzhou <src> <out_dir>
    /path/to/venv/bin/python scripts/trace_damai_ganzhou_kunming.py kunming <src> <out_dir>
Needs opencv-python-headless, numpy, pillow, ocrmac (macOS).
"""
from __future__ import annotations
import json, math, os, re, sys
from pathlib import Path
import cv2
import numpy as np
from PIL import Image

PRICES = [1717, 1517, 1317, 917, 717, 517, 317]  # legend order, left → right
TONES = ["red", "peach", "yellow", "lavender", "green", "blue", "rose"]
# Crop of the source map that the displayed webp shows: source px = (x0, y0) + view px * k.
# (view space = the hotspot JSON viewBox; the webp is the same crop at 2× view resolution.)
CITY_CFG = {
    "ganzhou": dict(up=1, crop=(715, 217, 3526, 2689), k=3.428048780487805,
                    ellipse=(410.14, 299.89, 401.11, 292.87),
                    tiers={"lower": (0.65, 0.755), "mid": (0.765, 0.868), "upper": (0.868, 1.02)},
                    source="Damai official Ganzhou seat map (img.alicdn.com …/O1CN01iWRwOPjaYUJ7Vlpd), traced from the bitmap by scripts/trace_damai_ganzhou_kunming.py"),
    "kunming": dict(up=3, crop=(152, 124, 1208, 914), k=1.2878048780487805,
                    ellipse=(410.26, 263.11, 386.97, 243.95),
                    tiers={"lower": (0.73, 0.872), "upper": (0.878, 1.03)},
                    source="Damai official Kunming seat map (img.alicdn.com …/O1CN01Y1PNiRzNzgK2b8AE), traced from the bitmap by scripts/trace_damai_ganzhou_kunming.py"),
}
RADIUS = 16.0  # Lab distance to the calibrated tier shade
FLOOR_RE = re.compile(r"^[A-D][1-4]$")
GZ_MAX = {"A": 31, "B": 38, "C": 38, "D": 4, "E": 38}
# Printed labels Vision OCR misses (box in source px, checked against the official image).
MANUAL_LABELS = {
    "ganzhou": {"B25": (834, 1240, 891, 1265)},  # OCR reads "$25区" / "625区"
    "kunming": {},
}


def legend_colours(img):
    """Median colour of the 7 legend swatches (bottom bar), left → right."""
    H = img.shape[0]
    y0, y1 = int(H * 0.925), int(H * 0.955)
    row = cv2.medianBlur(img[y0:y1], 5)
    hsv = cv2.cvtColor(row, cv2.COLOR_RGB2HSV)
    m = ((hsv[:, :, 1] > 40) & (hsv[:, :, 2] > 120)).astype(np.uint8)
    n, l, st, _ = cv2.connectedComponentsWithStats(m)
    sw = [(st[i, 0], np.median(row[l == i], axis=0)) for i in range(1, n) if st[i, 4] > 0.3 * st[1:, 4].max()]
    sw.sort(key=lambda t: t[0])
    assert len(sw) == 7, f"legend swatches: {len(sw)}"
    return np.array([c for _, c in sw], np.float32)


def to_lab(rgb):
    return cv2.cvtColor(np.clip(rgb, 0, 255).astype(np.uint8).reshape(-1, 1, 3), cv2.COLOR_RGB2LAB).reshape(-1, 3).astype(np.float32)


def calibrate(sm, legend_lab, roi):
    """Map shade of each legend colour. The printed top faces are lighter than the legend
    swatches (same hue / chroma), so each tier centre is the median Lab of the map pixels
    whose chroma (a, b) is closest to that swatch and that are not darker than the swatch."""
    lab = cv2.cvtColor(sm, cv2.COLOR_RGB2LAB).astype(np.float32)
    dab = np.stack([np.linalg.norm(lab[:, :, 1:] - c[1:], axis=2) for c in legend_lab])
    a, dmin = dab.argmin(0), dab.min(0)
    cen = []
    for t, c in enumerate(legend_lab):
        sel = roi & (a == t) & (dmin < 20) & (lab[:, :, 0] > c[0] - 10)
        cen.append(np.median(lab[sel], axis=0) if sel.sum() > 500 else c)
    return lab, np.array(cen, np.float32)


def nearest_tier(rgb, centres):
    lab = to_lab(np.array(rgb, np.float32).reshape(1, 3))[0]
    d = np.linalg.norm(centres - lab, axis=1)
    return int(d.argmin()), float(d.min())


def classify(lab, centres, radius):
    d = np.stack([np.linalg.norm(lab - c, axis=2) for c in centres])
    cls = d.argmin(0)
    cls[d.min(0) > radius] = -1
    return cls


def text_mask(sm, UP, boxes):
    """Printed black labels / numbers: small dark components (+ their JPEG halo) whose centre
    lies in an OCR text box. The dark background and the block borders are not included."""
    hsv = cv2.cvtColor(sm, cv2.COLOR_RGB2HSV)
    dark = (hsv[:, :, 2] < (75 if UP == 1 else 125)).astype(np.uint8)  # Kunming glyphs are JPEG-blurred grey
    n, l, st, cen = cv2.connectedComponentsWithStats(dark, connectivity=8)
    inbox = np.zeros(dark.shape, bool)
    for x0, y0, x1, y1 in boxes:
        inbox[max(0, int(y0) - UP):int(y1) + UP + 1, max(0, int(x0) - 4 * UP):int(x1) + 4 * UP + 1] = True
    lim = 70 * UP
    keep = np.zeros(n, np.uint8)
    for i in range(1, n):
        cx_, cy_ = int(cen[i][0]), int(cen[i][1])
        keep[i] = st[i, 2] <= lim and st[i, 3] <= lim and (UP == 1 or inbox[cy_, cx_])
    m = keep[l]
    if UP > 1:
        m &= inbox  # a glyph blurred into a border line: keep only its part inside the text box
    return cv2.dilate(m, np.ones((2 * UP + 1, 2 * UP + 1), np.uint8))  # glyph + JPEG halo


def ocr_texts(city, src, img, UP):
    """Vision OCR of the whole map (tiles, two scales), cached under logs/."""
    cache = Path(__file__).resolve().parent.parent / "logs" / f"ocr_{city}_{Path(src).stat().st_size}.json"
    if cache.exists():
        return [(t, c, tuple(b)) for t, c, b in json.load(open(cache))]
    texts = ocr_tiles(img, 2.0 if UP == 1 else 1.0)
    texts += ocr_tiles(img, 3.0 if UP == 1 else 1.6, tile=700, ov=180)
    cache.parent.mkdir(exist_ok=True)
    json.dump(texts, open(cache, "w"), ensure_ascii=False)
    return texts


def remove_text(sm, UP, boxes):
    """Inpaint the printed labels so a label lying on a block edge does not bite glyph-shaped
    notches into the traced outline."""
    return cv2.inpaint(sm, text_mask(sm, UP, boxes), 4 * UP, cv2.INPAINT_TELEA)


# ---------------------------------------------------------------- OCR
def ocr_tiles(img, scale, tile=900, ov=200):
    from ocrmac import ocrmac
    H, W = img.shape[:2]
    out = []
    for ty in range(0, H, tile - ov):
        for tx in range(0, W, tile - ov):
            sub = img[ty:ty + tile, tx:tx + tile]
            if sub.shape[0] < 40 or sub.shape[1] < 40:
                continue
            big = cv2.resize(sub, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC) if scale != 1 else sub
            res = ocrmac.OCR(Image.fromarray(big), language_preference=["zh-Hans", "en-US"], recognition_level="accurate").recognize(px=True)
            for t, c, (x0, y0, x1, y1) in res:
                out.append((t, c, (tx + x0 / scale, ty + y0 / scale, tx + x1 / scale, ty + y1 / scale)))
    return out


def norm_label(city, t):
    s = t.replace(" ", "").replace("（", "(").replace("）", ")")
    s = re.sub(r"(?<=\d)[X×又]", "区", s)  # the boxed 区 glyph is sometimes read as X
    if city == "ganzhou":
        s = s.replace("O", "0").replace("o", "0").replace("I", "1").replace("l", "1")
        m = re.search(r"([A-E])(\d{1,2}|2-[13])区", s)
        if m:
            num = m.group(2)
            if num.isdigit() and int(num) > GZ_MAX[m.group(1)] and num[0] == "7":
                num = "1" + num[1:]  # Vision reads the thin "1" as "7" (E17 → E77)
            if num.isdigit() and int(num) > GZ_MAX[m.group(1)]:
                return None
            return f"{m.group(1)}{num}"
        m = re.search(r"^([A-E])(\d{2})$", s)
        if m and int(m.group(2)) <= GZ_MAX[m.group(1)]:
            return f"{m.group(1)}{m.group(2)}"
        m = re.search(r"([A-E])(\d{1,2}|2-[13])$", s)
        return f"{m.group(1)}{m.group(2)}" if m and FLOOR_RE.match(m.group(1) + m.group(2)) else None
    m = re.search(r"主席台(\d)区?", s)
    if m:
        return f"主席台{m.group(1)}"
    s = s.replace("O", "0").replace("o", "0").replace("I", "1").replace("l", "1")
    m = re.search(r"(\d{1,2})([AB8])区?\(?(上|下)", s)
    if m:
        return f"{m.group(1)}{'B' if m.group(2) == '8' else m.group(2)}{m.group(3)}"
    m = re.search(r"([A-D])([1-4])区", s)
    return f"{m.group(1)}{m.group(2)}" if m else None


def is_excluded_text(t):
    return "控" in t or "中" in t and "区" in t


# Kunming stand labels are ~8 px tall in the only available bitmap, so Vision misreads many
# digits (08B, 48B, 78B, 19B for 18B …). The stand blocks are therefore labelled by their
# printed order around the bowl (checked block by block against the official image), and the
# OCR reads are used as a cross-check. Order = decreasing screen angle starting at 9 o'clock.
# 2A/11B/15A/25B are dark (obstructed) except a lit strip of seats along one edge; 3A/10B/16A/
# 24B are partly dark (24B下's lit part is two pieces). 2B/11A/15B/25A are fully dark. Ring 下
# has no 6/7 (主席台1–3) and no 13 (the B3/B4 side).
KM_SEQ = {
    "下": "1A 1B 2A 3A 3B 4A 4B 5A 5B 8A 8B 9A 9B 10A 10B 11B 12A 12B 14A 14B 15A 16A 16B 17A 17B 18A 18B 19A 19B 20A 20B 21A 21B 22A 22B 23A 23B 24A 24B 25B 26A 26B".split(),
    "上": ("1A 1B 2A 3A 3B 4A 4B 5A 5B 6A 6B 7A 7B 8A 8B 9A 9B 10A 10B 11B 12A 12B 13A 13B 14A 14B 15A "
          "16A 16B 17A 17B 18A 18B 19A 19B 20A 20B 21A 21B 22A 22B 23A 23B 24A 24B 25B 26A 26B").split(),
}


def kunming_sequence(comps, owner, excluded, X):
    to_vb, polar, UP = X
    info = {}
    for ci, c in enumerate(comps):
        x, y, w, h = c["bbox"]
        Mo = cv2.moments(c["sub"], binaryImage=True)
        gx, gy = to_vb(Mo["m10"] / Mo["m00"] + x, Mo["m01"] / Mo["m00"] + y)
        rho, ang = polar(gx, gy)
        cs, _ = cv2.findContours(c["sub"], cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        u = math.degrees(ang - math.radians(178)) % 360
        pol = [polar(*to_vb(p[0][0] + x, p[0][1] + y)) for p in max(cs, key=cv2.contourArea)]
        us = [u + math.degrees((a - ang + math.pi) % (2 * math.pi) - math.pi) for _, a in pol]
        rs = sorted(r for r, _ in pol)
        info[ci] = dict(rho=rho, u=u, lo=min(us), hi=max(us), r0=rs[len(rs) // 10], r1=rs[-1 - len(rs) // 10], tier=c["tier"])
    stand = [ci for ci, d in info.items() if d["rho"] > 0.7 and ci not in excluded and not str(owner.get(ci, "")).startswith("主席台")]
    lav = [ci for ci, d in info.items() if d["rho"] > 0.7 and d["tier"] == TONES.index("lavender")]

    def ov(a, b):
        return min(a["hi"], b["hi"]) - max(a["lo"], b["lo"])

    rings = {"下": [], "上": []}
    for ci in stand:
        d = info[ci]
        if d["tier"] == TONES.index("lavender"):
            ring = "下"
        elif d["tier"] == TONES.index("green"):
            inner_lav = any(info[j]["rho"] < d["rho"] and ov(info[j], d) > 0.3 * (d["hi"] - d["lo"]) for j in lav)
            ring = "上" if inner_lav else "下"
        else:
            ring = "上"
        rings[ring].append(ci)
    agree, disagree = 0, []
    for ring, cis in rings.items():
        cis.sort(key=lambda ci: -info[ci]["u"])
        secs = []
        for ci in cis:
            d = info[ci]
            # same block: overlapping angular span, radial rows that do not overlap its cells
            if (secs and ov(secs[-1], d) > 0.35 * min(d["hi"] - d["lo"], secs[-1]["hi"] - secs[-1]["lo"])
                    and all(min(info[cj]["r1"], d["r1"]) - max(info[cj]["r0"], d["r0"]) < 0.3 * min(info[cj]["r1"] - info[cj]["r0"], d["r1"] - d["r0"])
                            or comps[cj]["tier"] != d["tier"] for cj in secs[-1]["cells"])):
                secs[-1]["cells"].append(ci)
                secs[-1]["lo"], secs[-1]["hi"] = min(secs[-1]["lo"], d["lo"]), max(secs[-1]["hi"], d["hi"])
            else:
                secs.append(dict(lo=d["lo"], hi=d["hi"], cells=[ci]))
        seq = KM_SEQ[ring]
        if len(secs) != len(seq) or os.environ.get("KM_DEBUG"):
            for sec in secs:
                print(f"    {ring} {sec['lo']:.1f}-{sec['hi']:.1f}", [(TONES[comps[ci]["tier"]], comps[ci]["area"] // UP // UP, round(info[ci]["rho"], 3), round(info[ci]["lo"], 1), round(info[ci]["hi"], 1), owner.get(ci)) for ci in sec["cells"]])
        assert len(secs) == len(seq), f"kunming ring {ring}: {len(secs)} lit sectors, expected {len(seq)}"
        for sec, lb in zip(secs, seq):
            sid = f"{lb}{ring}"
            for ci in sec["cells"]:
                if ci in owner:
                    (agree := agree + 1) if owner[ci] == sid else disagree.append((owner[ci], sid))
                owner[ci] = sid
    print(f"  kunming stand labels by printed order: OCR agrees on {agree} cells, disagrees on {len(disagree)}: {disagree}")


# ---------------------------------------------------------------- main
def run(city, src, out_dir):
    cfg = CITY_CFG[city]
    UP = cfg["up"]
    full = np.array(Image.open(src).convert("RGB"))
    img = cv2.resize(full, None, fx=UP, fy=UP, interpolation=cv2.INTER_CUBIC) if UP > 1 else full
    H, W = img.shape[:2]
    legend = legend_colours(img)
    legend_lab = to_lab(legend)
    sm = cv2.medianBlur(img, 5)
    sm = cv2.bilateralFilter(sm, 7, 18, 5)
    cx0, cy0, cx1, cy1 = [v * UP for v in cfg["crop"]]
    roi = np.zeros((H, W), bool)
    roi[cy0:int(H * 0.905), cx0:cx1] = True
    texts = ocr_texts(city, src, img, UP)
    sm = remove_text(sm, UP, [b for _, _, b in texts])
    lab_sm, centres = calibrate(sm, legend_lab, roi)
    cls = classify(lab_sm, centres, radius=RADIUS)
    cls[~roi] = -1

    # view-space helpers
    k = cfg["k"] * UP
    ox, oy = cfg["crop"][0] * UP, cfg["crop"][1] * UP
    to_vb = lambda x, y: ((x - ox) / k, (y - oy) / k)
    ecx, ecy, eA, eB = cfg["ellipse"]

    def polar(vx, vy):
        dx, dy = (vx - ecx) / eA, (vy - ecy) / eB
        return math.hypot(dx, dy), math.atan2(dy, dx)

    # components per colour class
    comps = []  # dict(mask, tier, area, bbox)
    open_k = np.ones((3, 3), np.uint8)
    min_area = 260 * UP * UP if city == "ganzhou" else 90 * UP * UP
    for t in range(7):
        m = (cls == t).astype(np.uint8)
        m = cv2.morphologyEx(m, cv2.MORPH_OPEN, open_k)
        n, l, st, _ = cv2.connectedComponentsWithStats(m, connectivity=4)
        for i in range(1, n):
            if st[i, 4] < min_area:
                continue
            x, y, w, h, _ = st[i]
            sub = (l[y:y + h, x:x + w] == i).astype(np.uint8)
            # fill holes (printed text) inside the band
            cs, _ = cv2.findContours(sub, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
            filled = np.zeros_like(sub)
            cv2.drawContours(filled, cs, -1, 1, -1)
            comps.append(dict(tier=t, bbox=(x, y, w, h), sub=filled, area=int(filled.sum())))
    print(f"{city}: {len(comps)} colour components")

    lab_img = np.full((H, W), -1, np.int32)
    for ci, c in enumerate(comps):
        x, y, w, h = c["bbox"]
        view = lab_img[y:y + h, x:x + w]
        view[(c["sub"] > 0) & (view < 0)] = ci

    # cluster detections of the same printed text (tiles overlap, two OCR scales)
    clusters = []  # [x0, y0, x1, y1, {label: conf}, n]
    for t, conf, (x0, y0, x1, y1) in texts:
        cxp, cyp = (x0 + x1) / 2, (y0 + y1) / 2
        if not roi[min(int(cyp), H - 1), min(int(cxp), W - 1)]:
            continue
        lb = "#excl" if is_excluded_text(t) else norm_label(city, t)
        if not lb:
            continue
        for c in clusters:
            if abs((c[0] + c[2]) / 2 - cxp) < (y1 - y0) and abs((c[1] + c[3]) / 2 - cyp) < (y1 - y0) / 2:
                c[4][lb] = c[4].get(lb, 0) + conf + 0.05
                c[0], c[1], c[2], c[3] = min(c[0], x0), min(c[1], y0), max(c[2], x1), max(c[3], y1)
                break
        else:
            clusters.append([x0, y0, x1, y1, {lb: conf + 0.05}])
    found = {lb: (99.0, tuple(v * UP for v in box)) for lb, box in MANUAL_LABELS[city].items()}  # label -> (score, box)
    excl_boxes = []
    for x0, y0, x1, y1, d in clusters:
        lb, sc = max(d.items(), key=lambda kv: kv[1])
        if lb == "#excl":
            excl_boxes.append((x0, y0, x1, y1))
        elif lb not in found or found[lb][0] < sc:
            found[lb] = (sc, (x0, y0, x1, y1))

    # ---- a printed label owns every lit cell its text box sits on: on the thin strips the
    # label straddles the line between two cells of one 区; on two-price blocks it straddles
    # the change of colour. Cells of the same colour are joined, other colours are bands.
    def under(box):
        x0, y0, x1, y1 = [int(round(v)) for v in box]
        x0, y0, x1, y1 = max(0, x0 - 2 * UP), max(0, y0 - 2 * UP), x1 + 2 * UP, y1 + 2 * UP
        area = (x1 - x0) * (y1 - y0)
        bx = lab_img[y0:y1, x0:x1]
        ids, cnt = np.unique(bx[bx >= 0], return_counts=True)
        cxp, cyp = (x0 + x1) // 2, (y0 + y1) // 2
        r = 3 * UP
        cc = lab_img[cyp - r:cyp + r + 1, cxp - r:cxp + r + 1]
        cc = np.unique(cc[cc >= 0])
        share = {int(i): n / area for i, n in zip(ids, cnt)}
        if len(cc):  # label printed on a lit cell: that cell, plus a cell it straddles into
            c0 = int(max(cc, key=lambda i: share.get(int(i), 0)))
            out = {c0: 1.0}
            for i, sh in share.items():
                if i != c0 and sh >= (0.25 if comps[i]["tier"] == comps[c0]["tier"] else 0.10):
                    out[i] = sh
            return out
        # label printed on a line or on a dark (obstructed) part: cells it straddles, else the
        # one lit cell it touches most (the block's unobstructed part)
        out = {i: sh for i, sh in share.items() if sh >= 0.25}
        if not out and share:
            i, sh = max(share.items(), key=lambda kv: kv[1])
            if sh >= 0.10:
                out = {i: sh}
                touch_only.append((i, round(sh, 3)))
        return out

    claim = {}  # ci -> (share, label)
    touch_only = []
    for lb, (sc, box) in list(found.items()) + [("#excl", (0, b)) for b in excl_boxes]:
        for ci, sh in under(box).items():
            if ci not in claim or claim[ci][0] < sh:
                claim[ci] = (sh, lb)
    excluded = {ci for ci, (sh, lb) in claim.items() if lb == "#excl"}
    owner = {ci: lb for ci, (sh, lb) in claim.items() if lb != "#excl"}

    # ---- a band without its own label joins the touching band of another price that has
    # one (two-price blocks whose label sits wholly on one band)
    ker = np.ones((9, 9) if UP == 1 else (15, 15), np.uint8)  # reaches across the blend between two price bands, not a block border
    def touching(ci):
        c = comps[ci]
        x, y, w, h = c["bbox"]
        pad = 6
        X0, Y0 = max(0, x - pad), max(0, y - pad)
        X1, Y1 = min(W, x + w + pad), min(H, y + h + pad)
        m = np.zeros((Y1 - Y0, X1 - X0), np.uint8)
        m[y - Y0:y - Y0 + h, x - X0:x - X0 + w] = c["sub"]
        ring = cv2.dilate(m, ker) & (1 - m)
        nb = lab_img[Y0:Y1, X0:X1][ring > 0]
        ids, cnt = np.unique(nb[nb >= 0], return_counts=True)
        return {int(i): int(n) for i, n in zip(ids, cnt) if i != ci}

    joined = 0
    for ci, c in enumerate(comps):
        if ci in owner or ci in excluded:
            continue
        cand = [(n, j) for j, n in touching(ci).items() if j in owner and comps[j]["tier"] != c["tier"]]
        if not cand:
            continue
        n, j = max(cand)
        per = cv2.arcLength(max(cv2.findContours(c["sub"], cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)[0], key=cv2.contourArea), True)
        if n >= 12 * UP and n >= 0.18 * per:
            owner[ci] = owner[j]
            joined += 1

    if city == "kunming":
        kunming_sequence(comps, owner, excluded, X=(to_vb, polar, UP))

    no_cells = sorted(lb for lb in found if lb not in owner.values())
    if os.environ.get("DUMP_CELLS"):
        dump = []
        for ci, c in enumerate(comps):
            x, y, w, h = c["bbox"]
            Mo = cv2.moments(c["sub"], binaryImage=True)
            gx, gy = to_vb(Mo["m10"] / Mo["m00"] + x, Mo["m01"] / Mo["m00"] + y)
            r_, a_ = polar(gx, gy)
            cs_, _ = cv2.findContours(c["sub"], cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            angs_ = [a_ + (polar(*to_vb(p[0][0] + x, p[0][1] + y))[1] - a_ + math.pi) % (2 * math.pi) - math.pi for p in max(cs_, key=cv2.contourArea)]
            dump.append(dict(ci=ci, tier=c["tier"], area=c["area"] / UP / UP, gx=round(gx, 1), gy=round(gy, 1), rho=round(r_, 3), ang=round(math.degrees(a_), 1),
                             a0=round(math.degrees(min(angs_)), 1), a1=round(math.degrees(max(angs_)), 1), owner=owner.get(ci), excl=ci in excluded))
        json.dump(dict(cells=dump, found={lb: [sc, [v / UP for v in b]] for lb, (sc, b) in found.items()}), open(os.environ["DUMP_CELLS"], "w"), ensure_ascii=False, indent=0)
    units = {}  # label -> {tier: [ci]}
    for ci, lb in owner.items():
        units.setdefault(lb, {}).setdefault(comps[ci]["tier"], []).append(ci)

    def unit_mask(cis):
        x0 = min(comps[ci]["bbox"][0] for ci in cis); y0 = min(comps[ci]["bbox"][1] for ci in cis)
        x1 = max(comps[ci]["bbox"][0] + comps[ci]["bbox"][2] for ci in cis)
        y1 = max(comps[ci]["bbox"][1] + comps[ci]["bbox"][3] for ci in cis)
        pad = 8 * UP
        X0, Y0 = max(0, x0 - pad), max(0, y0 - pad)
        m = np.zeros((y1 - Y0 + pad, x1 - X0 + pad), np.uint8)
        for ci in cis:
            x, y, w, h = comps[ci]["bbox"]
            m[y - Y0:y - Y0 + h, x - X0:x - X0 + w] |= comps[ci]["sub"]
        # 1 px inset so the simplified outlines of two touching price bands never overlap
        m = cv2.erode(m, cv2.getStructuringElement(cv2.MORPH_CROSS, (3, 3)))
        n, lab_ = cv2.connectedComponents(m)
        parts = [(lab_ == i).astype(np.uint8) for i in range(1, n) if (lab_ == i).sum() >= 40 * UP * UP]
        if len(parts) > 1:  # bridge the printed line between two cells of one 区 (gap pixels only)
            reach = np.ones((6 * UP + 1, 6 * UP + 1), np.uint8)
            dil = [cv2.dilate(pm, reach) for pm in parts]
            for i in range(len(parts)):
                for j in range(i + 1, len(parts)):
                    m |= dil[i] & dil[j]
        cs, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
        filled = np.zeros_like(m)
        cv2.drawContours(filled, cs, -1, 1, -1)
        return X0, Y0, filled

    # ---- export
    hotspots, meta, lab_pos = {}, {}, {}
    eps = 0.5 * k / 2  # 0.5 px of the 2× webp, in work px
    tiers = cfg["tiers"]
    split_cells = []
    for lb, bands in units.items():
        prim_tier = min(bands)
        for tier_i, cis in sorted(bands.items()):
            X0, Y0, um = unit_mask(cis)
            med = np.median(img[Y0:Y0 + um.shape[0], X0:X0 + um.shape[1]][um > 0], axis=0)
            st_i, st_d = nearest_tier(med, centres)
            sid = lb if tier_i == prim_tier else f"{lb}-{PRICES[st_i]}"
            cs, _ = cv2.findContours(um, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
            cs = sorted(cs, key=cv2.contourArea, reverse=True)
            cs = [c_ for c_ in cs if cv2.contourArea(c_) >= max(40 * UP * UP, 0.03 * cv2.contourArea(cs[0]))]  # bridge crumbs
            if len(cs) > 1:
                split_cells.append((sid, [int(cv2.contourArea(c_)) // UP // UP for c_ in cs]))
            subpaths, allpts = [], []
            for cnt in cs:
                ap = cv2.approxPolyDP(cnt, eps, True)
                pts = [to_vb(float(p[0][0]) + X0, float(p[0][1]) + Y0) for p in ap]
                allpts += pts
                subpaths.append("M" + "L".join(f"{px:.2f},{py:.2f}" for px, py in pts) + "Z")
            hotspots[sid] = "".join(subpaths)
            Mo = cv2.moments(um, binaryImage=True)
            gx, gy = to_vb(Mo["m10"] / Mo["m00"] + X0, Mo["m01"] / Mo["m00"] + Y0)
            lab_pos[sid] = [round(gx, 1), round(gy, 1)]
            rho_c, ang_c = polar(gx, gy)
            floor = bool(FLOOR_RE.match(lb))
            if city == "kunming" and not floor and not lb.startswith("主席台"):
                base_name = f"{lb[:-1]}区({lb[-1]})"
            else:
                base_name = f"{lb}区"
            name = base_name if sid == lb else f"{base_name}·¥{PRICES[st_i]}"
            m = dict(tone=TONES[st_i], kind="floor" if floor else "bowl", name=name, price=PRICES[st_i],
                     sampled=[int(v) for v in med], dE=round(st_d, 1), ang=round(ang_c, 4), rho=round(rho_c, 4))
            if sid != lb:
                m["base"] = lb
            rhos, angs = [], []
            for px, py in allpts:
                r, a_ = polar(px, py)
                rhos.append(r); angs.append(ang_c + (a_ - ang_c + math.pi) % (2 * math.pi) - math.pi)
            m.update(t0=round(min(rhos), 4), t1=round(max(rhos), 4), a0=round(min(angs), 4), a1=round(max(angs), 4))
            if floor:
                m["area"] = int(um.sum())
            else:
                tier = min(tiers, key=lambda key: 0 if tiers[key][0] <= rho_c <= tiers[key][1] else min(abs(rho_c - tiers[key][0]), abs(rho_c - tiers[key][1])))
                ti, to = tiers[tier]
                m["tier"] = tier
                m["d0"] = round(min(max((m["t0"] - ti) / (to - ti), 0.0), 0.95), 3)
                m["d1"] = round(max(min((m["t1"] - ti) / (to - ti), 1.0), m["d0"] + 0.05), 3)
            meta[sid] = m
    secondary = [sid for sid in meta if "base" in meta[sid]]
    labels = owner

    # floor bands: depth fraction of each band in its block (for the 3D split)
    for sid, m in meta.items():
        if m["kind"] == "floor" and "base" in m:
            b = meta[m["base"]]
            m["frac"] = round(m["area"] / (m["area"] + b["area"]), 3)

    cw, ch = (cfg["crop"][2] - cfg["crop"][0]), (cfg["crop"][3] - cfg["crop"][1])
    payload = dict(
        source=cfg["source"],
        viewBox=[0, 0, round(cw / cfg["k"], 2), round(ch / cfg["k"], 2)],
        ellipse=dict(cx=ecx, cy=ecy, A=eA, B=eB),
        legend={str(p): [int(v) for v in c] for p, c in zip(PRICES, legend)},
        mapShadeLab={str(p): [round(float(v), 1) for v in c] for p, c in zip(PRICES, centres)},
        hotspots=dict(sorted(hotspots.items())),
        labels=lab_pos,
        meta=meta,
    )
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    json.dump(payload, open(out_dir / f"{city}DamaiHotspots.json", "w"), ensure_ascii=False, indent=0)
    unl = [(comps[ci]["tier"], comps[ci]["bbox"]) for ci in range(len(comps)) if ci not in owner and ci not in excluded]
    print(f"  hotspots {len(hotspots)} (floor {sum(m['kind'] == 'floor' for m in meta.values())}, price bands {len(secondary)}, joined by touch {joined}); excluded cells {len(excluded)}; unlabelled lit cells {len(unl)}")
    print("  labels with no lit cell (obstructed / not on sale):", no_cells)
    print("  multi-part hotspots:", split_cells)
    print("  labels on a dark part that took the lit cell they touch:", sorted((owner.get(i, "?"), sh) for i, sh in touch_only))
    for t, bb in unl:
        vx, vy = to_vb(bb[0] + bb[2] / 2, bb[1] + bb[3] / 2)
        print(f"    unlabelled {TONES[t]} @view ({vx:.0f},{vy:.0f}) size {bb[2] / k:.0f}x{bb[3] / k:.0f}")
    return payload


if __name__ == "__main__":
    run(sys.argv[1], sys.argv[2], sys.argv[3])
