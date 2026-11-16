// Inflatable animals of the 万兽之王 show. Lion, eagle and elephant are modelled in Blender
// (assets/blender/build_mascots.py) from the Xiaohongshu photos:
//   lion     – nest_首场_0002 (roaring, on a stone block)
//   eagle    – nest_首场_0003 (perched on a boulder, wings raised, separate primaries)
//   elephant – nest_首场_0004 (trunk curled up, long pale tusks, folded ears)
// Each animal is one sewn skin (all parts voxel-merged), sculpted (mane locks, feather rows,
// trunk rings, rock cracks), decimated to 4-5.5k triangles, with paint + ambient occlusion and
// an object-space normal map baked into one shared 1024 x 1024 atlas pair.
// They ship as one GLB (public/stage/joker_xue_2026/mascots.glb, part of the shared stage
// kit: identical in every city). One material for all three, one draw call per animal.
// The GLB is fetched after the first frame; until it arrives the meshes hold a single
// degenerate triangle, so the material's shader is compiled during the warm-up frames and
// the swap never links a program mid-flight.
import { useEffect, useState } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { loadGlb } from "./glb.js";

const KIT_URL = `${import.meta.env.BASE_URL}stage/joker_xue_2026/mascots.glb`;

// Inflatable PVC: a soft sheen, no metal, and a little of its own glow: the real ones are lit
// by their own floods (nest_首场_0002), so the paint stays readable when the show wash is
// dark or strongly coloured.
const glowPatch = (glow) => (shader) => {
  shader.fragmentShader = shader.fragmentShader.replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>\n  totalEmissiveRadiance += diffuseColor.rgb * ${glow.toFixed(3)};`);
};
// Vertex-coloured skin, still used by the whale (src/stage/JokerXueStage.jsx).
const skins = {};
export function skin(rough = 0.56, glow = 0.3, side = THREE.DoubleSide) {
  const key = `${rough}/${glow}/${side}`;
  if (!skins[key]) {
    const m = (skins[key] = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: rough, metalness: 0.02, side }));
    m.onBeforeCompile = glowPatch(glow);
    m.customProgramCacheKey = () => `skin${glow}`;
  }
  return skins[key];
}

// ---- the Blender kit ---------------------------------------------------------------------------
const pixel = (css) => {
  const c = document.createElement("canvas");
  c.width = c.height = 1;
  const g = c.getContext("2d");
  g.fillStyle = css;
  g.fillRect(0, 0, 1, 1);
  const t = new THREE.Texture(c);
  t.flipY = false; // glTF texture convention
  t.needsUpdate = true;
  return t;
};
let atlas = null;
function atlasMaterial() {
  if (atlas) return atlas;
  const map = pixel("#000"), normalMap = pixel("rgb(128,255,128)");
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = normalMap.anisotropy = 4;
  // object-space normal map (baked in the app frame): no tangent convention to get wrong
  atlas = new THREE.MeshStandardMaterial({ map, normalMap, normalMapType: THREE.ObjectSpaceNormalMap, roughness: 0.62, metalness: 0.02 });
  atlas.onBeforeCompile = glowPatch(0.3);
  atlas.customProgramCacheKey = () => "mascotAtlas";
  return atlas;
}

const EMPTY = new THREE.BufferGeometry();
EMPTY.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0, 0, 0, 0], 3));
EMPTY.setAttribute("normal", new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
EMPTY.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0], 2));

let kitPromise = null, kit = null;
function loadKit(gl) {
  kitPromise ??= loadGlb(KIT_URL).then(({ meshes, textures }) => {
    // fresh textures (three sizes a texture's storage on its first upload, so the 1x1
    // placeholders cannot just take the new image); same map/normalMap slots = same program
    const m = atlasMaterial();
    ["map", "normalMap"].forEach((slot, i) => {
      const t = new THREE.Texture(textures[i]);
      t.flipY = false;
      t.colorSpace = m[slot].colorSpace;
      t.anisotropy = 4;
      t.needsUpdate = true;
      gl.initTexture(t);
      m[slot].dispose();
      m[slot] = t;
    });
    kit = {};
    for (const [name, { geometry, matrix }] of Object.entries(meshes)) {
      const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
      matrix.decompose(p, q, s);
      geometry.computeBoundingSphere();
      kit[name] = { geometry, p: p.toArray(), s: s.toArray() };
    }
    window.__mascotsReady = true; // scripts/mascot_raycheck.mjs waits for the real meshes
    return kit;
  });
  return kitPromise;
}
function useKit() {
  const gl = useThree((st) => st.gl);
  const [k, setK] = useState(kit);
  useEffect(() => {
    let live = true;
    // after the first frame, at low priority: the map and the first 3D frame never wait for it
    const id = requestAnimationFrame(() => loadKit(gl).then((v) => live && setK(v)));
    return () => {
      live = false;
      cancelAnimationFrame(id);
    };
  }, [gl]);
  return k;
}

function KitMesh({ name, offset }) {
  const k = useKit()?.[name];
  return <mesh geometry={k ? k.geometry : EMPTY} material={atlasMaterial()} position={k ? k.p.map((v, i) => v + offset[i]) : offset} scale={k ? k.s : 1} />;
}

const Plinth = ({ w = 13, d = 9, h = 3.2 }) => (
  <mesh position={[0, h / 2, 0]}>
    <boxGeometry args={[w, h, d]} />
    <meshStandardMaterial color="#0c0c10" roughness={0.9} />
  </mesh>
);

// Offsets are the ones the hand-built meshes used, so every animal stands where it did.
export function Lion({ plinth = false, ...props }) {
  return (
    <group {...props}>
      {plinth && <Plinth w={15} d={9} />}
      <KitMesh name="lion" offset={[0, (plinth ? 3.2 : 0) + 2.65, 0]} />
    </group>
  );
}
export function Eagle({ plinth = false, ...props }) {
  return (
    <group {...props}>
      {plinth && <Plinth w={12} d={10} />}
      <KitMesh name="eagle" offset={[0, (plinth ? 3.2 : 0) + 2.0, 0]} />
    </group>
  );
}
export function Elephant({ plinth = false, ...props }) {
  return (
    <group {...props}>
      {plinth && <Plinth w={16} d={9} />}
      <KitMesh name="elephant" offset={[-1.5, plinth ? 3.2 : 0, 0]} />
    </group>
  );
}
