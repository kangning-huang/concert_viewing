import { Environment, Lightformer, OrbitControls } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { lazy, Suspense, useEffect, useMemo, useRef, type RefObject } from 'react'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import type { QualitySettings } from './quality'
import { seatView, type SeatPreset, type VenueId } from './App'
import { SharedStage } from './SharedStage'
import { BowlPlaceholder } from './BowlPlaceholder'
import { skyTexture } from './stageTextures'

const PostFx = lazy(() => import('./PostFx'))

type Props = {
  venue: VenueId
  seat: SeatPreset
  quality: QualitySettings
  onFpsHint: (fps: number) => void
}

const FLY_SECONDS = 1.8
const FLY_START = new THREE.Vector3(0, 62, 120)
const FLY_START_TARGET = new THREE.Vector3(0, 6, 0)
/** Look-around orbits a point just ahead of the eye, so the camera stays in the seat. */
const LOOK_RADIUS = 0.1

type Flight = {
  elapsed: number
  duration: number
  fromPosition: THREE.Vector3
  fromTarget: THREE.Vector3
  fromFov: number
  toPosition: THREE.Vector3
  toTarget: THREE.Vector3
  toFov: number
  lookAround: boolean
}

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2
}

/** Fly from wherever the camera is to the seat, then hand over to the controls. */
function SeatCamera({ seat, controls }: { seat: SeatPreset; controls: RefObject<OrbitControlsImpl | null> }) {
  const camera = useThree((state) => state.camera) as THREE.PerspectiveCamera
  const flight = useRef<Flight | null>(null)
  const hasFlown = useRef(false)

  useEffect(() => {
    const view = seatView(seat)
    const first = !hasFlown.current
    hasFlown.current = true
    const skipFlight =
      new URLSearchParams(window.location.search).get('fly') === '0' ||
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    flight.current = {
      elapsed: 0,
      duration: skipFlight ? 0 : FLY_SECONDS,
      fromPosition: first ? FLY_START.clone() : camera.position.clone(),
      fromTarget: first || !controls.current ? FLY_START_TARGET.clone() : controls.current.target.clone(),
      fromFov: camera.fov,
      toPosition: new THREE.Vector3(...view.eye),
      toTarget: new THREE.Vector3(...view.target),
      toFov: camera.aspect < 1 ? view.portraitFov : view.fov,
      lookAround: view.lookAround,
    }
  }, [seat, camera, controls])

  useFrame((_, delta) => {
    const active = flight.current
    const orbit = controls.current
    if (!active || !orbit) return

    orbit.enabled = false
    // The polar limits would otherwise snap a floor camera that looks upward.
    orbit.minPolarAngle = 0.02
    orbit.maxPolarAngle = Math.PI - 0.02
    active.elapsed += Math.min(delta, 0.1)
    const progress = active.duration > 0 ? Math.min(active.elapsed / active.duration, 1) : 1
    const eased = easeInOutCubic(progress)
    camera.position.lerpVectors(active.fromPosition, active.toPosition, eased)
    orbit.target.lerpVectors(active.fromTarget, active.toTarget, eased)
    camera.fov = THREE.MathUtils.lerp(active.fromFov, active.toFov, eased)
    camera.updateProjectionMatrix()

    if (progress >= 1) {
      flight.current = null
      orbit.enabled = true
      orbit.enablePan = !active.lookAround
      orbit.enableZoom = !active.lookAround
      orbit.rotateSpeed = active.lookAround ? 0.45 : 1
      if (active.lookAround) {
        const forward = active.toTarget.clone().sub(active.toPosition).normalize()
        orbit.target.copy(active.toPosition).addScaledVector(forward, LOOK_RADIUS)
      } else {
        orbit.maxPolarAngle = Math.PI * 0.49
      }
    }
    orbit.update()
  })

  return null
}

const FPS_WINDOW_SECONDS = 1.5
const FPS_GRACE_SECONDS = 1.5

/** Reports average FPS, ignoring the shader-compile hitch after a tier change. */
function FpsMonitor({ tier, onFps }: { tier: QualitySettings['tier']; onFps: (fps: number) => void }) {
  const sample = useRef({ grace: FPS_GRACE_SECONDS, time: 0, frames: 0 })

  useEffect(() => {
    sample.current = { grace: FPS_GRACE_SECONDS, time: 0, frames: 0 }
  }, [tier])

  useFrame((_, delta) => {
    const current = sample.current
    if (delta > 0.5) {
      // Backgrounded tab or a one-off stall, not sustained load.
      current.time = 0
      current.frames = 0
      return
    }
    if (current.grace > 0) {
      current.grace -= delta
      return
    }
    current.time += delta
    current.frames += 1
    if (current.time >= FPS_WINDOW_SECONDS) {
      onFps(current.frames / current.time)
      current.time = 0
      current.frames = 0
    }
  })
  return null
}

/** The stage never moves, so its shadow map renders once per quality change. */
function StaticShadows({ quality }: { quality: QualitySettings }) {
  const gl = useThree((state) => state.gl)
  useEffect(() => {
    gl.shadowMap.autoUpdate = false
    gl.shadowMap.needsUpdate = true
  }, [gl, quality])
  return null
}

/** Local reflection probe rendered once; replaces the CDN-hosted HDR preset. */
function StageProbe() {
  return (
    <Environment frames={1} resolution={64}>
      <color attach="background" args={['#04050a']} />
      <Lightformer form="rect" intensity={3.2} color="#6f93ff" position={[0, 14, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[36, 20, 1]} />
      <Lightformer form="rect" intensity={1.4} color="#b58cff" position={[0, 6, 40]} rotation={[0, Math.PI, 0]} scale={[60, 8, 1]} />
      <Lightformer form="rect" intensity={1.4} color="#6fc7ff" position={[0, 6, -40]} scale={[60, 8, 1]} />
    </Environment>
  )
}

function Sky() {
  const texture = useMemo(() => skyTexture(), [])
  useEffect(() => () => texture.dispose(), [texture])
  return (
    <mesh renderOrder={-1}>
      <sphereGeometry args={[800, 24, 16]} />
      <meshBasicMaterial map={texture} side={THREE.BackSide} depthWrite={false} fog={false} toneMapped={false} />
    </mesh>
  )
}

/** Shared stage is photo-grounded; the bowl stays a non-metric placeholder until cited. */
export function Scene({ venue, seat, quality, onFpsHint }: Props) {
  const controls = useRef<OrbitControlsImpl>(null)
  return (
    <>
      <color attach="background" args={['#0b0c12']} />
      <fog attach="fog" args={['#0b0c12', 90, 260]} />
      <Sky />
      {/* Night show: emissives and baked spill carry the image; realtime light stays dim. */}
      <hemisphereLight args={['#5f73c8', '#141022', 0.45]} />
      <directionalLight
        castShadow={quality.shadows}
        position={[0, 24, 70]}
        intensity={1.5}
        color="#b9c8ff"
        shadow-mapSize-width={quality.shadowMapSize}
        shadow-mapSize-height={quality.shadowMapSize}
        shadow-camera-left={-45}
        shadow-camera-right={45}
        shadow-camera-top={40}
        shadow-camera-bottom={-20}
        shadow-camera-near={10}
        shadow-camera-far={140}
        shadow-bias={-0.0006}
      />
      <SharedStage kitId="joker_xue_2026" quality={quality} />
      <BowlPlaceholder venue={venue} quality={quality} />
      <OrbitControls ref={controls} target={[0, 6, 0]} />
      <SeatCamera seat={seat} controls={controls} />
      <FpsMonitor tier={quality.tier} onFps={onFpsHint} />
      {quality.shadows ? <StaticShadows quality={quality} /> : null}
      {quality.env ? <StageProbe /> : null}
      {quality.postFx ? (
        <Suspense fallback={null}>
          <PostFx msaa={quality.msaa} />
        </Suspense>
      ) : null}
    </>
  )
}
