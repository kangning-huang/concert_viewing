# Shared helpers for build_mascots.py (run inside Blender: numpy + bpy available).
# All modelling is done in the app's frame (x forward/head, y up, z left-right, metres before the
# 0.6 scale the stage kit applies) so the numbers below can be read against src/stage/mascots.jsx.
# Blender is z-up: to_bl() / from_bl() convert at the boundary.
import math
import numpy as np

# ---- colour ------------------------------------------------------------------------------------
def srgb_to_lin(c):
    c = np.asarray(c, dtype=np.float64)
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def lin_to_srgb(c):
    c = np.clip(np.asarray(c, dtype=np.float64), 0, 1)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - 0.055)


def C(h):
    """'#rrggbb' -> linear RGB (same convention as THREE.Color('#rrggbb'))."""
    h = h.lstrip("#")
    return srgb_to_lin([int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)])


def mix(a, b, t):
    t = np.clip(np.asarray(t, dtype=np.float64), 0, 1)
    if t.ndim:
        t = t[:, None]
    return a + (b - a) * t


def smooth(e0, e1, x):
    t = np.clip((np.asarray(x, dtype=np.float64) - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


# ---- noise -------------------------------------------------------------------------------------
def _hash3(ix, iy, iz, seed):
    h = (ix * 73856093) ^ (iy * 19349663) ^ (iz * 83492791) ^ (seed * 2654435761)
    h = (h ^ (h >> 13)) * 1274126177
    h = h ^ (h >> 16)
    return (h & 0xFFFFFF) / float(0xFFFFFF)


def vnoise(P, freq=1.0, seed=0):
    """Smooth value noise in [0,1] at points P (n,3)."""
    Q = np.asarray(P, dtype=np.float64) * freq
    I = np.floor(Q).astype(np.int64)
    F = Q - I
    S = F * F * (3 - 2 * F)
    out = 0.0
    for dx in (0, 1):
        for dy in (0, 1):
            for dz in (0, 1):
                w = (S[:, 0] if dx else 1 - S[:, 0]) * (S[:, 1] if dy else 1 - S[:, 1]) * (S[:, 2] if dz else 1 - S[:, 2])
                out = out + w * _hash3(I[:, 0] + dx, I[:, 1] + dy, I[:, 2] + dz, seed)
    return out


def fbm(P, freq=1.0, octaves=3, seed=0):
    tot, amp, norm = 0.0, 1.0, 0.0
    for o in range(octaves):
        tot = tot + amp * vnoise(P, freq * (2 ** o), seed + o * 7)
        norm += amp
        amp *= 0.5
    return tot / norm


# ---- spline ------------------------------------------------------------------------------------
def catmull(pts, n_per):
    """Centripetal Catmull-Rom through pts (k,d); returns samples (m,d) and parameter u in [0,1]."""
    pts = np.asarray(pts, dtype=np.float64)
    P = np.vstack([2 * pts[0] - pts[1], pts, 2 * pts[-1] - pts[-2]])
    out = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        # parametrise on the geometric part only (first 3 coords) for centripetal knots
        d = lambda a, b: max(1e-4, np.linalg.norm((b - a)[:3]) ** 0.5)
        t0, t1 = 0.0, d(p0, p1)
        t2 = t1 + d(p1, p2)
        t3 = t2 + d(p2, p3)
        last = i == len(P) - 3
        for k in range(n_per + (1 if last else 0)):
            t = t1 + (t2 - t1) * k / n_per
            a1 = (t1 - t) / (t1 - t0) * p0 + (t - t0) / (t1 - t0) * p1
            a2 = (t2 - t) / (t2 - t1) * p1 + (t - t1) / (t2 - t1) * p2
            a3 = (t3 - t) / (t3 - t2) * p2 + (t - t2) / (t3 - t2) * p3
            b1 = (t2 - t) / (t2 - t0) * a1 + (t - t0) / (t2 - t0) * a2
            b2 = (t3 - t) / (t3 - t1) * a2 + (t - t1) / (t3 - t1) * a3
            out.append((t2 - t) / (t2 - t1) * b1 + (t - t1) / (t2 - t1) * b2)
    out = np.array(out)
    return out, np.linspace(0, 1, len(out))


# ---- parts ------------------------------------------------------------------------------------
class Part:
    """A closed surface plus what is needed to paint and sculpt the merged skin near it.
    kind 'loft': spine samples (P, S, U, a, b, u) let any nearby point be mapped back to
    (u along the spine, angle round the section) analytically."""

    def __init__(self, name, V, F, paint, relief=None, kind="solid", spine=None, gloss=None, op="add"):
        # op: "add" = part of the first union, "cut" = carved out of it (mouths),
        # "late" = joined after the carve (teeth and tongue inside a mouth)
        self.op = op
        self.name, self.V, self.F, self.paint, self.relief, self.kind, self.spine = name, np.asarray(V, dtype=np.float64), [tuple(f) for f in F], paint, relief, kind, spine
        # gloss: 0 = default roughness from the material; 1 = shiny (teeth, eyes, nose, claws)
        self.gloss = gloss


def loft(name, stations, paint, relief=None, seg=48, per=10, ref=(0, 0, 1), flat=False, min_thick=0.0):
    st = np.asarray(stations, dtype=np.float64)
    smp, u = catmull(st, per)
    P, ab = smp[:, :3], np.maximum(smp[:, 3:5], 0.001)
    if min_thick:
        ab = np.maximum(ab, min_thick)
    T = np.gradient(P, axis=0)
    T /= np.linalg.norm(T, axis=1, keepdims=True)
    R = np.asarray(ref, dtype=np.float64)
    R = R / np.linalg.norm(R)
    S = R[None, :] - (T @ R)[:, None] * T
    S /= np.linalg.norm(S, axis=1, keepdims=True)
    U = np.cross(S, T)
    U /= np.linalg.norm(U, axis=1, keepdims=True)
    k = np.arange(seg)
    t = k / seg
    if flat:
        ang = np.where(t < 0.5, -np.arccos(np.clip(4 * t - 1, -1, 1)), np.arccos(np.clip(3 - 4 * t, -1, 1)))
    else:
        ang = t * 2 * np.pi - np.pi
    cs, sn = np.cos(ang), np.sin(ang)
    V = P[:, None, :] + S[:, None, :] * (ab[:, 0:1, None] * cs[None, :, None]) + U[:, None, :] * (ab[:, 1:2, None] * sn[None, :, None])
    n = len(P)
    V = V.reshape(-1, 3)
    F = []
    for i in range(n - 1):
        for j in range(seg):
            a, b = i * seg + j, i * seg + (j + 1) % seg
            F.append((a, b, b + seg, a + seg))
    # caps: poles slightly beyond the ends so the remesh closes them round
    p0 = len(V)
    V = np.vstack([V, P[0] - T[0] * min(ab[0]) * 0.5, P[-1] + T[-1] * min(ab[-1]) * 0.5])
    for j in range(seg):
        F.append((p0, (j + 1) % seg, j))
        F.append((p0 + 1, (n - 1) * seg + j, (n - 1) * seg + (j + 1) % seg))
    spine = dict(P=P, S=S, U=U, a=ab[:, 0], b=ab[:, 1], u=u)
    return Part(name, V, F, paint, relief, "loft", spine)


def ellipsoid(name, c, s, paint, rot=None, relief=None, n=24, gloss=None):
    s = np.broadcast_to(np.asarray(s, dtype=np.float64), (3,))
    lat = np.linspace(-np.pi / 2, np.pi / 2, n // 2 + 1)[1:-1]
    lon = np.linspace(0, 2 * np.pi, n, endpoint=False)
    V = [(0, -1, 0)]
    for la in lat:
        for lo in lon:
            V.append((math.cos(la) * math.cos(lo), math.sin(la), math.cos(la) * math.sin(lo)))
    V.append((0, 1, 0))
    V = np.array(V) * s
    if rot is not None:
        V = V @ euler(rot).T
    V = V + np.asarray(c)
    F, m = [], len(lat)
    for j in range(n):
        F.append((0, 1 + (j + 1) % n, 1 + j))
    for i in range(m - 1):
        for j in range(n):
            a, b = 1 + i * n + j, 1 + i * n + (j + 1) % n
            F.append((a, b, b + n, a + n))
    top = len(V) - 1
    for j in range(n):
        F.append((top, 1 + (m - 1) * n + j, 1 + (m - 1) * n + (j + 1) % n))
    return Part(name, V, F, paint, relief, "solid", gloss=gloss)


def cone(name, base, direction, r, h, paint, n=12, gloss=None):
    d = np.asarray(direction, dtype=np.float64)
    d /= np.linalg.norm(d)
    a = np.cross(d, [0, 1, 0] if abs(d[1]) < 0.9 else [1, 0, 0])
    a /= np.linalg.norm(a)
    b = np.cross(d, a)
    base = np.asarray(base, dtype=np.float64)
    ring = [base + r * (math.cos(t) * a + math.sin(t) * b) for t in np.linspace(0, 2 * np.pi, n, endpoint=False)]
    V = np.array(ring + [base + d * h, base - d * r * 0.3])
    F = [(i, (i + 1) % n, n) for i in range(n)] + [((i + 1) % n, i, n + 1) for i in range(n)]
    return Part(name, V, F, paint, None, "solid", gloss=gloss)


def box_rock(name, size, centre, paint, relief, round_=False, n=40):
    """Lumpy rock: a rounded box (or squashed sphere) the animal stands on."""
    if round_:
        part = ellipsoid(name, (0, 0, 0), (1, 1, 1), paint, n=n)
        V = part.V.copy()
        lo = V[:, 1] < -0.35
        V[lo, 1] = -0.35 - (V[lo, 1] + 0.35) * 0.1
    else:
        part = ellipsoid(name, (0, 0, 0), (1, 1, 1), paint, n=n)
        V = part.V.copy()
        # superellipsoid-ish: push the sphere out towards a cube
        m = np.max(np.abs(V), axis=1, keepdims=True)
        V = V / m * 0.5
        V = V * 0.72 + (V / np.linalg.norm(V, axis=1, keepdims=True)) * 0.62 * 0.28
    V = V * np.asarray(size) + np.asarray(centre)
    return Part(name, V, part.F, paint, relief, "solid")


def euler(r):
    x, y, z = r
    Rx = np.array([[1, 0, 0], [0, math.cos(x), -math.sin(x)], [0, math.sin(x), math.cos(x)]])
    Ry = np.array([[math.cos(y), 0, math.sin(y)], [0, 1, 0], [-math.sin(y), 0, math.cos(y)]])
    Rz = np.array([[math.cos(z), -math.sin(z), 0], [math.sin(z), math.cos(z), 0], [0, 0, 1]])
    return Rz @ Ry @ Rx  # three.js 'XYZ' order


def translate(part, d):
    part.V = part.V + np.asarray(d)
    if part.spine is not None:
        part.spine["P"] = part.spine["P"] + np.asarray(d)
    return part


# ---- mapping a point on the merged skin back to a loft's (u, angle) ------------------------------
def loft_coords(part, X):
    sp = part.spine
    P = sp["P"]
    # nearest spine sample, refined with the neighbour in between
    d2 = ((X[:, None, :] - P[None, :, :]) ** 2).sum(-1)
    j = np.argmin(d2, axis=1)
    D = X - P[j]
    x = (D * sp["S"][j]).sum(1) / sp["a"][j]
    y = (D * sp["U"][j]).sum(1) / sp["b"][j]
    ang = np.arctan2(y, x)
    rad = np.hypot(x, y)  # 1 = on the original section
    return sp["u"][j], ang, rad


def to_bl(V):
    V = np.asarray(V)
    return np.stack([V[:, 0], -V[:, 2], V[:, 1]], 1)


def from_bl(V):
    V = np.asarray(V)
    return np.stack([V[:, 0], V[:, 2], -V[:, 1]], 1)


def with_op(part, op):
    part.op = op
    return part


def sample_surface(V, F, spacing, rng=np.random.default_rng(7)):
    """Evenly spread points over a part's faces (so big sparse parts and small dense ones
    compete fairly when the skin is matched back to its parts)."""
    tris = []
    for f in F:
        for k in range(1, len(f) - 1):
            tris.append((f[0], f[k], f[k + 1]))
    T = np.asarray(tris)
    A, B, Cc = V[T[:, 0]], V[T[:, 1]], V[T[:, 2]]
    area = 0.5 * np.linalg.norm(np.cross(B - A, Cc - A), axis=1)
    cnt = np.maximum(1, np.ceil(area / spacing ** 2).astype(int))
    idx = np.repeat(np.arange(len(T)), cnt)
    r1, r2 = rng.random(len(idx)), rng.random(len(idx))
    s = np.sqrt(r1)
    w0, w1, w2 = 1 - s, s * (1 - r2), s * r2
    return A[idx] * w0[:, None] + B[idx] * w1[:, None] + Cc[idx] * w2[:, None]
