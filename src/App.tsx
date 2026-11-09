import { Canvas } from '@react-three/fiber'
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { detectInitialTier, maybeDowngrade, settingsFor, type QualityTier } from './quality'
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

export type SeatView = {
  eye: [number, number, number]
  target: [number, number, number]
  fov: number
  /** Portrait phones have a narrow horizontal view, so they get a wider vertical one. */
  portraitFov: number
  /** Stay in the seat and look around, instead of orbiting the stage. */
  lookAround: boolean
}

/**
 * NON-METRIC camera seeds, in the shared stage's scene units. Wuxi has no cited
 * tier height or rake (docs/refs/BOWL_PARAMS.md), so these are not real seats.
 *
 * 贴脸: standing eye height on the field just past the grass, front of the stage.
 * 1.65 is judged against people beside the deck in the Nest photos, not measured.
 * 黄金角: unchanged placeholder elevation; revisit after the Wuxi remesh.
 */
export function seatView(seat: SeatPreset): SeatView {
  switch (seat) {
    case '贴脸':
      return { eye: [0, 1.65, 29], target: [0, 14, 0], fov: 58, portraitFov: 70, lookAround: true }
    case '黄金角':
      return { eye: [42, 18, 38], target: [0, 13, 0], fov: 50, portraitFov: 72, lookAround: true }
    default:
      return { eye: [0, 55, 95], target: [0, 4, 0], fov: 50, portraitFov: 66, lookAround: false }
  }
}

/** Consecutive 1.5 s windows below the FPS floor before dropping a tier. */
const LOW_FPS_WINDOWS = 2

export default function App() {
  const urlSeat = useMemo(() => parseSeatParam(), [])
  const [phase, setPhase] = useState<Phase>(() => (parsePhaseParam() && urlSeat ? 'view' : 'map'))
  const [venue, setVenue] = useState<VenueId>('wuxi')
  const [seat, setSeat] = useState<SeatPreset>(() => urlSeat ?? '黄金角')
  const [tier, setTier] = useState<QualityTier>(() => detectInitialTier())
  const [leaving, setLeaving] = useState(false)
  const quality = useMemo(() => settingsFor(tier), [tier])
  const initialView = useMemo(() => seatView(seat), [])
  const lowWindows = useRef(0)
  const tierPicked = useRef(false)

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

  function handleFps(fps: number) {
    if (tierPicked.current) return
    lowWindows.current = fps < 45 ? lowWindows.current + 1 : 0
    if (lowWindows.current < LOW_FPS_WINDOWS) return
    lowWindows.current = 0
    setTier((current) => maybeDowngrade(current, fps))
  }

  function pickTier(next: QualityTier) {
    tierPicked.current = true
    setTier(next)
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
            shadows
            gl={{ antialias: tier !== 'low', powerPreference: 'high-performance' }}
            camera={{ fov: initialView.fov, near: 0.1, far: 2000, position: initialView.eye }}
            style={{ background: '#0b0c12' }}
          >
            <Suspense fallback={null}>
              <Scene
                venue={venue}
                seat={seat}
                quality={quality}
                onFpsHint={handleFps}
              />
            </Suspense>
          </Canvas>
          <Hud
            venue={venue}
            seat={seat}
            tier={tier}
            onVenue={setVenue}
            onSeat={setSeat}
            onTier={pickTier}
            onBackMap={backToMap}
          />
        </>
      ) : null}
    </div>
  )
}
