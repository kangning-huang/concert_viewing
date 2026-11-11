// Seated-audience silhouette atlas ("shadow cut boards"), baked from the dark foreground
// audience in the XHS photos by scripts/bake_silhouettes.py.
// 8 x 4 cells, R = soft silhouette mask, G = glow mask (phone screen, light stick).
// Cells 0-7 are whole figures traced from the photos (hair, shoulders, back), 8-23 are photo
// heads on those traced backs, 24-31 hold a raised phone or light stick.
// trimX / trimY: the part of a plain cell that holds the outline (bake script: head top at row 84
// of 256, widest shoulder 53 px from the centre of the 128 px cell); card quads are trimmed to it.
import * as THREE from "three";

export const SIL = { cols: 8, rows: 4, plain: 24, trimX: 0.88, trimY: 0.7, w: 0.62, h: 1.24, url: `${import.meta.env.BASE_URL}stage/joker_xue_2026/crowd/silhouettes.webp` };
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

