#!/usr/bin/env python3
"""Bake LED content for kit joker_xue_2026 from real Nest show photos.

Each entry below un-keystones one screen out of a concert-goer photo in
assets/refs/xhs/nest/ (git-ignored, on disk only) and writes tiered WebP files
to public/stage/joker_xue_2026/led/<size>/. Crops hold only the screen, so no
audience members appear in them.

Run with: python3 -I scripts/bake_led_textures.py  (needs Pillow, repo root as cwd)
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageOps

SRC = Path('assets/refs/xhs/nest')
OUT = Path('public/stage/joker_xue_2026/led')
SIZES = (2048, 1024, 512)

# World sizes from SharedStage.tsx (LED and IMAG). module = LED cabinet pitch.
WIDE = (36, 13)
SIDE = (20, 13)
IMAG = (12, 20)
MODULE = 0.5

# quad: source pixels TL, TR, BR, BL of the screen region.
# source_aspect: true width/height of that region once flattened, when it is
# narrower than the target; the rest is filled by mirroring on the right.
# patches: (x0, y0, x1, y1) in 0-1 output space, hung speakers covering the
# screen; each is replaced by the mirrored strip to its right.
SHOTS = {
    'front': dict(file='nest_山顶_0010.webp', world=WIDE, quad=[(0, 256), (1260, 256), (1260, 785), (0, 770)], source_aspect=2.42),
    'right': dict(file='nest_537_0004.webp', world=SIDE, quad=[(420, 240), (1332, 270), (1332, 885), (420, 755)], patches=[(0.22, 0.0, 0.31, 0.2)]),
    'back': dict(file='nest_226_0011.webp', world=WIDE, quad=[(373, 373), (1188, 414), (1192, 634), (373, 670)], patches=[(0.135, 0.4, 0.25, 1.0), (0.63, 0.0, 0.69, 0.16)]),
    'left': dict(file='nest_537_0006.webp', world=SIDE, quad=[(1296, 269), (1860, 216), (1848, 828), (1296, 912)]),
    'imag1': dict(file='nest_801_0003.webp', world=IMAG, quad=[(0, 300), (900, 300), (900, 1800), (0, 1800)]),
    'imag2': dict(file='nest_317_0004.webp', world=IMAG, quad=[(882, 252), (1310, 266), (1301, 918), (877, 873)]),
    'imag3': dict(file='nest_718_0001.webp', world=IMAG, quad=[(374, 378), (905, 432), (896, 1400), (387, 1269)]),
    'imag4': dict(file='nest_917_0003.webp', world=IMAG, quad=[(522, 504), (995, 500), (995, 1274), (511, 1229)]),
}


def rectify(image, quad, size):
    (tl, tr, br, bl) = quad
    data = (*tl, *bl, *br, *tr)
    return image.transform(size, Image.Transform.QUAD, data, Image.Resampling.BICUBIC)


def mirror_pad_right(image, width):
    missing = width - image.width
    if missing <= 0:
        return image
    strip = ImageOps.mirror(image.crop((image.width - missing, 0, image.width, image.height)))
    padded = Image.new('RGB', (width, image.height))
    padded.paste(image, (0, 0))
    padded.paste(strip, (image.width, 0))
    return padded


def patch(image, box):
    w, h = image.size
    x0, y0, x1, y1 = int(box[0] * w), int(box[1] * h), int(box[2] * w), int(box[3] * h)
    fill = ImageOps.mirror(image.crop((x1, y0, min(w, x1 + (x1 - x0)), y1))).resize((x1 - x0, y1 - y0))
    feather = max(2, (x1 - x0) // 10)
    mask = Image.new('L', fill.size, 0)
    ImageDraw.Draw(mask).rectangle((feather, feather, fill.width - feather, fill.height + feather), fill=255)
    image.paste(fill, (x0, y0), mask.filter(ImageFilter.GaussianBlur(feather / 2)))


def seams(image, modules):
    """LED cabinet seams, the strongest close-range cue; skipped once they would alias."""
    pitch = image.width / modules
    if pitch < 14:
        return image
    overlay = image.copy()
    draw = ImageDraw.Draw(overlay)
    x = 0.0
    while x < image.width:
        draw.line([(round(x), 0), (round(x), image.height)], fill=(0, 0, 0))
        x += pitch
    y = 0.0
    while y < image.height:
        draw.line([(0, round(y)), (image.width, round(y))], fill=(0, 0, 0))
        y += pitch
    return Image.blend(image, overlay, 0.22)


def bake(name, shot, size):
    world_w, world_h = shot['world']
    # All outputs share one texel density: `size` pixels across the 36-unit face.
    longest = round(size * max(world_w, world_h) / WIDE[0])
    scale = longest / max(world_w, world_h)
    width, height = round(world_w * scale), round(world_h * scale)

    source = Image.open(SRC / shot['file']).convert('RGB')
    aspect = shot.get('source_aspect')
    if aspect:
        flat = rectify(source, shot['quad'], (round(height * aspect), height))
        flat = mirror_pad_right(flat, width)
    else:
        flat = rectify(source, shot['quad'], (width, height))
    for box in shot.get('patches', ()):
        patch(flat, box)

    # Phone shots of LED walls come out dull; restore the wall's punch.
    flat = ImageOps.autocontrast(flat, cutoff=(0.4, 0.2), preserve_tone=True)
    flat = ImageEnhance.Color(flat).enhance(1.12)
    flat = seams(flat, world_w / MODULE)

    path = OUT / str(size) / f'{name}.webp'
    path.parent.mkdir(parents=True, exist_ok=True)
    flat.save(path, quality=82 if size > 512 else 76, method=6)
    return path


if __name__ == '__main__':
    for size in SIZES:
        for name, shot in SHOTS.items():
            print(bake(name, shot, size))
