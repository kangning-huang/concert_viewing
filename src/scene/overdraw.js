// ?overdraw=<layer> review mode, read by scripts/overdraw.mjs. Not used in normal runs.
// Every fragment that is rasterised adds one step of red: no depth test, no discard, additive.
// The picture is then a count of fragment-shader runs per pixel for that layer (its depth
// complexity), which is the GPU fill cost a phone pays and a frame-time probe on a Mac hides.
// <layer> = "all" or part of an object name: silhouettes, led-volume, beams, bowl, ...
import * as THREE from "three";

const param = typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("overdraw");
export const OVERDRAW = param !== null;
export const OVERDRAW_STEP = 4; // 8-bit levels per fragment → counts up to 63 layers
const OUT = `gl_FragColor = vec4(${OVERDRAW_STEP}./255., 0., 0., 1.);`;
if (OVERDRAW) THREE.ShaderChunk.colorspace_fragment += `\n${OUT}`;

const inLayer = (o) => {
  if (!param || param === "all") return true;
  for (let p = o; p; p = p.parent) if (p.name && p.name.includes(param)) return true;
  return false;
};
export function applyOverdraw(scene) {
  scene.background = null;
  scene.traverse((o) => {
    if (!(o.isMesh || o.isPoints || o.isLine || o.isSprite)) return;
    if (!inLayer(o)) return void (o.visible = false);
    for (const m of [].concat(o.material)) {
      if (!m || m.userData.overdraw) continue;
      m.userData.overdraw = true;
      m.defines = { ...(m.defines ?? {}), discard: "" };
      if (m.isShaderMaterial && !m.fragmentShader.includes("colorspace_fragment")) m.fragmentShader = m.fragmentShader.replace(/\}\s*$/, `${OUT}}`);
      Object.assign(m, { transparent: true, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, needsUpdate: true });
    }
  });
}
