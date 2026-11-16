# Export the low-poly mascots in mascots.blend to one compact GLB for the app.
#   ~/Applications/Blender.app/Contents/MacOS/Blender --background assets/blender/mascots.blend --python assets/blender/export_mascots.py
# Writes public/stage/joker_xue_2026/mascots.glb (the shared stage kit: identical in every city).
#
# Plain glTF 2.0 binary, no decoder needed:
#   - KHR_mesh_quantization: POSITION as int16 (dequantised by the node's scale/translation),
#     NORMAL as normalised int8, TEXCOORD_0 as normalised uint16; indices uint16.
#   - EXT_texture_webp: the colour and normal atlases are embedded as WebP (1024 x 1024 each,
#     shared by every animal, so the whole kit is one material and one texture pair).
#   - one mesh (= one draw call) per animal, nodes named like the app's mascots.
# Coordinates: the meshes were built in the app frame and converted to Blender z-up; glTF is
# y-up, so (x, y, z)_blender -> (x, z, -y)_gltf returns the app frame exactly.
import os
import sys
import json
import struct
import bpy
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
OUT = os.path.join(ROOT, "public", "stage", "joker_xue_2026", "mascots.glb")
ANIMALS = ["lion", "eagle", "elephant"]
WEBP_Q = {"mascots_color": 82, "mascots_normal": 82}


def webp_bytes(image, quality):
    """Lossy WebP of the image as stored. The atlases are Non-Color images, so save_render
    writes their values unchanged (checked: mean pixel value identical to 5 decimals)."""
    path = os.path.join(bpy.app.tempdir, image.name + ".webp")
    image.colorspace_settings.name = "Non-Color"
    sc = bpy.context.scene
    st = sc.render.image_settings
    st.file_format, st.quality, st.color_mode = "WEBP", quality, "RGB"
    sc.view_settings.view_transform, sc.view_settings.look = "Standard", "None"
    sc.view_settings.exposure, sc.view_settings.gamma = 0, 1
    image.save_render(path, scene=sc)
    with open(path, "rb") as f:
        return f.read()


def mesh_arrays(ob):
    dg = bpy.context.evaluated_depsgraph_get()
    me = ob.evaluated_get(dg).to_mesh()
    me.calc_loop_triangles()
    nl = len(me.loops)
    co = np.empty(len(me.vertices) * 3)
    me.vertices.foreach_get("co", co)
    co = co.reshape(-1, 3)
    lv = np.empty(nl, dtype=np.int64)
    me.loops.foreach_get("vertex_index", lv)
    nrm = np.empty(nl * 3)
    me.corner_normals.foreach_get("vector", nrm)
    nrm = nrm.reshape(-1, 3)
    uv = np.empty(nl * 2)
    me.uv_layers.active.data.foreach_get("uv", uv)
    uv = uv.reshape(-1, 2)
    tl = np.empty(len(me.loop_triangles) * 3, dtype=np.int64)
    me.loop_triangles.foreach_get("loops", tl)
    ob.evaluated_get(dg).to_mesh_clear()
    P = co[lv]
    P = np.stack([P[:, 0], P[:, 2], -P[:, 1]], 1)  # z-up -> y-up
    N = np.stack([nrm[:, 0], nrm[:, 2], -nrm[:, 1]], 1)
    UV = np.stack([uv[:, 0], 1 - uv[:, 1]], 1)  # glTF: v down
    return P, N, UV, tl.reshape(-1, 3)


def quantise(P, N, UV, tris):
    # one scale for all three axes: a non-uniform node scale would also skew the normals
    lo, hi = P.min(0), P.max(0)
    scale = np.full(3, (hi - lo).max() / 65534.0)
    qp = np.round((P - lo) / scale - 32767).astype(np.int16)
    qn = np.round(np.clip(N / np.linalg.norm(N, axis=1, keepdims=True), -1, 1) * 127).astype(np.int8)
    quv = np.round(np.clip(UV, 0, 1) * 65535).astype(np.uint16)
    # weld corners that quantise to the same vertex
    key = np.concatenate([qp.view(np.uint16).astype(np.uint64), qn.view(np.uint8).astype(np.uint64), quv.astype(np.uint64)], 1)
    uniq, inv = np.unique(key, axis=0, return_inverse=True)
    first = np.zeros(len(uniq), dtype=np.int64)
    first[inv[::-1]] = np.arange(len(inv))[::-1]
    idx = inv.reshape(-1)[tris]
    # drop triangles that collapsed in quantisation
    ok = (idx[:, 0] != idx[:, 1]) & (idx[:, 1] != idx[:, 2]) & (idx[:, 0] != idx[:, 2])
    idx = idx[ok]
    offset = lo + 32767 * scale
    return qp[first], qn[first], quv[first], idx.astype(np.uint16 if len(uniq) < 65536 else np.uint32), scale, offset


class Bin:
    def __init__(self):
        self.data = bytearray()
        self.views = []

    def add(self, b, stride=None, target=None):
        while len(self.data) % 4:
            self.data += b"\0"
        v = {"buffer": 0, "byteOffset": len(self.data), "byteLength": len(b)}
        if stride:
            v["byteStride"] = stride
        if target:
            v["target"] = target
        self.data += b
        self.views.append(v)
        return len(self.views) - 1


def pad4(a, n_comp, width):
    """Interleave padding so every vertex element starts on 4 bytes (glTF rule)."""
    stride = ((n_comp * width + 3) // 4) * 4
    out = np.zeros((len(a), stride), dtype=np.uint8)
    out[:, : n_comp * width] = a.view(np.uint8).reshape(len(a), -1)
    return out.tobytes(), stride


def main():
    b = Bin()
    gl = {"asset": {"version": "2.0", "generator": "assets/blender/export_mascots.py"}, "extensionsUsed": ["KHR_mesh_quantization", "EXT_texture_webp"], "extensionsRequired": ["KHR_mesh_quantization", "EXT_texture_webp"],
          "scene": 0, "scenes": [{"nodes": []}], "nodes": [], "meshes": [], "accessors": [], "materials": [], "textures": [], "images": [], "samplers": [{"magFilter": 9729, "minFilter": 9987, "wrapS": 33071, "wrapT": 33071}]}
    mat = bpy.data.materials["mascot_atlas"].node_tree.nodes
    for key in ("color", "normal"):
        im = mat[key].image
        data = webp_bytes(im, WEBP_Q[im.name])
        gl["images"].append({"name": im.name, "mimeType": "image/webp", "bufferView": b.add(data)})
        gl["textures"].append({"sampler": 0, "extensions": {"EXT_texture_webp": {"source": len(gl["images"]) - 1}}})
        print(f"{im.name}: {len(data) / 1024:.1f} KB")
    gl["materials"].append({"name": "mascot_atlas", "pbrMetallicRoughness": {"baseColorTexture": {"index": 0}, "metallicFactor": 0.02, "roughnessFactor": 0.6}, "normalTexture": {"index": 1}, "doubleSided": False})

    def acc(view, ctype, count, typ, normalized=False, mn=None, mx=None):
        a = {"bufferView": view, "componentType": ctype, "count": int(count), "type": typ}
        if normalized:
            a["normalized"] = True
        if mn is not None:
            a["min"], a["max"] = [int(v) for v in mn], [int(v) for v in mx]
        gl["accessors"].append(a)
        return len(gl["accessors"]) - 1

    for name in ANIMALS:
        ob = bpy.data.objects[name]
        P, N, UV, tris = mesh_arrays(ob)
        qp, qn, quv, idx, scale, offset = quantise(P, N, UV, tris)
        pb, ps = pad4(qp, 3, 2)
        nb, ns = pad4(qn, 3, 1)
        a_pos = acc(b.add(pb, ps, 34962), 5122, len(qp), "VEC3", mn=qp.min(0), mx=qp.max(0))
        a_nrm = acc(b.add(nb, ns, 34962), 5120, len(qn), "VEC3", normalized=True)
        a_uv = acc(b.add(quv.tobytes(), None, 34962), 5123, len(quv), "VEC2", normalized=True)
        a_idx = acc(b.add(idx.tobytes(), None, 34963), 5123 if idx.dtype == np.uint16 else 5125, idx.size, "SCALAR")
        gl["meshes"].append({"name": name, "primitives": [{"attributes": {"POSITION": a_pos, "NORMAL": a_nrm, "TEXCOORD_0": a_uv}, "indices": a_idx, "material": 0}]})
        gl["nodes"].append({"name": name, "mesh": len(gl["meshes"]) - 1, "translation": [float(v) for v in offset], "scale": [float(v) for v in scale]})
        gl["scenes"][0]["nodes"].append(len(gl["nodes"]) - 1)
        print(f"{name}: {len(qp)} vertices, {len(idx)} triangles, {(len(pb) + len(nb) + quv.nbytes + idx.nbytes) / 1024:.1f} KB geometry")
    while len(b.data) % 4:
        b.data += b"\0"
    gl["buffers"] = [{"byteLength": len(b.data)}]
    gl["bufferViews"] = b.views
    js = json.dumps(gl, separators=(",", ":")).encode()
    js += b" " * ((4 - len(js) % 4) % 4)
    out = struct.pack("<III", 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(b.data)) + struct.pack("<II", len(js), 0x4E4F534A) + js + struct.pack("<II", len(b.data), 0x004E4942) + bytes(b.data)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "wb") as f:
        f.write(out)
    print(f"wrote {OUT}: {len(out) / 1024:.1f} KB")


main()
