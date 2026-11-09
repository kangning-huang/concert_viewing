import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'

/** Restrained bloom for LEDs and bulbs. Lazy-loaded; never mounted on Medium/Low. */
export default function PostFx({ msaa }: { msaa: number }) {
  const gl = useThree((state) => state.gl)
  const scene = useThree((state) => state.scene)
  const camera = useThree((state) => state.camera)
  const size = useThree((state) => state.size)
  const dpr = useThree((state) => state.viewport.dpr)

  const composer = useMemo(() => {
    const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: msaa })
    const next = new EffectComposer(gl, target)
    next.addPass(new RenderPass(scene, camera))
    next.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), 0.34, 0.55, 0.92))
    next.addPass(new OutputPass())
    return next
  }, [gl, scene, camera, msaa])

  useEffect(() => {
    composer.setPixelRatio(dpr)
    composer.setSize(size.width, size.height)
  }, [composer, dpr, size])

  useEffect(() => () => composer.dispose(), [composer])

  // Priority > 0 takes over from R3F's default render.
  useFrame((_, delta) => composer.render(delta), 1)
  return null
}
