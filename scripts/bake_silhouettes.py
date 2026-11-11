#!/usr/bin/env python3
"""Bake the seated-audience silhouette atlas ("shadow cut boards") from real photos.

Each SHOTS entry points at one dark audience member in the foreground of a
concert-goer photo in assets/refs/xhs/ (on disk only, never shipped). The head
and shoulder outline is cut out of the photo by thresholding the dark figure
against the bright stage behind it. Only the outline is kept: the atlas holds
black-and-white masks, no photo pixels, so no person can be recognised.

Backs and shoulders come from the photos too. TRACES holds eight people seen from
behind whose hair, neck, shoulders and upper back are visible (seated rows in
nest_首场_0001, the crowd in unknown_全价位_0006). They are not dark against a bright
stage, so they cannot be thresholded; each is a polygon traced by hand over the
photo, in photo pixels (accuracy about +-4 px).

Cells 0-7   the eight traced figures, whole (hair, neck, shoulders, upper back).
Cells 8-23  the sixteen thresholded heads. The photos stop at the bottom edge of
            the frame, usually at the neck, so each head is continued with the
            shoulder and back profile of the traced figure that fits it best.
Cells 24-31 eight of the above mirrored, with a raised arm holding a phone or a
            light stick drawn on (shapes after nest_917_0005 and nest_山顶_0006).

Atlas: 8 x 4 cells of 128 x 256 px (one cell = a 0.62 x 1.24 m card).
  R = soft silhouette mask (alpha test at 0.5), G = glow mask (phone, stick).

Run with: python3 -I scripts/bake_silhouettes.py [preview.png]   (needs Pillow)
"""
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

SRC = Path('assets/refs/xhs')
OUT = Path('public/stage/joker_xue_2026/crowd/silhouettes.webp')
CW, CH, COLS, ROWS = 128, 256, 8, 4
CARD_W = 0.62  # metres across one cell
PX = CW / CARD_W  # px per metre
HEAD_TOP = 84  # row of the top of the head in a cell (head top = 0.83 m above card foot)
HEAD_W = 0.2  # metres, hair included

# file, box (x0, y0, x1, y1) in photo px, head = (x_left, x_right) of the head in photo px.
# t = threshold tweak (fraction between dark and bright level, default 0.5).
SHOTS = [
    dict(f='nest/nest_山顶_0005.webp', box=(740, 840, 1040, 1080), head=(800, 990)),
    dict(f='nest/nest_山顶_0005.webp', box=(1250, 915, 1440, 1080), head=(1285, 1440)),
    dict(f='nest/nest_山顶_0006.webp', box=(690, 760, 1020, 1080), head=(735, 1000)),
    dict(f='nest/nest_山顶_0006.webp', box=(1265, 840, 1440, 1080), head=(1290, 1440)),
    dict(f='nest/nest_山顶_0006.webp', box=(320, 880, 432, 1000), head=(340, 420)),
    dict(f='nest/nest_山顶_0006.webp', box=(1130, 880, 1265, 1010), head=(1150, 1250)),
    dict(f='nest/nest_山顶_0006.webp', box=(1000, 890, 1090, 990), head=(1012, 1080)),
    dict(f='nest/nest_山顶_0004.webp', box=(850, 870, 1160, 1080), head=(885, 1130)),
    dict(f='nest/nest_山顶_0004.webp', box=(465, 965, 575, 1080), head=(480, 560)),
    dict(f='unknown/unknown_全价位_0007.webp', box=(770, 885, 960, 1080), head=(795, 940)),
    dict(f='unknown/unknown_全价位_0007.webp', box=(140, 955, 310, 1080), head=(165, 290)),
    dict(f='unknown/unknown_全价位_0007.webp', box=(485, 960, 615, 1080), head=(500, 600)),
    dict(f='nest/nest_517_0002.webp', box=(975, 895, 1175, 1080), head=(1000, 1150)),
    dict(f='nest/nest_517_0002.webp', box=(610, 990, 730, 1080), head=(625, 715)),
    dict(f='nest/nest_山顶_0003.webp', box=(900, 1000, 1200, 1080), head=(930, 1170)),
    dict(f='nest/nest_917_0005.webp', box=(815, 1240, 960, 1440), head=(835, 945)),
]


def value(im):
    """max(R, G, B): a red-lit stage is still 'bright', a dark head is dark in every channel."""
    r, g, b = im.split()
    px = [max(t) for t in im.get_flattened_data()]
    out = Image.new('L', im.size)
    out.putdata(px)
    return out


def outline(shot):
    """Per-row (left, right) of the figure, in box px, from the head top down. Row-convex."""
    im = Image.open(SRC / shot['f']).convert('RGB')
    x0, y0, x1, y1 = shot['box']
    crop = value(im.crop((x0, y0, x1, y1))).filter(ImageFilter.GaussianBlur(1.6))
    w, h = crop.size
    data = list(crop.get_flattened_data())
    hx0, hx1 = shot['head'][0] - x0, shot['head'][1] - x0
    cx = (hx0 + hx1) // 2
    # dark level = the figure under the head centre; bright level = the stage above the head
    col = [data[y * w + cx] for y in range(h)]
    dark = sorted(col)[len(col) // 5]
    bright = sorted(data[: w * max(4, h // 6)])[int(w * max(4, h // 6) * 0.6)]
    thr = dark + (bright - dark) * shot.get('t', 0.5)
    mask = [v < thr for v in data]
    # top of the head: first row where the centre columns are dark and stay dark
    top = next((y for y in range(h - 6) if all(mask[(y + k) * w + cx] for k in range(6))), None)
    if top is None:
        return None
    rows, l, r = [], cx, cx
    for y in range(top, h):
        if not any(mask[y * w + x] for x in range(max(0, l), min(w, r + 1))):
            break
        # the run of dark pixels that contains (or is nearest to) the head centre line
        c = cx if mask[y * w + cx] else min((x for x in range(max(0, l), min(w, r + 1)) if mask[y * w + x]), key=lambda x: abs(x - cx))
        nl = nr = c
        while nl > 0 and mask[y * w + nl - 1]:
            nl -= 1
        while nr < w - 1 and mask[y * w + nr + 1]:
            nr += 1
        # A head outline changes slowly from row to row and stays inside the head box; a jump
        # is a neighbour's head or hand merging in, so it is clamped away. The crown (first
        # rows) is nearly flat and may widen freely.
        hw = hx1 - hx0
        if y - top > hw * 0.3:
            step = max(2, hw // 16)
            nl, nr = max(nl, l - step), min(nr, r + step)
            nl, nr = min(nl, l + step * 2), max(nr, r - step * 2)
        if y - top < hw * 1.15:
            nl, nr = max(nl, hx0 - hw // 12), min(nr, hx1 + hw // 12)
        l, r = nl, nr
        rows.append((l, r))
    # median-of-9 down the rows takes the camera noise out of the edge
    med = lambda v: sorted(v)[len(v) // 2]
    rows = [(med([rows[min(len(rows) - 1, max(0, i + k))][0] for k in range(-4, 5)]), med([rows[min(len(rows) - 1, max(0, i + k))][1] for k in range(-4, 5)])) for i in range(len(rows))]
    return rows, (hx0, hx1)


# Hand-traced back views: f = photo, cx = head centre line, top = top of the hair, L / R = left
# and right outline from the top down (photo px), sh = shoulder width the trace is scaled to
# (metres; typical 0.40-0.46 m, the card is 0.62 m wide). mirror=True: the right half is hidden
# behind a neighbour in the photo and is the left half mirrored.
TRACES = [
    dict(name='A long loose hair, seated', f='nest/nest_首场_0001.webp', cx=92, top=1117, sh=0.44,
         L=[(78, 1120), (68, 1128), (62, 1142), (58, 1160), (54, 1180), (50, 1198), (40, 1206), (33, 1222), (32, 1240), (38, 1254), (48, 1262)],
         R=[(106, 1120), (115, 1128), (120, 1142), (121, 1158), (122, 1175), (126, 1192), (138, 1198), (146, 1210), (148, 1228), (144, 1246), (138, 1262)]),
    dict(name='B low ponytail, seated', f='nest/nest_首场_0001.webp', cx=207, top=1146, sh=0.42,
         L=[(197, 1149), (190, 1157), (187, 1170), (187, 1185), (190, 1197), (184, 1204), (174, 1210), (168, 1222), (166, 1238), (169, 1252), (176, 1262)],
         R=[(217, 1149), (224, 1157), (227, 1170), (226, 1184), (224, 1193), (236, 1194), (248, 1193), (254, 1203), (255, 1222), (254, 1242), (248, 1262)]),
    dict(name='C long hair over puff sleeves, seated', f='nest/nest_首场_0001.webp', cx=330, top=1100, sh=0.46,
         L=[(318, 1103), (310, 1112), (306, 1126), (304, 1145), (302, 1165), (298, 1180), (284, 1184), (275, 1196), (271, 1215), (272, 1238), (277, 1254), (284, 1262)],
         R=[(342, 1103), (350, 1112), (355, 1126), (357, 1145), (359, 1165), (362, 1176), (374, 1178), (384, 1190), (388, 1210), (388, 1232), (384, 1250), (378, 1262)]),
    dict(name='D hair up, seated', f='nest/nest_首场_0001.webp', cx=440, top=1107, sh=0.42,
         L=[(430, 1110), (423, 1118), (419, 1132), (420, 1146), (427, 1157), (424, 1165), (410, 1171), (398, 1180), (391, 1196), (388, 1218), (389, 1238), (393, 1250)],
         R=[(450, 1110), (458, 1118), (462, 1132), (460, 1146), (453, 1157), (456, 1164), (470, 1168), (486, 1175), (493, 1190), (496, 1212), (495, 1234), (491, 1250)]),
    dict(name='E high ponytail, T-shirt', f='unknown/unknown_全价位_0006.webp', cx=424, top=1157, sh=0.44,
         L=[(400, 1162), (386, 1175), (379, 1195), (377, 1220), (379, 1245), (386, 1262), (392, 1278), (393, 1293), (380, 1304), (358, 1316), (340, 1330), (328, 1348), (321, 1372), (316, 1400), (314, 1420)],
         R=[(440, 1160), (456, 1172), (467, 1190), (472, 1212), (471, 1238), (464, 1258), (454, 1272), (449, 1286), (462, 1294), (486, 1299), (503, 1312), (513, 1332), (518, 1360), (520, 1390), (521, 1420)]),
    dict(name='F clipped-up bun with loose strands', f='unknown/unknown_全价位_0006.webp', cx=208, top=1143, sh=0.44,
         L=[(215, 1146), (200, 1160), (184, 1180), (170, 1200), (158, 1222), (150, 1245), (149, 1265), (154, 1282), (158, 1296), (140, 1306), (112, 1318), (88, 1330), (72, 1348), (64, 1372), (60, 1400), (58, 1420)],
         R=[(246, 1150), (256, 1168), (264, 1190), (268, 1215), (266, 1240), (258, 1262), (248, 1278), (242, 1292), (262, 1299), (284, 1308), (300, 1324), (310, 1346), (314, 1375), (316, 1400), (316, 1420)]),
    dict(name='G long straight hair down the back', f='unknown/unknown_全价位_0006.webp', cx=692, top=1097, sh=0.44, mirror=True, flip=True, join=False,
         # traced on the photo's right side (hair edge, then the visible shoulder); stored as L of a flipped figure
         L=[(702, 1099), (725, 1108), (745, 1125), (760, 1150), (772, 1180), (783, 1210), (806, 1218), (830, 1232), (846, 1255), (854, 1290), (858, 1350), (858, 1420)]),
    dict(name='H short hair, broad shoulders', f='unknown/unknown_全价位_0006.webp', cx=578, top=1104, sh=0.46, mirror=True,
         L=[(562, 1107), (550, 1116), (543, 1132), (540, 1152), (539, 1172), (536, 1182), (540, 1196), (546, 1210), (548, 1222), (530, 1234), (506, 1248), (490, 1268), (482, 1296), (479, 1340), (478, 1420)]),
]


def chaikin(pts, n=2):
    """Corner cutting: turns a coarse traced polyline into a smooth curve (ends kept)."""
    for _ in range(n):
        out = [pts[0]]
        for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
            out += [(0.75 * x0 + 0.25 * x1, 0.75 * y0 + 0.25 * y1), (0.25 * x0 + 0.75 * x1, 0.25 * y0 + 0.75 * y1)]
        pts = out + [pts[-1]]
    return pts


def trace_profile(tr):
    """Traced figure -> (left, right) lists of (d, half-width), both in metres; d is measured
    down from the top of the hair, half-widths from the head centre line."""
    cx, top = tr['cx'], tr['top']
    L = [(abs(x - cx), y - top) for x, y in tr['L']]
    R = L if tr.get('mirror') else [(abs(x - cx), y - top) for x, y in tr['R']]
    if tr.get('flip'):
        L, R = R, L
    k = tr['sh'] / (max(w for w, _ in L) + max(w for w, _ in R))  # photo px -> metres
    side = lambda P: [(y * k, w * k) for w, y in chaikin([(0.0, 0.0)] + P)]
    return side(L), side(R)


def half_width(prof, d):
    """Half-width (m) of a traced side d metres below the top of the head. Below the end of the
    trace the back carries on down to the seat with a slight taper to the waist."""
    if d <= prof[0][0]:
        return prof[0][1]
    for (d0, w0), (d1, w1) in zip(prof, prof[1:]):
        if d <= d1:
            return w0 + (w1 - w0) * (d - d0) / max(1e-6, d1 - d0)
    d_end, w_end = prof[-1]
    return w_end * (1 - 0.1 * min(1.0, (d - d_end) / 0.3))


PROFILES = [trace_profile(t) for t in TRACES]


def traced_cell(i, mirror=False):
    """One traced figure, whole."""
    L, R = PROFILES[i]
    if mirror:
        L, R = R, L
    S = 4
    im = Image.new('L', (CW * S, CH * S), 0)
    ys = [HEAD_TOP + j * 0.75 for j in range(int((CH + 2 - HEAD_TOP) / 0.75))]
    left = [((CW / 2 - half_width(L, (y - HEAD_TOP) / PX) * PX) * S, y * S) for y in ys]
    right = [((CW / 2 + half_width(R, (y - HEAD_TOP) / PX) * PX) * S, y * S) for y in ys]
    ImageDraw.Draw(im).polygon(left + right[::-1], fill=255)
    return im, S




def best_back(d_end, la, ra, used):
    """The traced figure whose outline is closest to the photo outline where the photo stops.
    Figures already used often are penalised so that all eight backs appear."""
    def cost(i):
        L, R = PROFILES[i]
        return abs(half_width(L, d_end) - la) + abs(half_width(R, d_end) - ra) + 0.012 * used.count(i)
    # the hair curtain (G) only stands as itself: joined under another head it reads as a slab
    return min((i for i in range(len(PROFILES)) if TRACES[i].get('join', True)), key=cost)


def cell_mask(rows, head, mirror=False, used=None, back=None):
    """Scale the photo outline so the head is HEAD_W wide, continue it with a traced back."""
    hx0, hx1 = head
    k = HEAD_W * PX / max(1, hx1 - hx0)  # photo px -> cell px
    cx = (hx0 + hx1) / 2
    S = 4  # supersample
    im = Image.new('L', (CW * S, CH * S), 0)
    d = ImageDraw.Draw(im)
    pts_l, pts_r = [], []
    for i, (l, r) in enumerate(rows):
        y = HEAD_TOP + i * k
        if y > CH - 2:
            break
        a, b = (l - cx) * k, (r + 1 - cx) * k
        if mirror:
            a, b = -b, -a
        pts_l.append((CW / 2 + a, y))
        pts_r.append((CW / 2 + b, y))
    # Below the photo edge: neck, shoulders and upper back of a traced figure. Its profile is
    # scaled to meet the photo outline where the photo stops, and relaxes to true size over 0.1 m.
    y_end = pts_l[-1][1]
    d_end = (y_end - HEAD_TOP) / PX
    la, ra = (CW / 2 - pts_l[-1][0]) / PX, (pts_r[-1][0] - CW / 2) / PX
    if back is None:
        back = best_back(d_end, la, ra, used if used is not None else [])
    if used is not None:
        used.append(back)
    L, R = PROFILES[back]
    if mirror:
        L, R = R, L
    tl, tr = la / max(0.02, half_width(L, d_end)), ra / max(0.02, half_width(R, d_end))
    y = y_end
    while y < CH + 2:
        y += 1.5
        d_m = (y - HEAD_TOP) / PX
        f = min(1.0, (d_m - d_end) / 0.1)
        f = f * f * (3 - 2 * f)
        pts_l.append((CW / 2 - half_width(L, d_m) * (tl + (1 - tl) * f) * PX, y))
        pts_r.append((CW / 2 + half_width(R, d_m) * (tr + (1 - tr) * f) * PX, y))
    poly = [(x * S, y * S) for x, y in pts_l] + [(x * S, y * S) for x, y in reversed(pts_r)]
    d.polygon(poly, fill=255)
    return im, S, back


def add_prop(im, S, kind, side):
    """Raised forearm holding a phone or a light stick. Returns the glow mask (same size)."""
    glow = Image.new('L', im.size, 0)
    d, g = ImageDraw.Draw(im), ImageDraw.Draw(glow)
    sx = lambda x: (CW / 2 + side * x) * S
    sy = lambda y: y * S
    shoulder = (sx(0.17 * PX), sy(HEAD_TOP + 0.38 * PX))
    if kind == 'phone':
        hand = (sx(0.16 * PX), sy(HEAD_TOP - 0.1 * PX))
        d.line([shoulder, (sx(0.235 * PX), sy(HEAD_TOP + 0.2 * PX)), hand], fill=255, width=int(0.075 * PX * S), joint='curve')
        d.ellipse([hand[0] - 0.045 * PX * S, hand[1] - 0.045 * PX * S, hand[0] + 0.045 * PX * S, hand[1] + 0.045 * PX * S], fill=255)
        # phone held landscape, screen towards us
        pw, ph = 0.16 * PX * S, 0.078 * PX * S
        c = (hand[0] - side * 0.02 * PX * S, hand[1] - 0.06 * PX * S)
        d.rounded_rectangle([c[0] - pw / 2, c[1] - ph / 2, c[0] + pw / 2, c[1] + ph / 2], radius=3 * S, fill=255)
        g.rounded_rectangle([c[0] - pw / 2 + 2 * S, c[1] - ph / 2 + 2 * S, c[0] + pw / 2 - 2 * S, c[1] + ph / 2 - 2 * S], radius=2 * S, fill=255)
    else:
        hand = (sx(0.2 * PX), sy(HEAD_TOP - 0.02 * PX))
        d.line([shoulder, (sx(0.24 * PX), sy(HEAD_TOP + 0.22 * PX)), hand], fill=255, width=int(0.07 * PX * S), joint='curve')
        d.ellipse([hand[0] - 0.045 * PX * S, hand[1] - 0.045 * PX * S, hand[0] + 0.045 * PX * S, hand[1] + 0.045 * PX * S], fill=255)
        # light stick: 24 cm lit tube on a short handle, tilted
        tip = (hand[0] - side * 0.03 * PX * S, hand[1] - 0.3 * PX * S)
        base = (hand[0] + side * 0.01 * PX * S, hand[1] - 0.05 * PX * S)
        g.line([base, tip], fill=255, width=int(0.042 * PX * S))
        for p in (base, tip):
            g.ellipse([p[0] - 0.021 * PX * S, p[1] - 0.021 * PX * S, p[0] + 0.021 * PX * S, p[1] + 0.021 * PX * S], fill=255)
    return glow


def main():
    cells, used, shots = [], [], []
    for shot in SHOTS:
        res = outline(shot)
        if not res or len(res[0]) < 12:
            print('skip', shot['f'], shot['box'])
            continue
        cells.append(res)
        used.append(shot['f'])
        shots.append(shot['f'])
    print(len(cells), 'outlines from', len(set(used)), 'photos')
    atlas = Image.new('RGB', (CW * COLS, CH * ROWS), (0, 0, 0))
    n, nt, backs = COLS * ROWS, len(TRACES), []
    plain = nt + len(cells)
    for i in range(n):
        if i < nt:
            im, S = traced_cell(i)
            glow = Image.new('L', im.size, 0)
        elif i < plain:
            rows, head = cells[i - nt]
            im, S, back = cell_mask(rows, head, used=backs)
            glow = Image.new('L', im.size, 0)
            print(f'  cell {i}: head from {shots[i - nt]}, back {TRACES[back]["name"]}')
        else:
            j = i - plain
            if j % 2:
                im, S = traced_cell((j * 3 + 1) % nt, mirror=j % 4 == 1)
            else:
                rows, head = cells[(j * 5 + 2) % len(cells)]
                im, S, _ = cell_mask(rows, head, mirror=j % 4 == 0, back=(j * 3) % 6)
            glow = add_prop(im, S, 'phone' if j % 3 == 0 else 'stick', 1 if j % 2 else -1)
        small = lambda m, blur: m.resize((CW, CH), Image.Resampling.LANCZOS).filter(ImageFilter.GaussianBlur(blur))
        r, g = small(im, 1.3), small(glow, 0.8)
        cell = Image.merge('RGB', (r, g, Image.new('L', (CW, CH), 0)))
        atlas.paste(cell, ((i % COLS) * CW, (i // COLS) * CH))
    print(plain, 'plain cells (set SIL.plain in src/scene/silhouettes.js),', n - plain, 'with a phone or stick')
    OUT.parent.mkdir(parents=True, exist_ok=True)
    atlas.save(OUT, 'WEBP', lossless=True, method=6)
    print(OUT, OUT.stat().st_size, 'bytes')
    if len(sys.argv) > 1:
        atlas.save(sys.argv[1])
    for f in sorted(set(shots) | {t['f'] for t in TRACES}):
        print('  used', f)


if __name__ == '__main__':
    main()
