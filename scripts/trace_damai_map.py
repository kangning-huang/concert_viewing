"""Trace the official Damai Wuxi seat map into per-section tap hotspots.

    python scripts/trace_damai_map.py <damai_seatmap.jpg(webp)> <out_dir> [debug_dir]

Writes:
  <out_dir>/wuxi_damai_map.webp      cropped map (+ price legend strip), no re-drawing
  <out_dir>/wuxiDamaiHotspots.json   {viewBox, image, hotspots:{<sectionId>: "<svg path>"}}

Section ids match src/venues.js (wuxi): floor A1..D6, lower ring "201".."232",
upper ring "4xxa" (lavender band) / "4xxg" (green) / "4xxb" (blue) and, for the end
sections 402/416/418/432, "4xxb" (blue) / "4xxr" (pink). Closed (sight-line) sections
get no hotspot — they stay visibly darkened in the bitmap exactly like Damai.
Needs opencv-python-headless, numpy, pillow.
"""
import json
import math
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

src, out_dir = sys.argv[1], Path(sys.argv[2])
dbg = Path(sys.argv[3]) if len(sys.argv) > 3 else None
out_dir.mkdir(parents=True, exist_ok=True)

full = np.array(Image.open(src).convert("RGB"))
FH, FW, _ = full.shape
SC = 0.5  # work resolution
sm = cv2.resize(full, (int(FW * SC), int(FH * SC)), interpolation=cv2.INTER_AREA)
sm = cv2.bilateralFilter(sm, 7, 30, 7)
h, w, _ = sm.shape
K = w / 960.0  # px per "960-space" unit (Damai export is 960×703 at 1x)

# Map crop in 960-space (bowl) + legend strip.
BOWL = (140, 105, 830, 610)  # analysis region (stops above the black legend bar)
OUT = (140, 105, 830, 676)  # exported image: bowl + legend, untouched layout

hsv = cv2.cvtColor(sm, cv2.COLOR_RGB2HSV)
lab = cv2.cvtColor(sm, cv2.COLOR_RGB2LAB).astype(np.float32)
grad = sum(np.abs(cv2.Sobel(lab[:, :, i], cv2.CV_32F, 1, 0, ksize=3)) + np.abs(cv2.Sobel(lab[:, :, i], cv2.CV_32F, 0, 1, ksize=3)) for i in range(3))
V = hsv[:, :, 2].astype(int)
S = hsv[:, :, 1].astype(int)
Hh = hsv[:, :, 0].astype(int) * 2  # degrees

roi = np.zeros((h, w), bool)
roi[int(BOWL[1] * K):int(BOWL[3] * K), int(BOWL[0] * K):int(BOWL[2] * K)] = True

# ---- labels ("NNN区") ------------------------------------------------------------
blk = ((V < 40) & roi).astype(np.uint8)
d = cv2.dilate(blk, cv2.getStructuringElement(cv2.MORPH_RECT, (9, 3)))
n, l, st, cen = cv2.connectedComponentsWithStats(d, 8)
labels = []
for i in range(1, n):
    x, y, ww, hh, a = st[i]
    if 35 < ww < 110 and 14 < hh < 34 and a > 120 and blk[y:y + hh, x:x + ww].mean() >= 0.12:
        labels.append((cen[i][0] / K, cen[i][1] / K))

# Stage rectangle: big flat light-grey region in the middle.
grey = ((S < 25) & (V > 150) & roi).astype(np.uint8)
n, l, st, cen = cv2.connectedComponentsWithStats(grey, 8)
si = max(range(1, n), key=lambda i: st[i, 4])
sx, sy, sw, sh = st[si, :4] / K
stage = dict(x0=sx, y0=sy, x1=sx + sw, y1=sy + sh)
CX, CY = sx + sw / 2, sy + sh / 2
labels = [p for p in labels if not (stage["x0"] < p[0] < stage["x1"] and stage["y0"] < p[1] < stage["y1"])]

# Ring geometry: normalise by an ellipse through the lower-ring labels.
def polar(x, y, A, B):
    dx, dy = (x - CX) / A, (y - CY) / B
    return math.hypot(dx, dy), math.atan2(dy, dx)

floor = [p for p in labels if stage["x0"] - 100 < p[0] < stage["x1"] + 100 and stage["y0"] - 50 < p[1] < stage["y1"] + 50]
ring = [p for p in labels if p not in floor]
A0 = max(abs(p[0] - CX) for p in ring)
B0 = max(abs(p[1] - CY) for p in ring)
rho = sorted(polar(*p, A0, B0)[0] for p in ring)
gaps = [(rho[i + 1] - rho[i], i) for i in range(len(rho) - 1)]
# split rings at the largest radial gap
split = (rho[max(gaps)[1]] + rho[max(gaps)[1] + 1]) / 2
lower = [p for p in ring if polar(*p, A0, B0)[0] < split]
upper = [p for p in ring if polar(*p, A0, B0)[0] >= split]
assert len(floor) == 24 and len(lower) == 32 and len(upper) == 30, (len(floor), len(lower), len(upper))

def ang(p):  # clockwise on screen from east, normalised to [-pi/32, 2pi - pi/32)
    a = polar(*p, A0, B0)[1]
    return a + 2 * math.pi if a < -math.pi / 32 else a

ids = {}
for i, p in enumerate(sorted(lower, key=ang)):
    ids[p] = str(201 + i)
up_nums = [n for n in range(402, 433) if n != 417]
for i, p in enumerate(sorted(upper, key=ang)):
    ids[p] = str(up_nums[i])
# floor grid
above = sorted([p for p in floor if p[1] < stage["y0"]], key=lambda p: p[0])
below = sorted([p for p in floor if p[1] > stage["y1"]], key=lambda p: p[0])
left = [p for p in floor if p[0] < stage["x0"] and stage["y0"] <= p[1] <= stage["y1"] + 5]
right = [p for p in floor if p[0] > stage["x1"] and stage["y0"] <= p[1] <= stage["y1"] + 5]
for i, p in enumerate(above):
    ids[p] = f"A{6 - i}"
for i, p in enumerate(below):
    ids[p] = f"C{i + 1}"
lmid = (min(p[0] for p in left) + max(p[0] for p in left)) / 2
for col, base in ((sorted([p for p in left if p[0] > lmid], key=lambda p: p[1]), 1), (sorted([p for p in left if p[0] <= lmid], key=lambda p: p[1]), 4)):
    for i, p in enumerate(col):
        ids[p] = f"B{base + i}"
rmid = (min(p[0] for p in right) + max(p[0] for p in right)) / 2
for col, base in ((sorted([p for p in right if p[0] < rmid], key=lambda p: p[1]), 3), (sorted([p for p in right if p[0] >= rmid], key=lambda p: p[1]), 6)):
    for i, p in enumerate(col):
        ids[p] = f"{'D'}{base - i}"
assert len(set(ids.values())) == 86, len(set(ids.values()))

# ---- faces --------------------------------------------------------------------------
face = (grad < 60) & (V > 55) & (S > 35) & roi
face = cv2.morphologyEx(face.astype(np.uint8), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
n, lbl, st, cen = cv2.connectedComponentsWithStats(face, 8)

CLOSED = {3, 4, 14, 15, 19, 20, 30, 31}
END = {2, 16, 18, 32}

def band_of(hue, sat, val):
    # lavender ~255-275°, green ~80-110°, blue ~195-210°, pink ~335-350°
    if 60 <= hue < 150:
        return "g"
    if 180 <= hue < 235:
        return "b"
    if 235 <= hue < 300:
        return "a"
    return "r"

ring_lists = {"lower": [(ang(p), ids[p]) for p in lower], "upper": [(ang(p), ids[p]) for p in upper]}
for k in ring_lists:
    ring_lists[k].sort()

def ring_radius(pts):
    arr = sorted((ang(p), polar(*p, A0, B0)[0]) for p in pts)
    arr = [(a - 2 * math.pi, r) for a, r in arr[-2:]] + arr + [(a + 2 * math.pi, r) for a, r in arr[:2]]
    def f(a):
        for (a0, r0), (a1, r1) in zip(arr, arr[1:]):
            if a0 <= a <= a1:
                return r0 + (r1 - r0) * (a - a0) / (a1 - a0)
        return arr[0][1]
    return f

r_lower, r_upper = ring_radius(lower), ring_radius(upper)
RING_T = 0.36  # fraction of the way from lower-ring labels to upper-ring labels


def nearest_in_ring(ring_name, a):
    best, bid = 9, None
    for la, lid in ring_lists[ring_name]:
        dd = abs((a - la + math.pi) % (2 * math.pi) - math.pi)
        if dd < best:
            best, bid = dd, lid
    return bid

masks = {}
for i in range(1, n):
    if st[i, 4] < 60:
        continue
    cx, cy = cen[i][0] / K, cen[i][1] / K
    m = lbl == i
    hue = float(np.median(Hh[m]))
    sat = float(np.median(S[m]))
    val = float(np.median(V[m]))
    if stage["x0"] - 2 < cx < stage["x1"] + 2 and stage["y0"] - 2 < cy < stage["y1"] + 2:
        continue
    r, _ = polar(cx, cy, A0, B0)
    p = (cx, cy)
    # floor: nearest floor label (blocks are compact)
    fl = min(floor, key=lambda q: math.hypot(q[0] - cx, q[1] - cy))
    if r < split * 0.80 and math.hypot(fl[0] - cx, fl[1] - cy) < 40:
        sid = ids[fl]
    elif val < 105:
        continue  # dark extrusion side-faces of ring blocks: not tap targets (they span sections)
    elif (r - r_lower(ang(p))) / (r_upper(ang(p)) - r_lower(ang(p))) < RING_T:
        sid = nearest_in_ring("lower", ang(p))
        if int(sid) - 200 in CLOSED:
            continue
    else:
        num = nearest_in_ring("upper", ang(p))
        k = int(num) - 400
        if k in CLOSED:
            continue
        b = band_of(hue, sat, val)
        if k in END:
            sid = num + ("r" if b == "r" else "b")
        else:
            sid = num + {"a": "a", "g": "g", "b": "b", "r": "b"}[b]
    masks.setdefault(sid, np.zeros((h, w), np.uint8))
    masks[sid][m] = 1

# ---- polygons -----------------------------------------------------------------------
ox, oy = BOWL[0], BOWL[1]
paths = {}
for sid, m in masks.items():
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8))
    cs, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    parts = []
    for c in cs:
        if cv2.contourArea(c) < 40:
            continue
        c = cv2.approxPolyDP(c, 1.2, True)
        pts = [(x / K - ox, y / K - oy) for [[x, y]] in c]
        parts.append("M" + "L".join(f"{x:.1f},{y:.1f}" for x, y in pts) + "Z")
    paths[sid] = "".join(parts)

bw, bh = OUT[2] - OUT[0], OUT[3] - OUT[1]
OUT_SCALE = 2.0  # output px per 960-unit
fs = FW / 960.0
x0, y0, x1, y1 = (int(v * fs) for v in OUT)
img = full[y0:y1, x0:x1].copy()
# paint out the poster's logo/date text that falls inside the crop (top-left corner, outside the bowl)
dmask = np.zeros(img.shape[:2], np.uint8)
a0, b0, a1, b1 = (int(v * fs) for v in (0, 0, 305 - OUT[0], 160 - OUT[1]))
dmask[b0:b1, a0:a1] = 255
dmask[: int(72 * fs), : int(60 * fs)] = 255  # poster caption under the logo
_hsv = cv2.cvtColor(img, cv2.COLOR_RGB2HSV)
dmask &= ((_hsv[:, :, 2] > 80) & (_hsv[:, :, 1] < 60)).astype(np.uint8) * 255  # white/grey poster text only
dmask = cv2.dilate(dmask, np.ones((9, 9), np.uint8))
img = cv2.inpaint(img, dmask, 9, cv2.INPAINT_TELEA)
canvas = cv2.resize(img, (int(bw * OUT_SCALE), int(bh * OUT_SCALE)), interpolation=cv2.INTER_AREA)
Image.fromarray(canvas).save(out_dir / "wuxi_damai_map.webp", quality=88, method=6)

json.dump(
    {
        "source": "Damai official Wuxi seat map (img.alicdn.com …/O1CN01IP1U7bZncwG6i2uw), traced by scripts/trace_damai_map.py",
        "viewBox": [0, 0, bw, bh],
        "stage": {k: (v - (ox if k[0] == "x" else oy)) for k, v in stage.items()},
        "hotspots": dict(sorted(paths.items())),
        "labels": {ids[p]: [round(p[0] - ox, 1), round(p[1] - oy, 1)] for p in ids},
    },
    open(out_dir / "wuxiDamaiHotspots.json", "w"),
    ensure_ascii=False,
    indent=0,
)
print("hotspots", len(paths), "sections", sorted(paths)[:8], "…")

if dbg:
    dbg.mkdir(parents=True, exist_ok=True)
    vis = cv2.resize(canvas, (int(bw * 2), int(bh * 2)))
    vis = (vis * 0.55).astype(np.uint8)
    rng = np.random.default_rng(3)
    for sid, path in paths.items():
        col = tuple(int(c) for c in rng.integers(80, 255, 3))
        for part in path.split("Z"):
            if not part:
                continue
            pts = np.array([[float(v) * 2 for v in xy.split(",")] for xy in part[1:].split("L")], np.int32)
            cv2.polylines(vis, [pts], True, col, 2)
        if sid in {ids[p] for p in ids} or sid[:-1] in {ids[p] for p in ids}:
            pass
    for p, sid in ids.items():
        cv2.putText(vis, sid, (int((p[0] - ox) * 2) - 14, int((p[1] - oy) * 2) + 22), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 0), 1)
    Image.fromarray(vis).save(dbg / "hotspots_debug.png")
