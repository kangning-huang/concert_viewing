#!/usr/bin/env python3
"""Bake the seated-audience silhouette atlas ("shadow cut boards") from real photos.

Each SHOTS entry points at one dark audience member in the foreground of a
concert-goer photo in assets/refs/xhs/ (on disk only, never shipped). The head
and shoulder outline is cut out of the photo by thresholding the dark figure
against the bright stage behind it. Only the outline is kept: the atlas holds
black-and-white masks, no photo pixels, so no person can be recognised.

Photos stop at the bottom edge of the frame, so the upper back below the
photographed shoulder line is continued with a plain taper. Variants 16-31 are
the same outlines mirrored, with a raised arm holding a phone or a light stick
drawn on (shapes after nest_917_0005 and nest_山顶_0006).

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


TEMPLATE = [(0.0, 0.03), (0.02, 0.066), (0.06, 0.092), (0.12, 0.1), (0.18, 0.093), (0.23, 0.074), (0.262, 0.062), (0.285, 0.075), (0.31, 0.15), (0.34, 0.205), (0.38, 0.225), (0.5, 0.225), (0.85, 0.2), (2.0, 0.2)]


def template(d):
    """Half-width (m) of a seated person seen from behind, d metres below the top of the head."""
    d = max(0.0, d)
    for (d0, w0), (d1, w1) in zip(TEMPLATE, TEMPLATE[1:]):
        if d <= d1:
            return w0 + (w1 - w0) * (d - d0) / (d1 - d0)
    return TEMPLATE[-1][1]


def cell_mask(rows, head, mirror=False):
    """Scale the photo outline so the head is HEAD_W wide, continue the upper back below it."""
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
    # Continue below the photo edge with a seated back view: rest of the head, neck, shoulders,
    # upper back. The template is scaled to meet the photo outline where the photo stops.
    y_end = pts_l[-1][1]
    d_end = (y_end - HEAD_TOP) / PX
    la, ra = (CW / 2 - pts_l[-1][0]) / PX, (pts_r[-1][0] - CW / 2) / PX
    tl, tr = la / template(d_end), ra / template(d_end)
    y = y_end
    while y < CH + 2:
        y += 1.5
        d_m = (y - HEAD_TOP) / PX
        f = min(1.0, (d_m - d_end) / 0.1)
        f = f * f * (3 - 2 * f)
        pts_l.append((CW / 2 - template(d_m) * (tl + (1 - tl) * f) * PX, y))
        pts_r.append((CW / 2 + template(d_m) * (tr + (1 - tr) * f) * PX, y))
    poly = [(x * S, y * S) for x, y in pts_l] + [(x * S, y * S) for x, y in reversed(pts_r)]
    d.polygon(poly, fill=255)
    return im, S


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
    cells, used = [], []
    for shot in SHOTS:
        res = outline(shot)
        if not res or len(res[0]) < 12:
            print('skip', shot['f'], shot['box'])
            continue
        cells.append(res)
        used.append(shot['f'])
    print(len(cells), 'outlines from', len(set(used)), 'photos')
    atlas = Image.new('RGB', (CW * COLS, CH * ROWS), (0, 0, 0))
    n = COLS * ROWS
    for i in range(n):
        if i < len(cells):
            rows, head = cells[i]
            im, S = cell_mask(rows, head)
            glow = Image.new('L', im.size, 0)
        else:
            j = i - len(cells)
            rows, head = cells[(j * 5 + 2) % len(cells)]
            im, S = cell_mask(rows, head, mirror=j % 2 == 0)
            glow = add_prop(im, S, 'phone' if j % 3 == 0 else 'stick', 1 if j % 2 else -1)
        small = lambda m, blur: m.resize((CW, CH), Image.Resampling.LANCZOS).filter(ImageFilter.GaussianBlur(blur))
        r, g = small(im, 1.3), small(glow, 0.8)
        cell = Image.merge('RGB', (r, g, Image.new('L', (CW, CH), 0)))
        atlas.paste(cell, ((i % COLS) * CW, (i // COLS) * CH))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    atlas.save(OUT, 'WEBP', lossless=True, method=6)
    print(OUT, OUT.stat().st_size, 'bytes')
    if len(sys.argv) > 1:
        atlas.save(sys.argv[1])
    for f in sorted(set(used)):
        print('  used', f)


if __name__ == '__main__':
    main()
