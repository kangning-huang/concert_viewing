// Minimal reader for the GLBs written by assets/blender/export_*.py: plain glTF 2.0 with
// KHR_mesh_quantization (int16 positions, int8 normals, uint16 UVs) and EXT_texture_webp.
// Any glTF viewer opens these files; this reader only covers what our exporters write, so the
// app does not pay for three's full GLTFLoader (~25 KB gzip) to load a handful of meshes.
import * as THREE from "three";

const TYPED = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };
const SIZE = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };

export async function loadGlb(url) {
  const buf = await (await fetch(url)).arrayBuffer();
  const dv = new DataView(buf);
  if (dv.getUint32(0, true) !== 0x46546c67) throw new Error(`${url}: not a GLB`);
  const jsonLen = dv.getUint32(12, true);
  const gl = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 20, jsonLen)));
  const binStart = 20 + jsonLen + 8;
  const view = (i) => gl.bufferViews[i];

  const attribute = (ai) => {
    const a = gl.accessors[ai], v = view(a.bufferView), T = TYPED[a.componentType], n = SIZE[a.type];
    const stride = v.byteStride ?? n * T.BYTES_PER_ELEMENT;
    const arr = new T(buf, binStart + v.byteOffset + (a.byteOffset ?? 0), (a.count * stride) / T.BYTES_PER_ELEMENT);
    if (stride === n * T.BYTES_PER_ELEMENT) return new THREE.BufferAttribute(arr, n, !!a.normalized);
    return new THREE.InterleavedBufferAttribute(new THREE.InterleavedBuffer(arr, stride / T.BYTES_PER_ELEMENT), n, 0, !!a.normalized);
  };

  const textures = await Promise.all(
    (gl.textures ?? []).map(async (t) => {
      const img = gl.images[t.extensions?.EXT_texture_webp?.source ?? t.source], v = view(img.bufferView);
      const bitmap = await createImageBitmap(new Blob([new Uint8Array(buf, binStart + v.byteOffset, v.byteLength)], { type: img.mimeType }));
      return bitmap;
    })
  );

  const meshes = {};
  for (const node of gl.nodes) {
    if (node.mesh === undefined) continue;
    const prim = gl.meshes[node.mesh].primitives[0], g = new THREE.BufferGeometry();
    const names = { POSITION: "position", NORMAL: "normal", TEXCOORD_0: "uv" };
    for (const [k, ai] of Object.entries(prim.attributes)) if (names[k]) g.setAttribute(names[k], attribute(ai));
    const ia = gl.accessors[prim.indices], iv = view(ia.bufferView);
    g.setIndex(new THREE.BufferAttribute(new TYPED[ia.componentType](buf, binStart + iv.byteOffset, ia.count), 1));
    // the node's scale/translation dequantise the int16 positions (KHR_mesh_quantization)
    const matrix = new THREE.Matrix4().compose(new THREE.Vector3(...(node.translation ?? [0, 0, 0])), new THREE.Quaternion(...(node.rotation ?? [0, 0, 0, 1])), new THREE.Vector3(...(node.scale ?? [1, 1, 1])));
    meshes[node.name] = { geometry: g, matrix };
  }
  return { meshes, textures, json: gl };
}
