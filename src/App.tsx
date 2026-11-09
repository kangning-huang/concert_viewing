import { Canvas } from '@react-three/fiber'
import { Suspense, useEffect, useMemo, useState } from 'react'
import { detectInitialTier, settingsFor, type QualityTier } from './quality'
import { Scene } from './Scene'
import { Hud } from './Hud'
import { SeatMapStart } from './SeatMapStart'

export type VenueId = 'nest' | 'wuxi'
export type SeatPreset = '贴脸' | '黄金角' | 'overview'
export type Phase = 'map' | 'view'

function parseSeatParam(): SeatPreset | null {
  if (typeof window === 'undefined') return null
  const q = new URLSearchParams(window.location.search).get('seat')
  if (q === '贴脸' || q === 'tie' || q === 'close') return '贴脸'
  if (q === '黄金角' || q === 'gold' || q === 'angle') return '黄金角'
  if (q === 'overview' || q === '全场' || q === 'all') return 'overview'
  return null
}

function parsePhaseParam(): Phase | null {
  if (typeof window === 'undefined') return null
  const v = new URLSearchParams(window.location.search).get('view')
  if (v === '1' || v === 'true' || v === '3d') return 'view'
  return null
}

/** Rough camera seeds for each preset — placeholder until bowl remesh. */
export function cameraForSeat(seat: SeatPreset): [number, number, number] {
  switch (seat) {
    case '贴脸':
      return [0, 6, 28]
    case '黄金角':
      return [42, 18, 38]
    default:
      return [0, 55, 95]
  }
}

export default function App() {
  const urlSeat = useMemo(() => parseSeatParam(), [])
  const [phase, setPhase] = useState<Phase>(() => (parsePhaseParam() && urlSeat ? 'view' : 'map'))
  const [venue, setVenue] = useState<VenueId>('wuxi')
  const [seat, setSeat] = useState<SeatPreset>(() => urlSeat ?? '黄金角')
  const [tier, setTier] = useState<QualityTier>(() => detectInitialTier())
  const [leaving, setLeaving] = useState(false)
  const quality = useMemo(() => settingsFor(tier), [tier])
  const cam = useMemo(() => cameraForSeat(seat), [seat])

  useEffect(() => {
    document.body.dataset.phase = phase
  }, [phase])

  function enterView() {
    if (leaving) return
    setLeaving(true)
    window.setTimeout(() => {
      setPhase('view')
      setLeaving(false)
    }, 420)
  }

  function backToMap() {
    setPhase('map')
  }

  return (
    <div className={`app-shell phase-${phase}`}>
      {phase === 'map' || leaving ? (
        <SeatMapStart
          seat={seat}
          onSeat={setSeat}
          onEnterView={enterView}
          leaving={leaving}
        />
      ) : null}

      {phase === 'view' ? (
        <>
          <Canvas
            dpr={[1, quality.dprCap]}
            gl={{ antialias: tier !== 'low', powerPreference: 'high-performance' }}
            camera={{ fov: seat === '贴脸' ? 58 : 50, near: 0.1, far: 2000, position: cam }}
            style={{ background: '#0b0c12' }}
          >
            <Suspense fallback={null}>
              <Scene
                venue={venue}
                seat={seat}
                quality={quality}
                onFpsHint={(fps) => {
                  void fps
                  void setTier
                }}
              />
            </Suspense>
          </Canvas>
          <Hud
            venue={venue}
            seat={seat}
            tier={tier}
            onVenue={setVenue}
            onSeat={setSeat}
            onTier={setTier}
            onBackMap={backToMap}
          />
        </>
      ) : null}
    </div>
  )
}
