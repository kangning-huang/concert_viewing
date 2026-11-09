import { useEffect, useMemo } from 'react'
import type { VenueId } from './App'
import type { QualitySettings } from './quality'
import { crowdGlowTexture } from './stageTextures'

const INNER = 22
const OUTER = 90
/** Keep the sparkle off the area immediately around the stage. */
const CROWD_START = 44

/** Non-metric placeholder bowl — DO NOT treat as real geometry.
 * Remesh only after docs/refs/BOWL_PARAMS.md has cited meters for this venue.
 * The photoreal pass changes materials only: same flat ring, no seats, no rake,
 * and the light-stick texture does not describe seat positions. */
export function BowlPlaceholder({ venue, quality }: { venue: VenueId; quality: QualitySettings }) {
  const color = venue === 'nest' ? '#1e2433' : '#182028'
  const crowd = useMemo(() => crowdGlowTexture(quality.crowdTexture, CROWD_START / OUTER), [quality.crowdTexture])
  useEffect(() => () => crowd.dispose(), [crowd])
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <ringGeometry args={[INNER, OUTER, 64]} />
        <meshStandardMaterial color={color} roughness={1} metalness={0} envMapIntensity={0} emissive="#ffffff" emissiveMap={crowd} emissiveIntensity={quality.crowdTexture >= 1024 ? 0.9 : 0.55} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
        <circleGeometry args={[INNER, 64]} />
        <meshStandardMaterial color="#0c1018" roughness={1} />
      </mesh>
    </group>
  )
}
