/** Shared tour stage kit — identical every city (Nest photos transfer). */
export function SharedStage({ kitId }: { kitId: 'joker_xue_2026' }) {
  void kitId
  return (
    <group position={[0, 1.2, 0]}>
      {/* Main thrust / center stage block — placeholder until AAA GLB */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[28, 2.4, 18]} />
        <meshStandardMaterial color="#1a1d2a" metalness={0.35} roughness={0.55} />
      </mesh>
      {/* LED wall stub */}
      <mesh position={[0, 10, -8]} castShadow>
        <boxGeometry args={[36, 14, 0.6]} />
        <meshStandardMaterial color="#2a1030" emissive="#661133" emissiveIntensity={0.4} />
      </mesh>
      {/* Thrust runway */}
      <mesh position={[0, 0.6, 16]} castShadow receiveShadow>
        <boxGeometry args={[8, 1.2, 24]} />
        <meshStandardMaterial color="#222536" metalness={0.25} roughness={0.6} />
      </mesh>
    </group>
  )
}
