import { useFrame } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { QualitySettings } from './quality'
import {
  beamTexture,
  contactShadowTexture,
  deckGlowTexture,
  deckPlateTexture,
  fasciaTexture,
  glowSpriteTexture,
  grassBedTexture,
  hazeSpriteTexture,
  ledTexture,
  seededRandom,
} from './stageTextures'

/**
 * Shared tour stage kit: identical every city (Nest photos transfer).
 *
 * NON-METRIC: no cited stage measurements exist, so every dimension is in
 * arbitrary scene units. Only the proportions and layout come from the photos
 * in assets/refs/xhs/nest/ (e.g. nest_526_0001, nest_526_0004, nest_226_0001,
 * nest_801_0006, nest_皇帝位_0001). Do not derive seat distances from this
 * geometry.
 *
 * Models the raised show pose only; the photos also show the LED volume
 * lowered to the deck.
 *
 * SIGHTLINE RULE: anything standing on the field stays under
 * FLOOR_PROP_MAX_HEIGHT, which is below floor eye height, so it cannot block a
 * floor seat's view. Tall items (IMAG screens) stay out beyond the short ends,
 * behind the floor blocks' lines to the stage. Animal mascots or sculptures, if
 * added later, go behind or below seats and never between a floor seat and the
 * stage. The kit has none today.
 */

const LED = { width: 36, height: 13, depth: 20, bottom: 10 }
const DECK = { width: 48, depth: 34, radius: 7, ringWidth: 5, height: 2.4 }
const CANOPY = { width: 44, depth: 30, radius: 8, bottom: 27, height: 3 }
const GRASS = { width: 62, depth: 48, radius: 11, bedHeight: 0.5, bladeHeight: 0.85 }
const TOWER_WIDTH = 1.6
const IMAG = { width: 12, height: 20, bottom: 1.5, x: 62, z: 26 }
export const FLOOR_PROP_MAX_HEIGHT = 1.2

function roundedRect(width: number, depth: number, radius: number) {
  const x = width / 2
  const y = depth / 2
  const shape = new THREE.Shape()
  shape.moveTo(-x + radius, -y)
  shape.lineTo(x - radius, -y)
  shape.absarc(x - radius, -y + radius, radius, -Math.PI / 2, 0, false)
  shape.lineTo(x, y - radius)
  shape.absarc(x - radius, y - radius, radius, 0, Math.PI / 2, false)
  shape.lineTo(-x + radius, y)
  shape.absarc(-x + radius, y - radius, radius, Math.PI / 2, Math.PI, false)
  shape.lineTo(-x, -y + radius)
  shape.absarc(-x + radius, -y + radius, radius, Math.PI, Math.PI * 1.5, false)
  return shape
}

function extrude(shape: THREE.Shape, height: number) {
  // three r175 builds no cap triangles when bevelEnabled is false, so use a zero-size bevel.
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: true, bevelSize: 0, bevelThickness: 0, bevelSegments: 1, curveSegments: 10 })
  geometry.rotateX(-Math.PI / 2)
  return geometry
}

function ring(outer: THREE.Shape, inner: THREE.Shape, height: number) {
  const shape = new THREE.Shape(outer.getPoints(10))
  shape.holes.push(new THREE.Path(inner.getPoints(10)))
  return extrude(shape, height)
}

/** Signed distance to a rounded rectangle centred on the origin. */
function roundedRectDistance(x: number, z: number, width: number, depth: number, radius: number) {
  const qx = Math.abs(x) - width / 2 + radius
  const qz = Math.abs(z) - depth / 2 + radius
  return Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - radius
}

const deckOuter = roundedRect(DECK.width, DECK.depth, DECK.radius)
const deckInner = roundedRect(
  DECK.width - DECK.ringWidth * 2,
  DECK.depth - DECK.ringWidth * 2,
  Math.max(DECK.radius - DECK.ringWidth, 1),
)
const canopyOuter = roundedRect(CANOPY.width, CANOPY.depth, CANOPY.radius)
const grassOuter = roundedRect(GRASS.width, GRASS.depth, GRASS.radius)

const deckRingGeometry = ring(deckOuter, deckInner, DECK.height)
const deckFloorGeometry = extrude(deckInner, DECK.height * 0.7)
const deckRimGeometry = ring(roundedRect(DECK.width + 0.2, DECK.depth + 0.2, DECK.radius + 0.1), roundedRect(DECK.width - 0.24, DECK.depth - 0.24, DECK.radius - 0.12), 0.18)
const canopyGeometry = extrude(canopyOuter, CANOPY.height)
const canopyRimGeometry = ring(roundedRect(CANOPY.width + 0.2, CANOPY.depth + 0.2, CANOPY.radius + 0.1), roundedRect(CANOPY.width - 0.8, CANOPY.depth - 0.8, CANOPY.radius - 0.4), 0.25)
const grassGeometry = ring(grassOuter, deckOuter, GRASS.bedHeight)

/** Box UVs squash the full texture onto each face; crop the narrow sides instead. */
const ledGeometry = (() => {
  const geometry = new THREE.BoxGeometry(LED.width, LED.height, LED.depth)
  const uv = geometry.attributes.uv as THREE.BufferAttribute
  const crop = LED.depth / LED.width
  for (let i = 0; i < 8; i += 1) uv.setX(i, 0.5 + (uv.getX(i) - 0.5) * crop)
  return geometry
})()

type Box = {
  position: [number, number, number]
  scale: [number, number, number]
  rotation?: [number, number, number]
}

function trussBeams(spacing: number): Box[] {
  if (spacing <= 0) return []
  const y = CANOPY.bottom - 0.5
  const beams: Box[] = []
  const halfWidth = CANOPY.width / 2 - 2
  const halfDepth = CANOPY.depth / 2 - 2
  for (let x = -halfWidth; x <= halfWidth; x += spacing) {
    beams.push({ position: [x, y, 0], scale: [0.25, 0.9, halfDepth * 2] })
  }
  for (let z = -halfDepth; z <= halfDepth; z += spacing) {
    beams.push({ position: [0, y, z], scale: [halfWidth * 2, 0.9, 0.25] })
  }
  return beams
}

/** Lattice legs, matching the open towers in nest_526_0004. */
function towerLattice(x: number, z: number, bottom: number, height: number, braces: boolean): Box[] {
  const half = TOWER_WIDTH / 2
  const chord = 0.18
  const parts: Box[] = [-1, 1].flatMap((sx) =>
    [-1, 1].map((sz) => ({
      position: [x + sx * half, bottom + height / 2, z + sz * half] as [number, number, number],
      scale: [chord, height, chord] as [number, number, number],
    })),
  )
  if (!braces) {
    // No lattice: a thin core keeps the silhouette solid without the instances.
    parts.push({ position: [x, bottom + height / 2, z], scale: [TOWER_WIDTH * 0.8, height, TOWER_WIDTH * 0.8] })
    return parts
  }
  const step = TOWER_WIDTH * 1.15
  const diagonal = Math.hypot(TOWER_WIDTH, step)
  const angle = Math.atan2(step, TOWER_WIDTH)
  for (let level = 0; bottom + (level + 1) * step <= bottom + height; level += 1) {
    const y = bottom + (level + 0.5) * step
    const flip = level % 2 ? 1 : -1
    for (const side of [-1, 1]) {
      parts.push({ position: [x, y, z + side * half], scale: [diagonal, 0.07, 0.07], rotation: [0, 0, angle * flip] })
      parts.push({ position: [x + side * half, y, z], scale: [0.07, 0.07, diagonal], rotation: [angle * flip, 0, 0] })
      parts.push({ position: [x, y - step / 2, z + side * half], scale: [TOWER_WIDTH, 0.08, 0.08] })
      parts.push({ position: [x + side * half, y - step / 2, z], scale: [0.08, 0.08, TOWER_WIDTH] })
    }
  }
  return parts
}

/** Hung line arrays in front of the LED faces (nest_526_0004, nest_226_0001). */
function lineArrays(): Box[] {
  const cabinets = 11
  const parts: Box[] = []
  for (const x of [-13, 13]) {
    for (const side of [-1, 1]) {
      for (let i = 0; i < cabinets; i += 1) {
        const curl = (i / (cabinets - 1)) ** 2 * 0.5
        parts.push({
          position: [x, CANOPY.bottom - 3 - i * 0.62, side * (LED.depth / 2 + 1.1 + curl * 0.7)],
          scale: [1.5, 0.56, 1],
          rotation: [side * curl, 0, 0],
        })
      }
    }
  }
  return parts
}

/** Low flight cases and wedges along the field edge of the grass (nest_526_0004). */
function fieldCases(): Box[] {
  const parts: Box[] = []
  const height = FLOOR_PROP_MAX_HEIGHT - GRASS.bedHeight
  for (let x = -26; x <= 26; x += 6.5) {
    // Nothing directly in front of the centre-line 贴脸 seats.
    if (x === 0) continue
    for (const side of [-1, 1]) {
      parts.push({ position: [x, GRASS.bedHeight + height / 2, side * (GRASS.depth / 2 - 2.2)], scale: [1.7, height, 1.1] })
    }
  }
  return parts
}

function BoxInstances({ boxes, castShadow = false, children }: { boxes: Box[]; castShadow?: boolean; children: React.ReactNode }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    const matrix = new THREE.Matrix4()
    const rotation = new THREE.Quaternion()
    const euler = new THREE.Euler()
    boxes.forEach((box, index) => {
      rotation.setFromEuler(euler.set(...(box.rotation ?? [0, 0, 0])))
      matrix.compose(new THREE.Vector3(...box.position), rotation, new THREE.Vector3(...box.scale))
      ref.current!.setMatrixAt(index, matrix)
    })
    ref.current!.instanceMatrix.needsUpdate = true
  }, [boxes])
  return (
    <instancedMesh key={boxes.length} ref={ref} args={[undefined, undefined, boxes.length]} frustumCulled={false} castShadow={castShadow}>
      <boxGeometry />
      {children}
    </instancedMesh>
  )
}

type Lamp = { x: number; y: number; z: number; color: THREE.Color }

/** One draw call for every lamp; soft sprites still read as lamps without bloom. */
function Lamps({ lamps, size, map }: { lamps: Lamp[]; size: number; map: THREE.Texture }) {
  const geometry = useMemo(() => {
    const next = new THREE.BufferGeometry()
    next.setAttribute('position', new THREE.Float32BufferAttribute(lamps.flatMap((l) => [l.x, l.y, l.z]), 3))
    next.setAttribute('color', new THREE.Float32BufferAttribute(lamps.flatMap((l) => l.color.toArray() as number[]), 3))
    return next
  }, [lamps])
  useEffect(() => () => geometry.dispose(), [geometry])
  return (
    <points geometry={geometry} frustumCulled={false}>
      <pointsMaterial
        map={map}
        size={size}
        sizeAttenuation
        vertexColors
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
        fog={false}
      />
    </points>
  )
}

const BULB_COLORS = [new THREE.Color(2.4, 2.3, 2), new THREE.Color(1, 2, 2.8), new THREE.Color(1.8, 1.1, 2.8)]

function perimeterLamps(shape: THREE.Shape, count: number, y: number): Lamp[] {
  return shape
    .getSpacedPoints(count)
    .slice(0, count)
    .map((point, index) => ({ x: point.x, y, z: -point.y, color: BULB_COLORS[index % BULB_COLORS.length]! }))
}

function underCanopyLamps(rows: number): Lamp[] {
  const lamps: Lamp[] = []
  const color = new THREE.Color(2.2, 2.1, 2.5)
  for (let r = 0; r < rows; r += 1) {
    const z = -CANOPY.depth / 2 + 3 + (r * (CANOPY.depth - 6)) / Math.max(rows - 1, 1)
    for (let x = -CANOPY.width / 2 + 3; x <= CANOPY.width / 2 - 3; x += 3) {
      lamps.push({ x, y: CANOPY.bottom - 1.2, z, color })
    }
  }
  return lamps
}

/** Grass colour is baked per tuft (root dark, tips lit, show light near the deck): no lights. */
function Grass({ count }: { count: number }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const geometry = useMemo(() => {
    const positions: number[] = []
    const colors: number[] = []
    const normals: number[] = []
    for (let blade = 0; blade < 5; blade += 1) {
      const angle = (blade / 5) * Math.PI * 2 + blade
      const dx = Math.cos(angle)
      const dz = Math.sin(angle)
      const lean = 0.18 + (blade % 3) * 0.1
      positions.push(-dz * 0.07, 0, dx * 0.07, dz * 0.07, 0, -dx * 0.07, dx * lean, 1, dz * lean)
      colors.push(0.28, 0.28, 0.28, 0.28, 0.28, 0.28, 1, 1, 1)
      normals.push(0, 1, 0, 0, 1, 0, 0, 1, 0)
    }
    const next = new THREE.BufferGeometry()
    next.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    next.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    next.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
    return next
  }, [])
  useEffect(() => () => geometry.dispose(), [geometry])

  useLayoutEffect(() => {
    const random = seededRandom(303)
    const matrix = new THREE.Matrix4()
    const rotation = new THREE.Quaternion()
    const up = new THREE.Vector3(0, 1, 0)
    const color = new THREE.Color()
    const green = new THREE.Color('#3f7a2e')
    const wash = new THREE.Color('#6d7dff')
    const violet = new THREE.Color('#b05cff')
    let placed = 0
    while (placed < count) {
      const x = (random() - 0.5) * GRASS.width
      const z = (random() - 0.5) * GRASS.depth
      const toEdge = roundedRectDistance(x, z, GRASS.width, GRASS.depth, GRASS.radius)
      const toDeck = roundedRectDistance(x, z, DECK.width, DECK.depth, DECK.radius)
      if (toEdge > -0.2 || toDeck < 0.1) continue
      const height = GRASS.bladeHeight * (0.65 + random() * 0.6)
      rotation.setFromAxisAngle(up, random() * Math.PI * 2)
      matrix.compose(new THREE.Vector3(x, GRASS.bedHeight, z), rotation, new THREE.Vector3(height, height, height))
      ref.current!.setMatrixAt(placed, matrix)
      const nearDeck = Math.max(0, 1 - toDeck / 7)
      const pool = 0.5 + 0.5 * Math.sin(x * 0.31 + Math.cos(z * 0.23) * 2.4)
      color.copy(green).multiplyScalar(0.45 + random() * 0.4)
      color.lerp(pool > 0.72 ? violet : wash, nearDeck * 0.55 + pool * 0.16)
      ref.current!.setColorAt(placed, color)
      placed += 1
    }
    ref.current!.instanceMatrix.needsUpdate = true
    if (ref.current!.instanceColor) ref.current!.instanceColor.needsUpdate = true
  }, [count])

  return (
    <instancedMesh key={count} ref={ref} args={[geometry, undefined, count]} frustumCulled={false}>
      <meshBasicMaterial vertexColors side={THREE.DoubleSide} />
    </instancedMesh>
  )
}

function Haze({ count, map }: { count: number; map: THREE.Texture }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const puffs = useMemo(() => {
    const random = seededRandom(909)
    return Array.from({ length: count }, () => {
      const angle = random() * Math.PI * 2
      return {
        x: Math.cos(angle) * (24 + random() * 16),
        y: 4 + random() * 10,
        z: Math.sin(angle) * (18 + random() * 14),
        size: 16 + random() * 14,
        phase: random() * Math.PI * 2,
      }
    })
  }, [count])
  const color = useMemo(() => new THREE.Color('#7f8dff'), [])
  const scratch = useMemo(() => ({ matrix: new THREE.Matrix4(), position: new THREE.Vector3(), scale: new THREE.Vector3() }), [])

  useFrame(({ camera, clock }) => {
    if (!ref.current) return
    const t = clock.elapsedTime
    puffs.forEach((puff, index) => {
      scratch.position.set(puff.x + Math.sin(t * 0.09 + puff.phase) * 2.4, puff.y, puff.z)
      scratch.scale.setScalar(puff.size)
      scratch.matrix.compose(scratch.position, camera.quaternion, scratch.scale)
      ref.current!.setMatrixAt(index, scratch.matrix)
    })
    ref.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh key={count} ref={ref} args={[undefined, undefined, count]} frustumCulled={false}>
      <planeGeometry />
      <meshBasicMaterial map={map} color={color} transparent opacity={0.1} depthWrite={false} blending={THREE.AdditiveBlending} fog={false} />
    </instancedMesh>
  )
}

/** Fan beams from the canopy rim and underside (nest_801_0006, nest_226_0001). */
function Beams({ count, map }: { count: number; map: THREE.Texture }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const geometry = useMemo(() => {
    const next = new THREE.CylinderGeometry(2.6, 0.07, 42, 10, 1, true)
    next.translate(0, 21, 0)
    return next
  }, [])
  useEffect(() => () => geometry.dispose(), [geometry])

  const fixtures = useMemo(() => {
    const points = canopyOuter.getSpacedPoints(count).slice(0, count)
    return points.map((point, index) => ({
      origin: new THREE.Vector3(point.x * 0.9, CANOPY.bottom + (index % 2 ? CANOPY.height : -1), -point.y * 0.9),
      up: index % 2 === 1,
      phase: index * 1.7,
    }))
  }, [count])

  useLayoutEffect(() => {
    const palette = [new THREE.Color('#dfe6ff'), new THREE.Color('#6f8cff'), new THREE.Color('#b78cff')]
    fixtures.forEach((_, index) => ref.current!.setColorAt(index, palette[index % palette.length]!))
    if (ref.current!.instanceColor) ref.current!.instanceColor.needsUpdate = true
  }, [fixtures])

  const scratch = useMemo(() => ({ matrix: new THREE.Matrix4(), euler: new THREE.Euler(), rotation: new THREE.Quaternion(), scale: new THREE.Vector3(1, 1, 1) }), [])

  useFrame(({ clock }) => {
    if (!ref.current) return
    const t = clock.elapsedTime
    fixtures.forEach((fixture, index) => {
      const sway = Math.sin(t * 0.32 + fixture.phase) * 0.28
      const spread = Math.atan2(fixture.origin.x, 60)
      const tilt = Math.atan2(fixture.origin.z, 60)
      // Beams hang from the fixture: the upward ones tip back over, the rest point down and out.
      scratch.euler.set(fixture.up ? tilt + sway * 0.6 : Math.PI - tilt * 2 - sway * 0.5, 0, -spread * (fixture.up ? 1 : 2))
      scratch.rotation.setFromEuler(scratch.euler)
      // Downward beams stop short of the field so they read as air, not as bars across the LED.
      scratch.scale.set(1, fixture.up ? 1 : 0.55, 1)
      scratch.matrix.compose(fixture.origin, scratch.rotation, scratch.scale)
      ref.current!.setMatrixAt(index, scratch.matrix)
    })
    ref.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh key={count} ref={ref} args={[geometry, undefined, count]} frustumCulled={false}>
      <meshBasicMaterial map={map} transparent opacity={0.16} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} fog={false} />
    </instancedMesh>
  )
}

function ImagScreen({ x, z, map }: { x: number; z: number; map: THREE.Texture }) {
  const rotation = Math.atan2(-x * 0.5, z)
  const center = IMAG.bottom + IMAG.height / 2
  return (
    <group position={[x, 0, z]} rotation={[0, rotation, 0]}>
      <mesh position={[0, center, -0.5]} castShadow>
        <boxGeometry args={[IMAG.width + 0.6, IMAG.height + 0.6, 0.8]} />
        <meshStandardMaterial color="#0c0e14" roughness={0.6} metalness={0.3} />
      </mesh>
      <mesh position={[0, center, -0.05]}>
        <planeGeometry args={[IMAG.width, IMAG.height]} />
        <meshBasicMaterial map={map} toneMapped={false} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * (IMAG.width / 2 + 0.18), center, 0]}>
          <boxGeometry args={[0.16, IMAG.height, 0.16]} />
          <meshBasicMaterial color={[2.4, 1.9, 3]} toneMapped={false} />
        </mesh>
      ))}
    </group>
  )
}

export function SharedStage({ kitId, quality }: { kitId: 'joker_xue_2026'; quality: QualitySettings }) {
  void kitId
  const textures = useMemo(() => {
    const led = ledTexture(quality.ledTexture, LED.width / LED.height, quality.anisotropy)
    // Portrait crop of the same content for the IMAG screens.
    const imag = led.clone()
    imag.repeat.set((LED.height / LED.width) * (IMAG.width / IMAG.height), 1)
    imag.offset.set((1 - imag.repeat.x) / 2, 0)
    imag.needsUpdate = true
    return {
      led,
      imag,
      plate: deckPlateTexture(quality.anisotropy),
      fascia: fasciaTexture(quality.anisotropy),
      deckGlow: deckGlowTexture(DECK.width, DECK.depth, LED.width, LED.depth),
      contact: contactShadowTexture(GRASS.width, GRASS.depth, DECK.width + 1, DECK.depth + 1),
      grassBed: grassBedTexture(quality.anisotropy),
      glow: glowSpriteTexture(),
      haze: hazeSpriteTexture(),
      beam: beamTexture(),
    }
  }, [quality.ledTexture, quality.anisotropy])
  useEffect(() => () => Object.values(textures).forEach((texture) => texture.dispose()), [textures])

  const steel = useMemo(() => {
    const towerX = LED.width / 2 - 3
    const towerZ = LED.depth / 2 - 3
    const towerHeight = CANOPY.bottom - DECK.height
    const legs = [-1, 1].flatMap((sx) =>
      [-1, 1].flatMap((sz) => towerLattice(sx * towerX, sz * towerZ, DECK.height, towerHeight, quality.towerBraces)),
    )
    return [...legs, ...trussBeams(quality.truss), ...lineArrays()]
  }, [quality.truss, quality.towerBraces])
  const cases = useMemo(fieldCases, [])

  const ledEdges = useMemo<Box[]>(() => {
    const t = 0.16
    const hw = LED.width / 2 + 0.04
    const hd = LED.depth / 2 + 0.04
    const edges: Box[] = []
    const cy = LED.bottom + LED.height / 2
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) edges.push({ position: [sx * hw, cy, sz * hd], scale: [t, LED.height, t] })
    for (const y of [LED.bottom, LED.bottom + LED.height]) {
      for (const sz of [-1, 1]) edges.push({ position: [0, y, sz * hd], scale: [LED.width, t, t] })
      for (const sx of [-1, 1]) edges.push({ position: [sx * hw, y, 0], scale: [t, t, LED.depth] })
    }
    return edges
  }, [])

  const lamps = useMemo(() => {
    const rows = quality.bulbs >= 100 ? 5 : quality.bulbs >= 60 ? 3 : 2
    return [
      ...perimeterLamps(canopyOuter, quality.bulbs, CANOPY.bottom + CANOPY.height + 0.2),
      ...underCanopyLamps(rows),
    ]
  }, [quality.bulbs])
  const deckLamps = useMemo(() => perimeterLamps(deckOuter, quality.bulbs, DECK.height + 0.35), [quality.bulbs])

  return (
    <group>
      <mesh geometry={grassGeometry} receiveShadow>
        <meshStandardMaterial map={textures.grassBed} roughness={1} emissive="#ffffff" emissiveMap={textures.grassBed} emissiveIntensity={0.5} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, GRASS.bedHeight + 0.02, 0]}>
        <planeGeometry args={[GRASS.width, GRASS.depth]} />
        <meshBasicMaterial map={textures.contact} transparent depthWrite={false} fog={false} />
      </mesh>
      {quality.grassTufts > 0 ? <Grass count={quality.grassTufts} /> : null}

      <mesh geometry={deckRingGeometry} castShadow receiveShadow>
        <meshStandardMaterial attach="material-0" color="#2a2d36" map={textures.plate} roughness={0.9} metalness={0.2} envMapIntensity={0.25} />
        <meshStandardMaterial attach="material-1" map={textures.fascia} roughness={0.7} metalness={0.2} envMapIntensity={0.25} />
      </mesh>
      <mesh geometry={deckFloorGeometry} receiveShadow>
        {/* Polished show floor: the LED spill is baked, the probe adds real sheen. */}
        <meshStandardMaterial color="#07090f" metalness={0.45} roughness={0.2} emissive="#ffffff" emissiveMap={textures.deckGlow} emissiveIntensity={0.55} />
      </mesh>
      <mesh geometry={deckRimGeometry} position={[0, DECK.height, 0]}>
        <meshBasicMaterial color={[0.9, 1.3, 2]} toneMapped={false} />
      </mesh>

      <BoxInstances boxes={steel} castShadow>
        <meshStandardMaterial color="#14161f" metalness={0.5} roughness={0.42} />
      </BoxInstances>
      <BoxInstances boxes={cases} castShadow>
        <meshStandardMaterial color="#101218" metalness={0.2} roughness={0.7} />
      </BoxInstances>

      <mesh geometry={ledGeometry} position={[0, LED.bottom + LED.height / 2, 0]} castShadow>
        <meshStandardMaterial attach="material-0" color="#05060b" emissive="#ffffff" emissiveMap={textures.led} emissiveIntensity={0.95} roughness={0.35} />
        <meshStandardMaterial attach="material-1" color="#05060b" emissive="#ffffff" emissiveMap={textures.led} emissiveIntensity={0.95} roughness={0.35} />
        <meshStandardMaterial attach="material-2" color="#0a0c12" roughness={0.6} metalness={0.3} />
        <meshStandardMaterial attach="material-3" color="#0a0c14" emissive="#1c2a66" emissiveIntensity={0.35} roughness={0.5} metalness={0.3} />
        <meshStandardMaterial attach="material-4" color="#05060b" emissive="#ffffff" emissiveMap={textures.led} emissiveIntensity={0.95} roughness={0.35} />
        <meshStandardMaterial attach="material-5" color="#05060b" emissive="#ffffff" emissiveMap={textures.led} emissiveIntensity={0.95} roughness={0.35} />
      </mesh>
      <BoxInstances boxes={ledEdges}>
        <meshBasicMaterial color={[1.7, 1.7, 2]} toneMapped={false} />
      </BoxInstances>

      <mesh geometry={canopyGeometry} position={[0, CANOPY.bottom, 0]} castShadow>
        <meshStandardMaterial color="#12141c" metalness={0.4} roughness={0.45} />
      </mesh>
      <mesh geometry={canopyRimGeometry} position={[0, CANOPY.bottom, 0]}>
        <meshBasicMaterial color={[2.2, 1.7, 3]} toneMapped={false} />
      </mesh>
      <mesh geometry={canopyRimGeometry} position={[0, CANOPY.bottom + CANOPY.height - 0.25, 0]}>
        <meshBasicMaterial color={[1.4, 1.9, 3]} toneMapped={false} />
      </mesh>

      {[-1, 1].flatMap((sx) => [-1, 1].map((sz) => <ImagScreen key={`${sx}:${sz}`} x={sx * IMAG.x} z={sz * IMAG.z} map={textures.imag} />))}

      <Lamps lamps={lamps} size={1.05} map={textures.glow} />
      <Lamps lamps={deckLamps} size={0.5} map={textures.glow} />
      {quality.beams > 0 ? <Beams count={quality.beams} map={textures.beam} /> : null}
      {quality.hazeCards > 0 ? <Haze count={quality.hazeCards} map={textures.haze} /> : null}
    </group>
  )
}
