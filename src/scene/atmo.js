// Shared show atmosphere: one set of uniforms drives every custom shader (stands, baked
// structure, crowd, beams), so a cue change costs a few uniform writes and no recompiles.
import * as THREE from "three";

export const ATMO = {
  uT: { value: 0 },
  uCue: { value: new THREE.Color("#4f8dff") }, // stage wash colour (CUES[cue].light)
  uEdge: { value: new THREE.Color("#27b9ff") }, // LED ribbon / light-stick colour (CUES[cue].edge)
  uFog: { value: new THREE.Color("#05070f") },
  uFogK: { value: 0.0021 },
  // xy = centre (world x,z) of the near-seat patch, z = radius; the far stand shader cuts a
  // hole there and real 3D seats + people take over (LOD hand-off).
  uSeat: { value: new THREE.Vector4(0, 0, 0, 0) },
};

export const atmoUniforms = (extra = {}) => ({ ...ATMO, ...extra });

export function tickAtmo(elapsed, dt, cue) {
  ATMO.uT.value = elapsed;
  const k = 1 - Math.exp(-dt * 3);
  ATMO.uCue.value.lerp(tmp.set(cue.light), k);
  ATMO.uEdge.value.lerp(tmp.set(cue.edge), k);
}
const tmp = new THREE.Color();

export const GLSL_ATMO = /* glsl */ `
uniform float uT; uniform vec3 uCue; uniform vec3 uEdge; uniform vec3 uFog; uniform float uFogK; uniform vec4 uSeat;
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*.1031); p3 += dot(p3, p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
// haze: exponential distance fog, tinted by the current wash colour
vec3 applyFog(vec3 c, float dist){ float f = 1.-exp(-dist*uFogK); return mix(c, uFog + uCue*.045, f); }
`;

export const GLSL_OUT = /* glsl */ `
#include <tonemapping_fragment>
#include <colorspace_fragment>
`;

// Baked stage light for static geometry: one wrapped-lambert + distance term per vertex,
// computed once at build time. At runtime it is only multiplied by the cue colour.
const STAGE_LIGHT = [0, 27, 0];
export function bakeLight(p, n, twoSided = false) {
  const vx = STAGE_LIGHT[0] - p[0], vy = STAGE_LIGHT[1] - p[1], vz = STAGE_LIGHT[2] - p[2];
  const d = Math.hypot(vx, vy, vz) || 1;
  let ndl = (n[0] * vx + n[1] * vy + n[2] * vz) / d;
  ndl = twoSided ? Math.abs(ndl) : Math.max(0, ndl);
  return (ndl * 0.8 + 0.2) / (1 + (d / 115) ** 2);
}
