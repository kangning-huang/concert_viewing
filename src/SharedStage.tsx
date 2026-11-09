import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { QualitySettings, QualityTier } from './quality'

/**
 * Shared tour stage kit: identical every city (Nest photos transfer).
 *
 * NON-METRIC: no cited stage measurements exist, so every dimension is in
 * arbitrary scene units. Only the proportions and layout come from the photos
 * in assets/refs/xhs/nest/ (e.g. nest_526_0001, nest_526_0004, nest_226_0001,
 * nest_801_0006). Do not derive seat distances from this geometry.
 *
 * Models the raised show pose only; the photos also show the LED volume
 * lowered to the deck.
 */

const LED = { width: 36, height: 13, depth: 20, bottom: 10 }
const DECK = { width: 48, depth: 34, radius: 7, ringWidth: 5, height: 2.4 }
const CANOPY = { width: 44, depth: 30, radius: 8, bottom: 27, height: 3 }
const GRASS = { width: 62, depth: 48, radius: 11 }
const TOWER_WIDTH = 1.6

const DETAIL: Record<QualityTier, { bulbs: number; truss: number; led: number }> = {
  ultra: { bulbs: 120, truss: 2.5, led: 2048 },
  high: { bulbs: 80, truss: 4, led: 2048 },
  medium: { bulbs: 40, truss: 0, led: 1024 },
  low: { bulbs: 0, truss: 0, led: 512 },
}

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
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false, curveSegments: 10 })
  geometry.rotateX(-Math.PI / 2)
  return geometry
}

function ring(outer: THREE.Shape, inner: THREE.Shape, height: number) {
  const shape = new THREE.Shape(outer.getPoints(10))
  shape.holes.push(new THREE.Path(inner.getPoints(10)))
  return extrude(shape, height)
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
const deckRimGeometry = ring(roundedRect(DECK.width + 0.2, DECK.depth + 0.2, DECK.radius + 0.1), roundedRect(DECK.width - 0.7, DECK.depth - 0.7, DECK.radius - 0.35), 0.18)
const canopyGeometry = extrude(canopyOuter, CANOPY.height)
const canopyRimGeometry = ring(roundedRect(CANOPY.width + 0.2, CANOPY.depth + 0.2, CANOPY.radius + 0.1), roundedRect(CANOPY.width - 0.8, CANOPY.depth - 0.8, CANOPY.radius - 0.4), 0.25)
const grassGeometry = ring(grassOuter, deckOuter, 0.5)

/** Generic LED panel look: lit content over a visible module grid. No tour artwork. */
function createLedTexture(size: number, anisotropy: number) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = Math.round((size * LED.height) / LED.width)
  const ctx = canvas.getContext('2d')!
  const { width, height } = canvas

  const glow = ctx.createLinearGradient(0, 0, width, height)
  glow.addColorStop(0, '#0d2a6e')
  glow.addColorStop(0.5, '#5fa8ff')
  glow.addColorStop(1, '#3a1680')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, width, height)

  const module = Math.max(Math.round(width / 72), 4)
  ctx.fillStyle = 'rgba(0, 0, 0, 0.32)'
  for (let x = 0; x < width; x += module) ctx.fillRect(x, 0, 1, height)
  for (let y = 0; y < height; y += module) ctx.fillRect(0, y, width, 1)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = anisotropy
  return texture
}

type Box = { position: [number, number, number]; scale: [number, number, number] }

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

function BoxInstances({ boxes }: { boxes: Box[] }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    const matrix = new THREE.Matrix4()
    const rotation = new THREE.Quaternion()
    boxes.forEach((box, index) => {
      matrix.compose(new THREE.Vector3(...box.position), rotation, new THREE.Vector3(...box.scale))
      ref.current!.setMatrixAt(index, matrix)
    })
    ref.current!.instanceMatrix.needsUpdate = true
  }, [boxes])
  return (
    <instancedMesh key={boxes.length} ref={ref} args={[undefined, undefined, boxes.length]} frustumCulled={false}>
      <boxGeometry />
      <meshStandardMaterial color="#14161f" metalness={0.25} roughness={0.45} />
    </instancedMesh>
  )
}

function Bulbs({ shape, count, y, color }: { shape: THREE.Shape; count: number; y: number; color: string }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    const matrix = new THREE.Matrix4()
    shape.getSpacedPoints(count).slice(0, count).forEach((point, index) => {
      matrix.makeTranslation(point.x, y, -point.y)
      ref.current!.setMatrixAt(index, matrix)
    })
    ref.current!.instanceMatrix.needsUpdate = true
  }, [shape, count, y])
  return (
    <instancedMesh key={count} ref={ref} args={[undefined, undefined, count]} frustumCulled={false}>
      <sphereGeometry args={[0.28, 8, 6]} />
      <meshBasicMaterial color={color} toneMapped={false} />
    </instancedMesh>
  )
}

export function SharedStage({ kitId, quality }: { kitId: 'joker_xue_2026'; quality: QualitySettings }) {
  void kitId
  const detail = DETAIL[quality.tier]
  const texture = useMemo(() => createLedTexture(detail.led, quality.anisotropy), [detail.led, quality.anisotropy])
  useEffect(() => () => texture.dispose(), [texture])
  const beams = useMemo(() => trussBeams(detail.truss), [detail.truss])

  const towerX = LED.width / 2 - 3
  const towerZ = LED.depth / 2 - 3
  const towers = [-1, 1].flatMap((x) => [-1, 1].map((z) => [x * towerX, z * towerZ] as const))
  const towerHeight = CANOPY.bottom - DECK.height

  return (
    <group>
      <mesh geometry={grassGeometry} receiveShadow>
        <meshStandardMaterial color="#2f5a22" roughness={1} />
      </mesh>

      <mesh geometry={deckRingGeometry} castShadow receiveShadow>
        <meshStandardMaterial color="#15171f" metalness={0.25} roughness={0.5} />
      </mesh>
      <mesh geometry={deckFloorGeometry} receiveShadow>
        <meshStandardMaterial color="#0b0d14" metalness={0.25} roughness={0.25} />
      </mesh>
      <mesh geometry={deckRimGeometry} position={[0, DECK.height, 0]}>
        <meshBasicMaterial color="#39e6c8" toneMapped={false} />
      </mesh>

      {towers.map(([x, z]) => (
        <mesh key={`${x}:${z}`} position={[x, DECK.height + towerHeight / 2, z]} castShadow>
          <boxGeometry args={[TOWER_WIDTH, towerHeight, TOWER_WIDTH]} />
          <meshStandardMaterial color="#101219" metalness={0.25} roughness={0.5} />
        </mesh>
      ))}

      <mesh position={[0, LED.bottom + LED.height / 2, 0]} castShadow>
        <boxGeometry args={[LED.width, LED.height, LED.depth]} />
        <meshStandardMaterial color="#05060b" emissive="#ffffff" emissiveMap={texture} emissiveIntensity={1.2} roughness={0.35} />
      </mesh>

      <mesh geometry={canopyGeometry} position={[0, CANOPY.bottom, 0]} castShadow>
        <meshStandardMaterial color="#12141c" metalness={0.25} roughness={0.5} />
      </mesh>
      <mesh geometry={canopyRimGeometry} position={[0, CANOPY.bottom, 0]}>
        <meshBasicMaterial color="#f4f7ff" toneMapped={false} />
      </mesh>
      {beams.length > 0 ? <BoxInstances boxes={beams} /> : null}

      {detail.bulbs > 0 ? (
        <>
          <Bulbs shape={canopyOuter} count={detail.bulbs} y={CANOPY.bottom + CANOPY.height + 0.2} color="#fff2cf" />
          <Bulbs shape={deckOuter} count={detail.bulbs} y={DECK.height + 0.35} color="#d8fff6" />
        </>
      ) : null}
    </group>
  )
}
