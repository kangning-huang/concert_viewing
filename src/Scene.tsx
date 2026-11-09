import { Environment, OrbitControls } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import type { QualitySettings } from './quality'
import { cameraForSeat, type SeatPreset, type VenueId } from './App'
import { SharedStage } from './SharedStage'
import { BowlPlaceholder } from './BowlPlaceholder'

type Props = {
  venue: VenueId
  seat: SeatPreset
  quality: QualitySettings
  onFpsHint: (fps: number) => void
}

function SeatCamera({ seat }: { seat: SeatPreset }) {
  const { camera } = useThree()
  useEffect(() => {
    const [x, y, z] = cameraForSeat(seat)
    camera.position.set(x, y, z)
    camera.lookAt(0, 4, 0)
    camera.updateProjectionMatrix()
  }, [seat, camera])
  return null
}

/** Placeholder scene until bowl params + XHS-grounded AAA remesh land. */
export function Scene({ venue, seat, quality, onFpsHint }: Props) {
  void onFpsHint
  return (
    <>
      <color attach="background" args={['#0b0c12']} />
      <fog attach="fog" args={['#0b0c12', 80, 220]} />
      <ambientLight intensity={0.35} />
      <hemisphereLight args={['#9ec9e8', '#2a2433', 1.2]} />
      <directionalLight
        castShadow={quality.shadows}
        position={[40, 80, 20]}
        intensity={1.2}
        shadow-mapSize-width={quality.shadows ? 2048 : 512}
        shadow-mapSize-height={quality.shadows ? 2048 : 512}
      />
      <SharedStage kitId="joker_xue_2026" quality={quality} />
      <BowlPlaceholder venue={venue} />
      <SeatCamera seat={seat} />
      {quality.postFx ? <Environment preset="night" /> : null}
      <OrbitControls
        enablePan
        enableZoom
        enableRotate
        target={[0, 4, 0]}
        maxPolarAngle={Math.PI * 0.49}
      />
    </>
  )
}
