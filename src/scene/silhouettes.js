// Seated-audience silhouette atlas ("shadow cut boards"), baked from the dark foreground
// audience in the XHS photos by scripts/bake_silhouettes.py.
// 8 x 4 cells, R = soft silhouette mask, G = glow mask (phone screen, light stick).
// Cells 0-15 are plain outlines, 16-31 hold a raised phone or light stick.
import * as THREE from "three";

export const SIL = { cols: 8, rows: 4, plain: 16, w: 0.62, h: 1.24, url: `${import.meta.env.BASE_URL}stage/joker_xue_2026/crowd/silhouettes.webp` };
let atlasTex;
export function silhouetteAtlas() {
  if (atlasTex) return atlasTex;
  const t = (atlasTex = new THREE.Texture());
  t.flipY = false; // row 0 of the image = top row of cells
  t.colorSpace = THREE.NoColorSpace;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.anisotropy = 4;
  // decode off the main thread (same reason as the LED photos: no upload stall mid-flight)
  t.userData.ready = new Promise((done) =>
    new THREE.ImageBitmapLoader().setOptions({ premultiplyAlpha: "none", colorSpaceConversion: "none" }).load(
      SIL.url,
      (bmp) => {
        t.image = bmp;
        t.needsUpdate = true;
        done(t);
      },
      undefined,
      () => done(null)
    )
  );
  return t;
}

