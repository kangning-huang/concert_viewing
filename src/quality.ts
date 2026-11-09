/** Adaptive AAA quality tiers — never force max graphics on weak phones. */
export type QualityTier = 'ultra' | 'high' | 'medium' | 'low'

export type QualitySettings = {
  tier: QualityTier
  dprCap: number
  shadows: boolean
  shadowMapSize: number
  /** Bloom composer. The chunk is only downloaded on tiers that use it. */
  postFx: boolean
  msaa: number
  /** One-off procedural reflection probe; no network HDR. */
  env: boolean
  anisotropy: number
  pixelRatioTarget: number
  ledTexture: number
  crowdTexture: number
  bulbs: number
  /** Canopy truss spacing in scene units; 0 = no truss. */
  truss: number
  towerBraces: boolean
  grassTufts: number
  hazeCards: number
  beams: number
}

const TIERS: Record<QualityTier, Omit<QualitySettings, 'tier'>> = {
  ultra: {
    dprCap: 2, shadows: true, shadowMapSize: 2048, postFx: true, msaa: 4, env: true, anisotropy: 8, pixelRatioTarget: 2,
    ledTexture: 2048, crowdTexture: 2048, bulbs: 120, truss: 2.5, towerBraces: true, grassTufts: 9000, hazeCards: 16, beams: 24,
  },
  high: {
    dprCap: 1.75, shadows: true, shadowMapSize: 1024, postFx: true, msaa: 2, env: true, anisotropy: 4, pixelRatioTarget: 1.75,
    ledTexture: 2048, crowdTexture: 1024, bulbs: 80, truss: 4, towerBraces: true, grassTufts: 5000, hazeCards: 10, beams: 16,
  },
  medium: {
    dprCap: 1.25, shadows: false, shadowMapSize: 512, postFx: false, msaa: 0, env: true, anisotropy: 2, pixelRatioTarget: 1.25,
    ledTexture: 1024, crowdTexture: 1024, bulbs: 60, truss: 6, towerBraces: false, grassTufts: 1500, hazeCards: 4, beams: 8,
  },
  low: {
    dprCap: 1, shadows: false, shadowMapSize: 512, postFx: false, msaa: 0, env: false, anisotropy: 1, pixelRatioTarget: 1,
    ledTexture: 512, crowdTexture: 512, bulbs: 36, truss: 0, towerBraces: false, grassTufts: 0, hazeCards: 0, beams: 0,
  },
}

const ORDER: QualityTier[] = ['ultra', 'high', 'medium', 'low']

export function parseForcedQuality(): QualityTier | null {
  if (typeof window === 'undefined') return null
  const q = new URLSearchParams(window.location.search).get('quality')
  if (!q) return null
  const v = q.toLowerCase() as QualityTier
  return ORDER.includes(v) ? v : null
}

export function detectInitialTier(): QualityTier {
  const forced = parseForcedQuality()
  if (forced) return forced
  if (typeof navigator === 'undefined') return 'high'
  const cores = navigator.hardwareConcurrency || 4
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory
  const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent)
  if (isMobile && (mem !== undefined && mem <= 4 || cores <= 4)) return 'medium'
  if (isMobile) return 'high'
  if (cores >= 8 && (mem === undefined || mem >= 8)) return 'ultra'
  return 'high'
}

export function settingsFor(tier: QualityTier): QualitySettings {
  return { tier, ...TIERS[tier] }
}

/** Drop one tier if FPS stays below floor (~45). Target ~60. */
export function maybeDowngrade(tier: QualityTier, fps: number, floor = 45): QualityTier {
  if (parseForcedQuality()) return tier
  if (fps >= floor) return tier
  const i = ORDER.indexOf(tier)
  return i < ORDER.length - 1 ? ORDER[i + 1]! : tier
}
