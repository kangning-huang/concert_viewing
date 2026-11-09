import { Environment, OrbitControls } from '@react-three/drei'
import type { QualitySettings } from './quality'
import type { SeatPreset, VenueId } from './App'
import { SharedStage } from './SharedStage'
import { BowlPlaceholder } from './BowlPlaceholder'

type Props = {
  venue: VenueId
  seat: SeatPreset
  quality: QualitySettings
  onFpsHint: (fps: number) => void
}

/** Placeholder scene until bowl params + XHS-grounded AAA remesh land. */
export function Scene({ venue, seat, quality, onFpsHint }: Props) {
  void seat
  void onFpsHint
  return (
    <>
      <color attach="background" args={['#05060b']} />
      <ambientLight intensity={0.35} />
      <hemisphereLight args={['#9fb4ff', '#2a2433', 1.4]} />
      <directionalLight
        castShadow={quality.shadows}
        position={[40, 80, 20]}
        intensity={1.2}
        shadow-mapSize-width={quality.shadows ? 2048 : 512}
        shadow-mapSize-height={quality.shadows ? 2048 : 512}
      />
      <SharedStage kitId="joker_xue_2026" quality={quality} />
      <BowlPlaceholder venue={venue} />
      {quality.postFx ? <Environment preset="night" /> : null}
      <OrbitControls enablePan enableZoom enableRotate maxPolarAngle={Math.PI * 0.49} />
    </>
  )
}
