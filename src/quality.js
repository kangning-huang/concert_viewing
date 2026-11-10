// Adaptive quality tiers (Ultra→Low) + ?quality= force — 1:1 from c941445.
export const TIER_ORDER = ["ultra", "high", "medium", "low"];
export const TIERS = {
  ultra: { name: "ultra", dpr: 2, post: "full", bloom: 0.85, msaa: 4, shadowMap: 2048, crowd: 1, textureScale: 1, anisotropy: 8, bowl: "glb", stage: { detail: 1, fx: 1 } },
  high: { name: "high", dpr: 1.5, post: "full", bloom: 0.7, msaa: 0, shadowMap: 1024, crowd: 1, textureScale: 1, anisotropy: 4, bowl: "glb", stage: { detail: 1, fx: 1 } },
  medium: { name: "medium", dpr: 1.25, post: "bloom", bloom: 0.55, msaa: 0, shadowMap: 0, crowd: 0.6, textureScale: 0.75, anisotropy: 2, bowl: "lite", stage: { detail: 1, fx: 1 } },
  low: { name: "low", dpr: 1, post: "none", bloom: 0, msaa: 0, shadowMap: 0, crowd: 0.25, textureScale: 0.5, anisotropy: 1, bowl: "stub", stage: { detail: 0.5, fx: 0.5 } },
};
const OK_FPS = 45, BAD_FPS = 28;
const worse = (a, b) => TIER_ORDER[Math.max(TIER_ORDER.indexOf(a), TIER_ORDER.indexOf(b))];

export function pickTier({ renderer = "", mobile = false, memory, cores } = {}) {
  const r = renderer.toLowerCase();
  if (/swiftshader|llvmpipe|software|basic render/.test(r)) return "low";
  let tier;
  if (mobile) {
    const adreno = Number(r.match(/adreno[^\d]*(\d{3})/)?.[1]);
    const mali = /mali-g(7[1-9]|[89]\d|\d{3})|immortalis/.test(r);
    tier = /apple/.test(r) || adreno >= 730 || /immortalis/.test(r) ? "high" : adreno >= 610 || mali ? "medium" : "low";
  } else tier = /intel|uhd|iris/.test(r) ? "high" : "ultra";
  if (memory !== undefined && memory <= 2) tier = "low";
  else if (memory !== undefined && memory <= 4) tier = worse(tier, "medium");
  if (cores !== undefined && cores <= 4) tier = worse(tier, mobile ? "medium" : "high");
  return tier;
}
export const stepDown = (tier, n) => TIER_ORDER[Math.min(TIER_ORDER.length - 1, TIER_ORDER.indexOf(tier) + n)];

export function fpsMonitor({ windowMs = 2000, settleMs = 500 } = {}) {
  let buf = [], acc = 0, settle = settleMs;
  return {
    sample(ms) {
      if (ms > 1000) return 0;
      if (settle > 0) return (settle -= ms), 0;
      buf.push(ms);
      acc += ms;
      if (acc < windowMs) return 0;
      const median = [...buf].sort((a, b) => a - b)[buf.length >> 1];
      buf = [];
      acc = 0;
      const fps = 1000 / median;
      return fps >= OK_FPS ? 0 : ((settle = settleMs), fps < BAD_FPS ? 2 : 1);
    },
  };
}

function probe() {
  let renderer = "";
  try {
    const gl = document.createElement("canvas").getContext("webgl");
    const ext = gl?.getExtension("WEBGL_debug_renderer_info");
    renderer = (ext && gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) || "";
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {}
  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.platform));
  return { renderer, mobile, memory: navigator.deviceMemory, cores: navigator.hardwareConcurrency };
}

export function initialQuality() {
  const q = new URLSearchParams(window.location.search).get("quality");
  return TIERS[q] ? { tier: q, adaptive: false } : { tier: pickTier(probe()), adaptive: true };
}
