import { Canvas } from '@react-three/fiber'
import { Suspense, useMemo, useState } from 'react'
import { detectInitialTier, settingsFor, type QualityTier } from './quality'
import { Scene } from './Scene'
import { Hud } from './Hud'

export type VenueId = 'nest' | 'wuxi'
export type SeatPreset = '贴脸' | '黄金角' | 'overview'

export default function App() {
  const [venue, setVenue] = useState<VenueId>('wuxi')
  const [seat, setSeat] = useState<SeatPreset>('黄金角')
  const [tier, setTier] = useState<QualityTier>(() => detectInitialTier())
  const quality = useMemo(() => settingsFor(tier), [tier])

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <Canvas
        dpr={[1, quality.dprCap]}
        gl={{ antialias: tier !== 'low', powerPreference: 'high-performance' }}
        camera={{ fov: 50, near: 0.1, far: 2000, position: [0, 40, 80] }}
        style={{ background: '#05060b' }}
      >
        <Suspense fallback={null}>
          <Scene venue={venue} seat={seat} quality={quality} onFpsHint={(fps) => {
            // Adaptive hook — Scene / Hud can call maybeDowngrade later
            void fps
            void setTier
          }} />
        </Suspense>
      </Canvas>
      <Hud
        venue={venue}
        seat={seat}
        tier={tier}
        onVenue={setVenue}
        onSeat={setSeat}
        onTier={setTier}
      />
    </div>
  )
}
