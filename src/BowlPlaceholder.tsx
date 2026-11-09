import type { VenueId } from './App'

/** Non-metric placeholder bowl — DO NOT treat as real geometry.
 * Remesh only after docs/refs/BOWL_PARAMS.md has cited meters for this venue. */
export function BowlPlaceholder({ venue }: { venue: VenueId }) {
  const color = venue === 'nest' ? '#1e2433' : '#182028'
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <ringGeometry args={[22, 90, 64]} />
        <meshStandardMaterial color={color} roughness={0.9} metalness={0.05} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
        <circleGeometry args={[22, 64]} />
        <meshStandardMaterial color="#0c1018" roughness={1} />
      </mesh>
    </group>
  )
}
