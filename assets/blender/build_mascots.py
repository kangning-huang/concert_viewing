# Build the stage-kit mascots in Blender and bake their textures.
#   ~/Applications/Blender.app/Contents/MacOS/Blender --background --python assets/blender/build_mascots.py [-- --preview]
# Writes assets/blender/mascots.blend (low-poly meshes + atlas images + source parts) and
# assets/blender/tex/mascots_{color,normal}.png. Then run export_mascots.py to write the GLB.
#
# Method (per animal):
#   1. parts: lofts along a spine, ellipsoids and cones, with proportions from the
#      Xiaohongshu photos (same frames as src/stage/mascots.jsx);
#   2. one skin: all parts joined, voxel-remeshed and smoothed -> one inflatable surface,
#      the way the real PVC animals are sewn (no intersecting balloons);
#   3. sculpt by code: every skin vertex is mapped back to the part it came from
#      (u along the spine, angle round the section) and pushed out by that part's relief
#      (mane locks, feather scallops, trunk rings, rock cracks) and painted;
#   4. low poly: the sculpt decimated to a few thousand triangles, UV-unwrapped into one
#      quarter of a shared 1024 x 1024 atlas;
#   5. bake (Cycles): paint, ambient occlusion and tangent-space normals from the sculpt
#      onto the low poly.
import os
import sys
import math
import time
import bpy
import bmesh
import numpy as np
from mathutils import kdtree

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import importlib
import mascot_lib
importlib.reload(mascot_lib)
from mascot_lib import *  # noqa

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
PREVIEW = "--preview" in ARGS
ONLY = [a.split("=", 1)[1] for a in ARGS if a.startswith("--only=")]
ATLAS = 1024
TEX = os.path.join(HERE, "tex")
os.makedirs(TEX, exist_ok=True)
T0 = time.time()


def log(*a):
    print(f"[{time.time() - T0:6.1f}s]", *a, flush=True)


Z = lambda n: np.zeros(n)

# =================================================================================================
# LION — nest_首场_0002: standing on a stone block, head thrown back in a roar, mouth wide open
# (dark red inside, white fangs top and bottom), pale muzzle, small dark eyes under a heavy brow,
# a huge mane that frames the face like a hood and falls in long locks down the chest; the
# mane is golden brown round the face and darkens to red-brown on the chest. Body tan.
# Rock: pink-brown blocks with cracks and joints.
# =================================================================================================
def lion_parts():
    TAN, TAN_D, BELLY = C("#c48d58"), C("#9a6a40"), C("#e0b784")
    MANE_L, MANE, MANE_D = C("#b98652"), C("#8a5532"), C("#45261a")
    FACE, MUZZLE, DARK, MOUTH, TONGUE, TOOTH = C("#d9a971"), C("#efd9b4"), C("#2a1812"), C("#5e1419"), C("#c85a66"), C("#f6f0e2")
    ROCK_L, ROCK_D = C("#c29884"), C("#6f4c3f")
    dy = -1.15

    def fur(u, a, p):
        patch = vnoise(p, 0.55, 3)
        streak = vnoise(p * np.array([3.0, 0.6, 3.0]), 1.4, 5)
        base = mix(TAN, BELLY, -np.sin(a) * 0.9 - 0.25)
        return mix(mix(base, TAN_D, 0.45 * patch * patch), MANE, 0.18 * streak)

    def fur_relief(u, a, p):
        # printed/sculpted fur: shallow streaks along the limbs and body
        return 0.025 * (fbm(p * np.array([2.5, 0.7, 2.5]), 1.6, 2, 11) - 0.5)

    # mane: 17 main locks round the collar, wandering along their length, plus finer
    # strands and overlapping tiers so it reads as hair falling in layers, not ribs.
    LOCKS = 17

    def lock_field(u, a, p):
        # strands: noise stretched along the spine (u) and tight round the collar (a), so
        # locks of uneven width run from the crown down the chest and wander; overlapping
        # tiers make them read as layered hair (photo), not as even pleats
        ring = np.stack([np.cos(a) * 3.2, np.sin(a) * 3.2, u * 1.6], 1)
        n1 = fbm(ring, 1.0, 3, 21)
        n2 = fbm(ring * np.array([2.2, 2.2, 1.3]), 1.0, 2, 27)
        main = smooth(0.32, 0.78, n1)
        fine = smooth(0.3, 0.7, n2)
        tier = (u * 3.6 + 0.6 * fbm(ring, 0.5, 2, 23)) % 1.0
        big = 0.6 + 0.8 * fbm(ring * 0.5, 1.0, 2, 25)
        return main, fine, tier, big

    def mane_relief(u, a, p):
        main, fine, tier, big = lock_field(u, a, p)
        env = np.sin(np.pi * np.clip(u * 1.06, 0, 1)) ** 0.7
        shingle = smooth(0.0, 0.8, tier) * (1 - smooth(0.82, 1.0, tier))
        return (0.3 * big * main + 0.09 * fine + 0.16 * shingle - 0.18) * env

    def mane_paint(u, a, p):
        main, fine, tier, big = lock_field(u, a, p)
        bib = np.clip((8.0 - p[:, 1] + 0.6 * (main - 0.5)) / 2.6, 0, 1)
        base = mix(mix(MANE_L, MANE, 0.2 + 0.8 * bib), MANE_D, bib * bib * 0.75)
        crease = (1 - main) * 0.45 + (1 - fine) * 0.2
        tips = smooth(0.5, 0.95, tier) * 0.3 + 0.2 * main * fine
        c = mix(mix(base, MANE_D, crease), MANE_L * 1.2, tips * (1 - 0.7 * bib))
        return mix(c, FACE, np.clip((u - 0.9) * 5, 0, 1))

    eyes = [np.array([5.25, 10.72 + dy, s * 0.84]) for s in (1, -1)]
    nose = np.array([6.55, 11.25 + dy, 0])

    def face(u, a, p):
        c = mix(FACE, MUZZLE, u * 1.35 - 0.5 - np.sin(a) * 0.2)
        # dark eye lines and brow shadow, nose leather, lip line
        for e in eyes:
            d = np.linalg.norm((p - e) * np.array([1.0, 1.6, 1.0]), axis=1)
            c = mix(c, DARK, (1 - smooth(0.16, 0.42, d)) * 0.85)
        c = mix(c, C("#7a4a3a"), (1 - smooth(0.25, 0.5, np.linalg.norm(p - nose, axis=1))))
        c = mix(c, TAN_D, smooth(0.2, 0.9, -np.sin(a)) * (1 - u) * 0.6)
        return c

    def face_relief(u, a, p):
        # brow and frown wrinkles across the top of the head, whisker-pad dimples
        brow = np.exp(-((u - 0.42) / 0.09) ** 2) * smooth(0.2, 0.9, np.sin(a)) * 0.12
        wrinkles = 0.03 * np.sin(u * 60) * smooth(0.3, 0.9, np.sin(a)) * smooth(0.2, 0.5, u) * (1 - smooth(0.6, 0.8, u))
        return brow + wrinkles

    def leg_relief(u, a, p):
        return fur_relief(u, a, p) + 0.05 * np.exp(-((u - 0.25) / 0.15) ** 2)

    def rock_paint(u, a, p):
        q = p - np.array([-0.4, -1.3, 0])
        strata = 0.5 + 0.5 * np.sin(q[:, 1] * 9 + np.sin(q[:, 0] * 1.2 + q[:, 2]) * 1.6)
        n = fbm(p, 0.5, 3, 31)
        crack = 1 - smooth(0.0, 0.05, np.abs(fbm(p, 0.35, 2, 33) - 0.5))
        top = smooth(0.0, 1.0, q[:, 1])
        c = mix(ROCK_D, ROCK_L, 0.35 + 0.35 * strata + 0.3 * n + 0.2 * top)
        return mix(c, ROCK_D * 0.6, crack * 0.8)

    def rock_relief(u, a, p):
        q = p - np.array([-0.4, -1.3, 0])
        crack = 1 - smooth(0.0, 0.05, np.abs(fbm(p, 0.35, 2, 33) - 0.5))
        # stone-block joints (photo): two horizontal courses, joints every ~3 m
        joint = (1 - smooth(0.0, 0.12, np.abs(((q[:, 1] + 0.3) % 1.4) - 0.7) - 0.6)) * 0
        vj = 1 - smooth(0.02, 0.1, np.abs((q[:, 0] + q[:, 2] * 0.3 + 0.4 * fbm(p, 0.4, 1, 35)) % 3.1 - 1.55) - 1.47)
        return 0.06 * (fbm(p, 0.9, 3, 37) - 0.5) - 0.12 * crack - 0.08 * vj + joint

    P = []
    P.append(box_rock("rock", [11.5, 2.7, 6.6], [-0.4, -1.3, 0], rock_paint, rock_relief))
    # body: rump -> chest (spine as in mascots.jsx)
    P.append(translate(loft("body", [[-4.9, 5.3, 0, 0.5, 0.6], [-4.2, 5.4, 0, 1.55, 1.7], [-2.6, 5.5, 0, 1.75, 1.85], [-0.6, 5.35, 0, 1.6, 1.7], [1.1, 5.6, 0, 1.85, 2.0], [2.5, 6.1, 0, 1.6, 1.9]], fur, fur_relief), (0, dy, 0)))
    # mane: hood round the head + bib that falls down the chest between the front legs
    P.append(translate(loft("mane", [[1.6, 3.6, 0, 0.8, 0.7], [1.9, 4.8, 0, 2.0, 1.7], [2.4, 6.4, 0, 2.8, 2.1], [2.9, 8.0, 0, 3.1, 2.05], [3.2, 9.4, 0, 2.95, 1.85], [3.4, 10.6, 0, 2.45, 1.6], [3.45, 11.5, 0, 1.35, 1.0]], mane_paint, mane_relief, seg=128, per=14), (0, dy, 0)))
    # head tilted up: skull -> muzzle
    P.append(translate(loft("head", [[3.9, 9.2, 0, 1.3, 1.3], [4.7, 9.95, 0, 1.42, 1.32], [5.5, 10.55, 0, 1.14, 0.95], [6.2, 11.0, 0, 0.88, 0.62], [6.55, 11.2, 0, 0.5, 0.32]], face, face_relief), (0, dy, 0)))
    # whisker pads either side of the nose, chin, heavy brow
    for s in (1, -1):
        P.append(translate(ellipsoid(f"pad{s}", [6.05, 10.75, s * 0.36], [0.5, 0.38, 0.42], lambda u, a, p: MUZZLE, rot=[0, 0, 0.6]), (0, dy, 0)))
        P.append(translate(ellipsoid(f"brow{s}", [4.95, 10.95, s * 0.72], [0.55, 0.22, 0.42], face, rot=[0, s * 0.3, 0.55]), (0, dy, 0)))
        P.append(translate(ellipsoid(f"cheek{s}", [4.75, 9.75, s * 0.95], [0.75, 0.7, 0.45], face), (0, dy, 0)))
    # lower jaw dropped wide open (photo: the mouth is a tall dark oval from nose to chin),
    # mouth carved out between the jaws, then tongue and four fangs set into it
    P.append(translate(loft("jaw", [[4.4, 8.95, 0, 0.95, 0.55], [5.25, 8.55, 0, 0.86, 0.46], [5.95, 8.3, 0, 0.66, 0.38], [6.35, 8.28, 0, 0.36, 0.26]], lambda u, a, p: mix(MUZZLE, FACE, -np.sin(a) * 0.6)), (0, dy, 0)))
    P.append(translate(ellipsoid("chin", [5.3, 8.5, 0], [0.9, 0.5, 0.75], lambda u, a, p: MUZZLE), (0, dy, 0)))
    P.append(with_op(translate(ellipsoid("mouth", [6.05, 9.75, 0], [1.35, 0.98, 0.62], lambda u, a, p: MOUTH, rot=[0, 0, 0.45]), (0, dy, 0)), "cut"))
    P.append(with_op(translate(ellipsoid("tongue", [5.55, 9.05, 0], [0.85, 0.22, 0.42], lambda u, a, p: TONGUE, rot=[0, 0, 0.15]), (0, dy, 0)), "late"))
    for s in (1, -1):
        P.append(with_op(translate(cone(f"fangU{s}", [6.15, 10.5, s * 0.42], [0.25, -1, 0], 0.17, 0.7, lambda u, a, p: TOOTH, gloss=1), (0, dy, 0)), "late"))
        P.append(with_op(translate(cone(f"fangL{s}", [6.05, 8.75, s * 0.4], [0.15, 1, 0], 0.15, 0.6, lambda u, a, p: TOOTH, gloss=1), (0, dy, 0)), "late"))
        P.append(translate(ellipsoid(f"eye{s}", [5.28, 10.72, s * 0.84], [0.2, 0.13, 0.12], lambda u, a, p: DARK, gloss=1), (0, dy, 0)))
        P.append(translate(ellipsoid(f"ear{s}", [3.75, 10.95, s * 1.75], [0.5, 0.6, 0.34], lambda u, a, p: MANE, rot=[0, 0, 0.3]), (0, dy, 0)))
    P.append(translate(ellipsoid("nose", [6.6, 11.3, 0], [0.28, 0.21, 0.38], lambda u, a, p: C("#3a2420"), gloss=1), (0, dy, 0)))

    def leg(name, x, z, rear):
        st = ([[x - 0.1, 4.3, z, 1.35, 1.6], [x - 0.35, 3.0, z, 1.15, 1.3], [x - 0.8, 1.9, z, 0.86, 0.95], [x - 0.25, 1.0, z, 0.76, 0.78], [x, 0.3, z, 0.82, 0.82]] if rear
              else [[x, 4.6, z, 1.1, 1.2], [x + 0.1, 3.0, z, 1.0, 1.05], [x + 0.05, 1.6, z, 0.86, 0.88], [x + 0.15, 0.3, z, 0.9, 0.9]])
        return loft(name, st, fur, leg_relief, seg=32, per=8)

    for nm, x, z, rear in (("legFL", 2.1, 1.15, False), ("legFR", 2.1, -1.15, False), ("legBL", -3.5, 1.25, True), ("legBR", -3.5, -1.25, True)):
        P.append(leg(nm, x, z, rear))
        P.append(ellipsoid(nm + "paw", [x + 0.55, 0.45, z], [1.2, 0.52, 1.02], lambda u, a, p: FACE))
        for dz in (-0.52, -0.17, 0.17, 0.52):
            P.append(ellipsoid(nm + f"toe{dz}", [x + 1.38 - abs(dz) * 0.25, 0.32, z + dz], [0.36, 0.3, 0.2], lambda u, a, p: MUZZLE))
    P.append(translate(loft("tail", [[-4.7, 5.6, 0, 0.3, 0.3], [-5.7, 5.0, 0.2, 0.24, 0.24], [-6.3, 3.4, 0.4, 0.2, 0.2], [-6.0, 1.9, 0.5, 0.2, 0.2]], lambda u, a, p: mix(TAN, TAN_D, u), seg=16), (0, dy, 0)))
    P.append(translate(ellipsoid("tuft", [-5.9, 1.5, 0.5], [0.45, 0.65, 0.45], lambda u, a, p: MANE_D, relief=lambda u, a, p: 0.06 * np.sin(np.arctan2(p[:, 2] - 0.5, p[:, 0] + 5.9) * 9)), (0, dy, 0)))
    return P


# =================================================================================================
# EAGLE — nest_首场_0003: dark brown eagle on a pale pink boulder, upright, wings raised and
# thrown back with long separate finger-like primaries, rows of small coverts near the leading
# edge, mottled breast with pale feather edges, slate "trousers", yellow feet and hooked beak,
# long dark tail hanging behind the rock.
# =================================================================================================
def eagle_parts():
    D0, D1, D2 = C("#2e2623"), C("#5b4334"), C("#7b5d47")
    SLATE, SLATE_L, BEAK, FOOT, DARK = C("#3a3c46"), C("#5a5d6c"), C("#e3bd62"), C("#d9a544"), C("#161210")
    PALE = C("#94705f")

    def scallop(u, a, rows, cols, p=None):
        r = u * rows + (0 if p is None else 0.35 * (vnoise(p, 0.9, 43) - 0.5))
        row = np.floor(r)
        fr = r - row
        fc = (a / (2 * np.pi)) * cols + (row % 2) * 0.5
        fx = fc - np.floor(fc) - 0.5
        edge = np.clip(1 - (fr + fx * fx * 2.2) * 1.5, 0, 1)
        return fr, fx, edge

    def feathers(rows, cols, pale):
        def f(u, a, p):
            fr, fx, edge = scallop(u, a, rows, cols, p)
            n = vnoise(p, 1.3, 41)
            return mix(mix(D0, D1, 0.35 + 0.3 * fr + 0.35 * n), pale, edge * 0.55 * (0.5 + n))
        return f

    def feather_relief(rows, cols, amp):
        def f(u, a, p):
            fr, fx, edge = scallop(u, a, rows, cols, p)
            # each feather: raised along its length, tip overlapping the row below
            return amp * (smooth(0.0, 0.9, fr) - 0.5 - 0.5 * np.abs(fx))
        return f

    P = []
    P.append(box_rock("rock", [4.6, 2.0, 3.7], [0.2, -1.3, 0], lambda u, a, p: mix(C("#8e6656"), C("#d6aa92"), 0.35 + 0.65 * fbm(p, 0.7, 3, 51)),
                      lambda u, a, p: 0.07 * (fbm(p, 0.8, 3, 53) - 0.5) + 0.05 * np.sin(p[:, 1] * 6 + fbm(p, 0.5, 1, 55) * 4), round_=True))
    P.append(loft("body", [[-1.5, 2.0, 0, 0.7, 0.6], [-0.7, 3.0, 0, 1.55, 1.5], [0.1, 4.6, 0, 1.8, 1.75], [0.8, 6.2, 0, 1.55, 1.55], [1.4, 7.5, 0, 1.05, 1.1], [1.9, 8.4, 0, 0.88, 0.9], [2.5, 8.75, 0, 0.62, 0.64]],
                  feathers(13, 16, PALE), feather_relief(13, 16, 0.04), seg=64, per=12))
    for s in (1, -1):
        P.append(ellipsoid(f"brow{s}", [2.4, 9.05, s * 0.44], [0.55, 0.16, 0.26], lambda u, a, p: D0, rot=[0, 0, -0.25]))
        P.append(ellipsoid(f"eye{s}", [2.58, 8.85, s * 0.5], [0.16, 0.16, 0.1], lambda u, a, p: mix(C("#e9c24e"), DARK, smooth(0.04, 0.08, np.linalg.norm(p - np.array([2.62, 8.85, s * 0.58]), axis=1)) * 0 + (np.linalg.norm(p[:, [0, 1]] - np.array([2.66, 8.85]), axis=1) < 0.07)), gloss=1))
    beak = lambda u, a, p: mix(BEAK, C("#f3dc9a"), np.sin(a) * 0.5 + 0.2)
    P.append(loft("beak", [[2.5, 8.7, 0, 0.42, 0.44], [3.2, 8.65, 0, 0.4, 0.42], [3.85, 8.4, 0, 0.3, 0.32], [4.1, 7.95, 0, 0.17, 0.2], [4.05, 7.55, 0, 0.06, 0.07]], beak, seg=24))
    P.append(loft("jawb", [[2.6, 8.3, 0, 0.34, 0.16], [3.2, 8.2, 0, 0.3, 0.13], [3.7, 8.1, 0, 0.12, 0.07]], lambda u, a, p: BEAK, seg=16, min_thick=0.07))

    # wings: the arm part is one surface with covert rows; the hand ends in 7 separate
    # primaries that fan out (photo: clear gaps between the long dark feathers)
    def wing_paint(u, a, p):
        base = feathers(9, 10, D2)(u, a, p)
        trail = np.clip(np.cos(a) * 0.9 + 0.35, 0, 1)
        return mix(base, mix(DARK, SLATE_L, 0.5), trail * (0.25 + 0.75 * u))

    def wing_relief(u, a, p):
        lead = smooth(-0.2, 0.6, -np.cos(a))  # coverts near the leading edge
        fr, fx, edge = scallop(u, a, 9, 10)
        sec = 0.5 + 0.5 * np.cos((np.cos(a) * 0.5 + 0.5) * 9 * np.pi)  # secondaries along the trailing half
        return 0.07 * lead * (smooth(0.0, 0.9, fr) - 0.5) + 0.06 * (1 - lead) * sec

    def feather_paint(u, a, p):
        rib = np.exp(-(np.sin(a) / 0.25) ** 2)
        return mix(mix(D1, SLATE, 0.6), mix(DARK, SLATE_L, 0.4 + 0.6 * rib), smooth(0.1, 0.6, u))

    for s in (1, -1):
        st = [[0.5, 6.1, s * 1.2, 1.3, 0.5], [-0.2, 7.6, s * 2.5, 2.1, 0.42], [-1.1, 9.5, s * 3.6, 2.5, 0.3], [-2.0, 11.0, s * 4.25, 2.3, 0.22], [-2.7, 12.0, s * 4.6, 1.7, 0.16]]
        w = loft(f"wing{s}", st, wing_paint, wing_relief, seg=64, per=12, ref=(-0.75, -0.6, s * 0.15), flat=True, min_thick=0.09)
        P.append(w)
        sp = w.spine
        # primaries: rooted along the outer hand, fanning from up-and-back to back
        for k in range(7):
            f = k / 6
            j = int((0.62 + 0.36 * f) * (len(sp["P"]) - 1))
            root = sp["P"][j] + sp["S"][j] * sp["a"][j] * (0.55 - 0.9 * f)
            T = sp["P"][min(j + 1, len(sp["P"]) - 1)] - sp["P"][max(j - 1, 0)]
            T /= np.linalg.norm(T)
            d = T * (1 - f) * 0.85 + sp["S"][j] * (0.25 + 0.75 * f)
            d /= np.linalg.norm(d)
            L = 3.6 - 1.4 * abs(f - 0.35)
            stn = [[*(root + d * L * t), w_, 0.08] for t, w_ in ((0.0, 0.38), (0.35, 0.42), (0.7, 0.34), (0.92, 0.2), (1.0, 0.06))]
            # flat feathers: width along the wing's chord normal (U x d)
            ref = np.cross(d, sp["U"][j])
            P.append(loft(f"prim{s}{k}", stn, feather_paint, lambda u, a, p: 0.03 * np.exp(-(np.sin(a) / 0.3) ** 2), seg=20, per=6, ref=tuple(ref), flat=True, min_thick=0.075))

    tail = lambda u, a, p: mix(mix(D0, SLATE, 0.5 + 0.5 * np.sin(np.cos(a) * 16)), D1, 0.25)
    P.append(loft("tail", [[-1.0, 2.8, 0, 1.2, 0.5], [-2.4, 1.6, 0, 1.75, 0.34], [-3.9, 0.0, 0, 1.95, 0.24], [-5.2, -1.4, 0, 1.7, 0.16], [-5.7, -1.9, 0, 0.6, 0.1]], tail,
                  lambda u, a, p: 0.05 * np.abs(np.sin(np.cos(a) * 6 * np.pi / 2)) * u, seg=48, flat=True, min_thick=0.08))
    for z in (0.95, -0.95):
        P.append(loft(f"leg{z}", [[0.2, 3.3, z, 0.95, 0.9], [0.45, 2.0, z, 0.72, 0.68], [0.6, 1.0, z, 0.38, 0.38], [0.7, 0.35, z, 0.3, 0.3]], feathers(5, 9, SLATE_L), feather_relief(5, 9, 0.05), seg=32))
        P.append(ellipsoid(f"foot{z}", [0.9, 0.3, z], [0.5, 0.28, 0.5], lambda u, a, p: FOOT))
        for dz in (-0.4, 0, 0.4):
            P.append(loft(f"toe{z}{dz}", [[0.9, 0.32, z + dz * 0.5, 0.17, 0.16], [1.6, 0.34, z + dz, 0.16, 0.15], [2.1, 0.2, z + dz * 1.2, 0.12, 0.11]], lambda u, a, p: FOOT, seg=12, per=4,
                          relief=lambda u, a, p: 0.02 * np.sin(u * 40)))
            P.append(cone(f"claw{z}{dz}", [2.1, 0.22, z + dz * 1.2], [1, -0.9, 0], 0.12, 0.45, lambda u, a, p: DARK, gloss=1))
    # move the whole bird so it sits where the old one did (mesh offset 2.0 in mascots.jsx)
    return P


# =================================================================================================
# ELEPHANT — nest_首场_0004: dark grey, wrinkled printed skin, big ears with folds, trunk curled
# up and back, long pale tusks curving forward, pale toenails, long thin tail with a tuft.
# =================================================================================================
def elephant_parts():
    GREY, GREY_D, GREY_L, IVORY, EAR_IN, DARK = C("#5a5d62"), C("#3a3d42"), C("#74777c"), C("#efe6d6"), C("#6f6466"), C("#15151a")

    def hide(u, a, p):
        n = fbm(p, 0.8, 3, 61)
        cr = 1 - smooth(0.0, 0.06, np.abs(fbm(p, 1.6, 2, 63) - 0.5))
        return mix(mix(mix(GREY, GREY_L, -np.sin(a) * 0.5), GREY_D, 0.35 * n), GREY_D * 0.85, cr * 0.22)

    def hide_relief(u, a, p):
        cr = 1 - smooth(0.0, 0.06, np.abs(fbm(p, 1.6, 2, 63) - 0.5))
        return 0.03 * (fbm(p, 1.2, 2, 65) - 0.5) - 0.018 * cr - 0.012 * np.sin(p[:, 1] * 9 + 2 * fbm(p, 0.6, 1, 66))

    def leg_relief(u, a, p):
        # wrinkle rings round the knees and ankles
        rings = np.exp(-((u - 0.45) / 0.12) ** 2) + np.exp(-((u - 0.85) / 0.07) ** 2)
        return hide_relief(u, a, p) - 0.05 * rings * (0.5 + 0.5 * np.sin(u * 90))

    def trunk(u, a, p):
        c = hide(u, a, p)
        return mix(c, GREY_D, np.where(u > 0.3, 0.35 * (0.5 + 0.5 * np.sin(u * 170)), 0))

    def trunk_relief(u, a, p):
        return np.where(u > 0.28, -0.05 * (0.5 + 0.5 * np.sin(u * 170)) * smooth(0.28, 0.4, u), 0) + hide_relief(u, a, p) * (1 - smooth(0.3, 0.4, u))

    P = []
    P.append(loft("body", [[-5.4, 6.0, 0, 0.6, 0.7], [-4.6, 6.3, 0, 2.3, 2.5], [-2.4, 6.9, 0, 3.0, 3.1], [0.2, 6.7, 0, 3.05, 3.05], [2.4, 6.6, 0, 2.7, 2.8], [3.9, 7.0, 0, 1.9, 2.1]], hide, hide_relief, seg=64, per=12))
    P.append(loft("head", [[3.1, 7.6, 0, 1.9, 2.0], [4.5, 8.0, 0, 2.05, 2.25], [5.7, 7.5, 0, 1.6, 1.8], [6.5, 6.5, 0, 0.92, 0.98], [7.5, 5.2, 0, 0.72, 0.75], [8.8, 4.8, 0, 0.6, 0.62], [9.9, 5.6, 0, 0.52, 0.52], [10.3, 7.1, 0, 0.44, 0.44], [9.8, 8.4, 0, 0.38, 0.38], [9.0, 8.8, 0, 0.3, 0.3]],
                  trunk, trunk_relief, seg=48, per=14))
    # forehead dome and the open mouth under the trunk
    P.append(ellipsoid("dome", [4.7, 8.9, 0], [1.4, 1.1, 1.5], hide, relief=lambda u, a, p: hide_relief(u, a, p)))
    P.append(with_op(ellipsoid("mouth", [6.15, 6.05, 0], [0.75, 0.35, 0.55], lambda u, a, p: C("#5a3a40"), rot=[0, 0, -0.3]), "cut"))

    def ear_paint(s):
        def f(u, a, p):
            q = p - np.array([3.5, 7.5, s * 2.55])
            fold = 0.5 + 0.5 * np.sin(np.hypot(q[:, 0], q[:, 1]) * 3.2 + np.arctan2(q[:, 1], q[:, 0]) * 2)
            return mix(mix(GREY, EAR_IN, 0.35 + 0.4 * fold), GREY_D, 0.3 * fbm(p, 1.0, 2, 67))
        return f

    def ear_relief(s):
        def f(u, a, p):
            q = p - np.array([3.5, 7.5, s * 2.55])
            r = np.hypot(q[:, 0], q[:, 1])
            return 0.09 * np.sin(r * 3.2 + np.arctan2(q[:, 1], q[:, 0]) * 2) * smooth(0.6, 1.6, r) + 0.03 * (fbm(p, 1.5, 2, 69) - 0.5)
        return f

    for s in (1, -1):
        P.append(ellipsoid(f"ear{s}", [3.5, 7.5, s * 2.55], [2.0, 2.9, 0.3], ear_paint(s), rot=[s * 0.3, s * 0.55, 0.15], relief=ear_relief(s), n=40))
        P.append(loft(f"tusk{s}", [[5.5, 6.2, s * 0.95, 0.32, 0.32], [6.9, 5.2, s * 1.25, 0.26, 0.26], [8.2, 5.3, s * 1.35, 0.17, 0.17], [8.9, 5.9, s * 1.3, 0.06, 0.06]], lambda u, a, p: mix(IVORY, C("#d8ccb4"), 1 - u), seg=16))
        P.append(ellipsoid(f"eye{s}", [5.5, 8.5, s * 1.72], [0.19, 0.16, 0.12], lambda u, a, p: DARK, gloss=1))
    for nm, x, z in (("legFL", 3.1, 1.6), ("legFR", 3.1, -1.6), ("legBL", -3.4, 1.6), ("legBR", -3.4, -1.6)):
        P.append(loft(nm, [[x, 5.2, z, 1.25, 1.35], [x, 3.4, z, 1.1, 1.15], [x, 1.6, z, 1.02, 1.05], [x, 0.25, z, 1.18, 1.2]], hide, leg_relief, seg=40, per=10))
        for dz in (-0.55, 0, 0.55):
            P.append(ellipsoid(nm + f"nail{dz}", [x + 1.05 - abs(dz) * 0.25, 0.3, z + dz], [0.24, 0.27, 0.27], lambda u, a, p: IVORY, gloss=1))
    P.append(loft("tail", [[-5.3, 6.6, 0, 0.22, 0.22], [-6.2, 5.4, 0, 0.17, 0.17], [-6.5, 3.4, 0, 0.14, 0.14]], lambda u, a, p: GREY_D, seg=12, min_thick=0.12))
    P.append(ellipsoid("tuft", [-6.5, 3.0, 0], [0.24, 0.48, 0.24], lambda u, a, p: DARK))
    return P


ANIMALS = {
    # name: (parts, voxel size m, smoothing iterations, low-poly triangles, atlas tile (col,row))
    "lion": (lion_parts, 0.045, 4, 5500, (0, 0)),
    "eagle": (eagle_parts, 0.035, 3, 5500, (1, 0)),
    "elephant": (elephant_parts, 0.05, 4, 4000, (0, 1)),
}


# =================================================================================================
# Blender side
# =================================================================================================
def mesh_object(name, V, F, coll=None):
    me = bpy.data.meshes.new(name)
    me.from_pydata(to_bl(V).tolist(), [], [tuple(int(i) for i in f) for f in F])
    me.validate()
    ob = bpy.data.objects.new(name, me)
    (coll or bpy.context.scene.collection).objects.link(ob)
    return ob


def get_coll(name, hide=False):
    c = bpy.data.collections.get(name) or bpy.data.collections.new(name)
    if c.name not in bpy.context.scene.collection.children:
        bpy.context.scene.collection.children.link(c)
    c.hide_render = hide
    return c


def activate(ob):
    bpy.ops.object.select_all(action="DESELECT")
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob


def apply_mods(ob):
    activate(ob)
    for m in list(ob.modifiers):
        bpy.ops.object.modifier_apply(modifier=m.name)


def verts_np(me):
    a = np.empty(len(me.vertices) * 3)
    me.vertices.foreach_get("co", a)
    return a.reshape(-1, 3)


def normals_np(me):
    a = np.empty(len(me.vertices) * 3)
    me.vertices.foreach_get("normal", a)
    return a.reshape(-1, 3)


def edges_np(me):
    a = np.empty(len(me.edges) * 2, dtype=np.int64)
    me.edges.foreach_get("vertices", a)
    return a.reshape(-1, 2)


def laplace(field, E, n, it, w=0.5):
    deg = np.bincount(E.ravel(), minlength=n).astype(np.float64)
    deg[deg == 0] = 1
    f = field.astype(np.float64)
    for _ in range(it):
        if f.ndim == 1:
            s = np.bincount(E[:, 0], f[E[:, 1]], n) + np.bincount(E[:, 1], f[E[:, 0]], n)
        else:
            s = np.stack([np.bincount(E[:, 0], f[E[:, 1], k], n) + np.bincount(E[:, 1], f[E[:, 0], k], n) for k in range(f.shape[1])], 1)
        f = f * (1 - w) + (s / (deg if f.ndim == 1 else deg[:, None])) * w
    return f


def build_animal(name):
    make, voxel, smooth_it, tris, tile = ANIMALS[name]
    parts = make()
    log(name, "parts", len(parts))
    src = get_coll("source", hide=True)
    hi_c = get_coll("sculpt", hide=True)
    # 1-2. one skin
    def joined(ps):
        Vs, Fs, off = [], [], 0
        for p in ps:
            Vs.append(p.V)
            Fs += [tuple(i + off for i in f) for f in p.F]
            off += len(p.V)
        return np.vstack(Vs), Fs

    def remesh(ob, it):
        m = ob.modifiers.new("remesh", "REMESH")
        m.mode, m.voxel_size, m.use_smooth_shade = "VOXEL", voxel, True
        sm = ob.modifiers.new("smooth", "SMOOTH")
        sm.factor, sm.iterations = 0.6, it
        apply_mods(ob)

    adds, cuts, lates = [p for p in parts if p.op == "add"], [p for p in parts if p.op == "cut"], [p for p in parts if p.op == "late"]
    allV, Fs = joined(parts)
    srcob = mesh_object(f"{name}_parts", allV, Fs, src)
    hi = mesh_object(f"{name}_sculpt", *joined(adds), hi_c)
    remesh(hi, smooth_it)
    if cuts:
        cutter = mesh_object(f"{name}_cut", *joined(cuts), hi_c)
        b = hi.modifiers.new("cut", "BOOLEAN")
        b.operation, b.object, b.solver = "DIFFERENCE", cutter, "MANIFOLD"
        apply_mods(hi)
        bpy.data.meshes.remove(cutter.data)
    if lates:
        late = mesh_object(f"{name}_late", *joined(lates), hi_c)
        activate(hi)
        late.select_set(True)
        bpy.ops.object.join()
    if cuts or lates:
        remesh(hi, 2)
    # keep a live (unapplied) remesh on the source parts for reference in the .blend
    m2 = srcob.modifiers.new("remesh", "REMESH")
    m2.mode, m2.voxel_size = "VOXEL", voxel * 3
    me = hi.data
    X = from_bl(verts_np(me))
    N = from_bl(normals_np(me))
    E = edges_np(me)
    n = len(X)
    log(name, "skin verts", n)
    # 3. which part is each skin vertex nearest to
    samples = [sample_surface(p.V, p.F, 0.06) for p in parts]
    owner = np.concatenate([np.full(len(s), i) for i, s in enumerate(samples)])
    allS = np.vstack(samples)
    kd = kdtree.KDTree(len(allS))
    for i, v in enumerate(allS):
        kd.insert(v, i)
    kd.balance()
    near = np.array([kd.find(v)[1] for v in X])
    pid = owner[near]
    relief = np.zeros(n)
    col = np.zeros((n, 3))
    gloss = np.zeros(n)
    for i, p in enumerate(parts):
        sel = np.where(pid == i)[0]
        if not len(sel):
            continue
        Xs = X[sel]
        if p.kind == "loft":
            u, a, _ = loft_coords(p, Xs)
        else:
            u, a = Z(len(sel)), Z(len(sel))
        if p.relief is not None:
            relief[sel] = p.relief(u, a, Xs)
        c = p.paint(u, a, Xs)
        col[sel] = np.broadcast_to(c, (len(sel), 3))
        gloss[sel] = p.gloss or 0
    relief = laplace(relief, E, n, 3)
    col = laplace(col, E, n, 1, 0.35)
    X2 = X + N * relief[:, None]
    me.vertices.foreach_set("co", to_bl(X2).ravel())
    me.update()
    # cavity: darken creases a little more than the AO bake alone would (printed shading)
    attr = me.color_attributes.new("paint", "FLOAT_COLOR", "POINT")
    rgba = np.concatenate([col, gloss[:, None]], 1)
    attr.data.foreach_set("color", rgba.ravel())
    # 4. low poly
    lo = bpy.data.objects.new(f"{name}", me.copy())
    get_coll("export").objects.link(lo)
    lo.data.color_attributes.remove(lo.data.color_attributes["paint"])
    d = lo.modifiers.new("decimate", "DECIMATE")
    d.ratio = min(1.0, tris / (len(me.polygons) * 2))
    d.use_collapse_triangulate = True
    apply_mods(lo)
    tri = lo.modifiers.new("tri", "TRIANGULATE")
    apply_mods(lo)
    for poly in lo.data.polygons:
        poly.use_smooth = True
    # unwrap a heavily smoothed copy (same topology): the decimated sculpt is bumpy, and
    # unwrapping it directly cuts it into hundreds of small islands = many seam vertices
    tmp = bpy.data.objects.new("uvtmp", lo.data.copy())
    get_coll("export").objects.link(tmp)
    sm = tmp.modifiers.new("smooth", "SMOOTH")
    sm.factor, sm.iterations = 1.0, 40
    apply_mods(tmp)
    activate(tmp)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(72), island_margin=0.004, area_weight=0.0)
    bpy.ops.uv.pack_islands(margin=0.003, rotate=True)
    bpy.ops.object.mode_set(mode="OBJECT")
    a = np.empty(len(tmp.data.loops) * 2)
    tmp.data.uv_layers.active.data.foreach_get("uv", a)
    bpy.data.meshes.remove(tmp.data)
    if not lo.data.uv_layers:
        lo.data.uv_layers.new(name="UVMap")
    lo.data.uv_layers.active.data.foreach_set("uv", a)
    uv = lo.data.uv_layers.active.data
    a = np.empty(len(uv) * 2)
    uv.foreach_get("uv", a)
    a = a.reshape(-1, 2)
    pad = 6 / ATLAS
    a = (a * (0.5 - 2 * pad) + pad + np.array(tile) * 0.5)
    uv.foreach_set("uv", a.ravel())
    log(name, "low tris", len(lo.data.polygons), "verts", len(lo.data.vertices))
    return hi, lo


def setup_bake_scene():
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.samples = 16
    if not sc.world:
        sc.world = bpy.data.worlds.new("world")
    sc.world.light_settings.distance = 1.2
    b = sc.render.bake
    b.use_selected_to_active = True
    b.use_clear = False
    b.margin = 6
    b.margin_type = "EXTEND"
    return sc


def img(name, float_=True):
    im = bpy.data.images.get(name)
    if im:
        bpy.data.images.remove(im)
    im = bpy.data.images.new(name, ATLAS, ATLAS, alpha=False, float_buffer=float_)
    im.colorspace_settings.name = "Non-Color"
    im.generated_color = (0, 0, 0, 1)
    return im


def sculpt_material():
    mat = bpy.data.materials.get("sculpt_paint") or bpy.data.materials.new("sculpt_paint")
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    at = nt.nodes.new("ShaderNodeAttribute")
    at.attribute_name = "paint"
    em = nt.nodes.new("ShaderNodeEmission")
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    nt.links.new(at.outputs["Color"], em.inputs["Color"])
    nt.links.new(em.outputs[0], out.inputs["Surface"])
    return mat


def atlas_material(color_im, normal_im):
    """Material on the low-poly animals: the baked atlas (also used for previews and by the exporter)."""
    mat = bpy.data.materials.get("mascot_atlas") or bpy.data.materials.new("mascot_atlas")
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bs = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bs.inputs["Roughness"].default_value = 0.6
    tc = nt.nodes.new("ShaderNodeTexImage")
    tc.name = "color"
    tc.image = color_im
    tn = nt.nodes.new("ShaderNodeTexImage")
    tn.name = "normal"
    tn.image = normal_im
    nm = nt.nodes.new("ShaderNodeNormalMap")
    nt.links.new(tc.outputs["Color"], bs.inputs["Base Color"])
    nt.links.new(tn.outputs["Color"], nm.inputs["Color"])
    nt.links.new(nm.outputs["Normal"], bs.inputs["Normal"])
    nt.links.new(bs.outputs[0], out.inputs["Surface"])
    target = nt.nodes.new("ShaderNodeTexImage")
    target.name = "bake_target"
    nt.nodes.active = target
    return mat


def bake(sc, pairs, kind, image):
    for hi, lo in pairs:
        lo.active_material.node_tree.nodes["bake_target"].image = image
        lo.active_material.node_tree.nodes.active = lo.active_material.node_tree.nodes["bake_target"]
        bpy.ops.object.select_all(action="DESELECT")
        hi.hide_set(False)
        hi.hide_render = False
        hi.select_set(True)
        lo.select_set(True)
        bpy.context.view_layer.objects.active = lo
        sc.cycles.samples = 64 if kind == "AO" else 4
        kw = dict(type=kind, margin=6, use_selected_to_active=True, cage_extrusion=0.4, max_ray_distance=0.9, use_clear=False)
        if kind == "NORMAL":
            # object space, swizzled to the app's y-up frame: no tangents to disagree about
            # (Blender bakes MikkTSpace tangents, three derives its own from screen derivatives)
            kw.update(normal_space="OBJECT", normal_r="POS_X", normal_g="POS_Z", normal_b="NEG_Y")
        bpy.ops.object.bake(**kw)
        log("baked", kind, lo.name)


def pixels(im):
    a = np.empty(ATLAS * ATLAS * 4, dtype=np.float32)
    im.pixels.foreach_get(a)
    return a.reshape(ATLAS, ATLAS, 4)


def save(name, rgb, path):
    im = bpy.data.images.get(name) or bpy.data.images.new(name, ATLAS, ATLAS, alpha=False)
    im.colorspace_settings.name = "Non-Color"
    rgba = np.concatenate([np.clip(rgb, 0, 1), np.ones((ATLAS, ATLAS, 1))], 2).astype(np.float32)
    im.pixels.foreach_set(rgba.ravel())
    im.filepath_raw = path
    im.file_format = "PNG"
    im.save()
    im.filepath = path
    return im


def render_preview(objs, cam_pos, target, out, size=640, lens=40):
    sc = bpy.context.scene
    for ob in bpy.data.objects:
        if ob.type == "MESH":
            ob.hide_render = ob not in objs
    cam = bpy.data.objects.get("pcam") or bpy.data.objects.new("pcam", bpy.data.cameras.new("pcam"))
    if cam.name not in sc.collection.objects:
        sc.collection.objects.link(cam)
    cam.data.lens = lens
    from mathutils import Vector
    p = Vector(to_bl([cam_pos])[0])
    t = Vector(to_bl([target])[0])
    cam.location = p
    cam.rotation_euler = (t - p).to_track_quat("-Z", "Y").to_euler()
    sc.camera = cam
    for nm, loc, e in (("key", (20, 25, 30), 2.2), ("fill", (-25, -10, 15), 0.8)):
        L = bpy.data.objects.get(nm) or bpy.data.objects.new(nm, bpy.data.lights.new(nm, "SUN"))
        if L.name not in sc.collection.objects:
            sc.collection.objects.link(L)
        L.data.energy = e
        L.rotation_euler = (Vector((0, 0, 0)) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    sc.world.use_nodes = True
    sc.world.node_tree.nodes["Background"].inputs[0].default_value = (0.05, 0.06, 0.08, 1)
    sc.render.resolution_x = sc.render.resolution_y = size
    sc.cycles.samples = 24
    sc.render.filepath = out
    sc.render.image_settings.file_format = "PNG"
    bpy.ops.render.render(write_still=True)
    log("preview", out)


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = setup_bake_scene()
    names = ONLY or list(ANIMALS)
    pairs = []
    for nm in names:
        pairs.append(build_animal(nm))
    smat = sculpt_material()
    im_col, im_ao, im_nrm = img("bake_color"), img("bake_ao"), img("bake_normal")
    # normal bake background = flat normal
    a = np.zeros((ATLAS, ATLAS, 4), np.float32)
    a[..., :] = (0.5, 1.0, 0.5, 1)  # background: +y (object space)
    im_nrm.pixels.foreach_set(a.ravel())
    for hi, lo in pairs:
        hi.data.materials.clear()
        hi.data.materials.append(smat)
        lo.data.materials.clear()
        lo.data.materials.append(atlas_material(None, None))
    bake(sc, pairs, "EMIT", im_col)
    bake(sc, pairs, "AO", im_ao)
    bake(sc, pairs, "NORMAL", im_nrm)
    col = pixels(im_col)[..., :3]
    ao = pixels(im_ao)[..., :1]
    # AO in, at 70 %: the show light is mostly frontal and soft, so creases should read
    col = col * (0.3 + 0.7 * ao)
    color_png = save("mascots_color", lin_to_srgb(col), os.path.join(TEX, "mascots_color.png"))
    normal_png = save("mascots_normal", pixels(im_nrm)[..., :3], os.path.join(TEX, "mascots_normal.png"))
    mat = atlas_material(color_png, normal_png)
    for hi, lo in pairs:
        lo.data.materials.clear()
        lo.data.materials.append(mat)
    for im in (im_col, im_ao, im_nrm):
        bpy.data.images.remove(im)
    if PREVIEW:
        prev = os.path.join(HERE, "preview")
        os.makedirs(prev, exist_ok=True)
        # front views roughly from where the photos were taken, plus a three-quarter view
        views = {"lion": [([24, 6, 3], [2, 6.0, 0]), ([16, 9, 16], [1, 5.5, 0])], "eagle": [([16, 7, 9], [0, 6.5, 0]), ([-4, 10, 18], [-1, 7, 0])], "elephant": [([8, 7, 24], [1, 6, 0]), ([22, 6, 8], [3, 6, 0])]}
        bpy.data.collections["sculpt"].hide_render = False
        for hi, lo in pairs:
            nm = lo.name
            for k, (cp, tg) in enumerate(views[nm]):
                render_preview([lo], cp, tg, os.path.join(prev, f"{nm}_low{k}.png"))
                if "--sculpt" in ARGS and k == 0:
                    render_preview([hi], cp, tg, os.path.join(prev, f"{nm}_sculpt.png"))
    # the sculpts are rebuilt by this script; do not store 100k+ vertex meshes in the .blend
    for hi, lo in pairs:
        bpy.data.meshes.remove(hi.data)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, "mascots.blend"), compress=True)
    log("saved mascots.blend")


main()
