/** Adaptive AAA quality tiers — never force max graphics on weak phones. */
export type QualityTier = 'ultra' | 'high' | 'medium' | 'low'

export type QualitySettings = {
  tier: QualityTier
  dprCap: number
  shadows: boolean
  postFx: boolean
  anisotropy: number
  pixelRatioTarget: number
}

const TIERS: Record<QualityTier, Omit<QualitySettings, 'tier'>> = {
  ultra: { dprCap: 2, shadows: true, postFx: true, anisotropy: 8, pixelRatioTarget: 2 },
  high: { dprCap: 1.75, shadows: true, postFx: true, anisotropy: 4, pixelRatioTarget: 1.75 },
  medium: { dprCap: 1.25, shadows: false, postFx: false, anisotropy: 2, pixelRatioTarget: 1.25 },
  low: { dprCap: 1, shadows: false, postFx: false, anisotropy: 1, pixelRatioTarget: 1 },
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
