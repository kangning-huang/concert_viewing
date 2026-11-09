import * as THREE from 'three'

/**
 * Procedural structure and atmosphere textures for the shared kit
 * `joker_xue_2026`, matched by eye to assets/refs/xhs/nest/ (nest_226_0001
 * show light, nest_801_0006 haze). LED content is real show photography, baked
 * by scripts/bake_led_textures.py and loaded in SharedStage.
 */

/** Seeded so the kit renders identically in every city. */
export function seededRandom(seed: number) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function paint(width: number, height: number, draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  draw(canvas.getContext('2d')!, width, height)
  return new THREE.CanvasTexture(canvas)
}

function tiled(texture: THREE.CanvasTexture, worldSize: number, anisotropy: number) {
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  // ExtrudeGeometry UVs are in scene units.
  texture.repeat.set(1 / worldSize, 1 / worldSize)
  texture.anisotropy = anisotropy
  return texture
}

/** Dark scuffed deck plate with panel seams. Used as map and roughness map. */
export function deckPlateTexture(anisotropy: number) {
  const random = seededRandom(11)
  const texture = paint(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#5a5e68'
    ctx.fillRect(0, 0, w, h)
    for (let i = 0; i < 900; i += 1) {
      const v = 70 + random() * 60
      ctx.fillStyle = `rgba(${v},${v},${v + 8},0.25)`
      ctx.fillRect(random() * w, random() * h, 1 + random() * 14, 1)
    }
    ctx.fillStyle = '#16181e'
    ctx.fillRect(0, 0, w, 3)
    ctx.fillRect(0, 0, 3, h)
  })
  return tiled(texture, 4, anisotropy)
}

/** Vertical slats on the deck edge, which fill the view from the front row. */
export function fasciaTexture(anisotropy: number) {
  const texture = paint(128, 64, (ctx, w, h) => {
    ctx.fillStyle = '#20232b'
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = '#07080c'
    for (let x = 0; x < w; x += 16) ctx.fillRect(x, 0, 5, h)
  })
  texture.colorSpace = THREE.SRGBColorSpace
  return tiled(texture, 1.4, anisotropy)
}

/** LED spill on the deck floor, baked instead of paying for realtime lights. */
export function deckGlowTexture(width: number, depth: number, ledWidth: number, ledDepth: number) {
  const texture = paint(512, Math.round((512 * depth) / width), (ctx, w, h) => {
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, w, h)
    const lw = (ledWidth / width) * w
    const ld = (ledDepth / depth) * h
    // Stacked translucent rects give a soft falloff; canvas filters are missing on iOS.
    ctx.globalCompositeOperation = 'lighter'
    for (let i = 0; i < 28; i += 1) {
      const t = i / 27
      const rw = lw * (1.28 - t * 0.95)
      const rd = ld * (1.5 - t * 1.25)
      ctx.fillStyle = i % 3 ? 'rgba(70,96,210,0.05)' : 'rgba(120,84,220,0.05)'
      ctx.fillRect((w - rw) / 2, (h - rd) / 2, rw, rd)
    }
    ctx.globalCompositeOperation = 'source-over'
  })
  texture.colorSpace = THREE.SRGBColorSpace
  texture.repeat.set(1 / width, 1 / depth)
  texture.offset.set(0.5, 0.5)
  return texture
}

/** Baked contact darkening around the deck, on the grass bed. */
export function contactShadowTexture(planeWidth: number, planeDepth: number, deckWidth: number, deckDepth: number) {
  const texture = paint(512, Math.round((512 * planeDepth) / planeWidth), (ctx, w, h) => {
    const dw = (deckWidth / planeWidth) * w
    const dd = (deckDepth / planeDepth) * h
    ctx.shadowColor = 'rgba(0,0,0,0.95)'
    ctx.shadowBlur = w * 0.05
    ctx.fillStyle = '#000'
    ctx.fillRect((w - dw) / 2, (h - dd) / 2, dw, dd)
  })
  return texture
}

export function grassBedTexture(anisotropy: number) {
  const random = seededRandom(5)
  const texture = paint(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#10200f'
    ctx.fillRect(0, 0, w, h)
    for (let i = 0; i < 2600; i += 1) {
      ctx.fillStyle = `rgba(${40 + random() * 40},${90 + random() * 70},${40 + random() * 50},0.35)`
      ctx.fillRect(random() * w, random() * h, 1, 2 + random() * 6)
    }
  })
  texture.colorSpace = THREE.SRGBColorSpace
  return tiled(texture, 6, anisotropy)
}

export function glowSpriteTexture() {
  const texture = paint(64, 64, (ctx, w) => {
    const glow = ctx.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2)
    glow.addColorStop(0, 'rgba(255,255,255,1)')
    glow.addColorStop(0.16, 'rgba(255,255,255,0.9)')
    glow.addColorStop(0.32, 'rgba(255,255,255,0.22)')
    glow.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = glow
    ctx.fillRect(0, 0, w, w)
  })
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

export function hazeSpriteTexture() {
  const random = seededRandom(41)
  const texture = paint(128, 128, (ctx, w) => {
    ctx.globalCompositeOperation = 'lighter'
    for (let i = 0; i < 26; i += 1) {
      const angle = random() * Math.PI * 2
      const offset = random() * w * 0.26
      const x = w / 2 + Math.cos(angle) * offset
      const y = w / 2 + Math.sin(angle) * offset
      const r = w * (0.12 + random() * 0.14)
      const puff = ctx.createRadialGradient(x, y, 0, x, y, r)
      puff.addColorStop(0, 'rgba(255,255,255,0.16)')
      puff.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = puff
      ctx.fillRect(0, 0, w, w)
    }
  })
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

/** Light-beam falloff: bright at the fixture (v = 0), gone at the far end. */
export function beamTexture() {
  const texture = paint(4, 128, (ctx, w, h) => {
    const fade = ctx.createLinearGradient(0, h, 0, 0)
    fade.addColorStop(0, 'rgba(255,255,255,1)')
    fade.addColorStop(0.35, 'rgba(255,255,255,0.32)')
    fade.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = fade
    ctx.fillRect(0, 0, w, h)
  })
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

export function skyTexture() {
  const texture = paint(4, 256, (ctx, w, h) => {
    const sky = ctx.createLinearGradient(0, 0, 0, h)
    sky.addColorStop(0, '#05060c')
    sky.addColorStop(0.42, '#0b0d1c')
    sky.addColorStop(0.5, '#1b1c3c')
    sky.addColorStop(0.53, '#0b0c12')
    sky.addColorStop(1, '#0b0c12')
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, w, h)
  })
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

/**
 * Light-stick sparkle for the flat placeholder ring. This is only a texture on
 * existing NON-METRIC geometry; its dots are not seat positions.
 */
export function crowdGlowTexture(size: number, innerFraction: number) {
  const random = seededRandom(77)
  const palette = ['#7fb2ff', '#a884ff', '#e9eeff', '#5fd0ff', '#d07bff']
  const texture = paint(size, size, (ctx, w) => {
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, w, w)
    const dots = Math.round(size * 7)
    const dot = Math.max(1, (size / 1024) * 1.5)
    for (let i = 0; i < dots; i += 1) {
      const angle = random() * Math.PI * 2
      const r = (innerFraction + random() * (1 - innerFraction)) * (w / 2)
      ctx.globalAlpha = 0.3 + random() * 0.7
      ctx.fillStyle = palette[Math.floor(random() * palette.length)]!
      ctx.fillRect(w / 2 + Math.cos(angle) * r, w / 2 + Math.sin(angle) * r, dot, dot)
    }
    ctx.globalAlpha = 1
  })
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}
