'use client'
import { Canvas, useFrame } from '@react-three/fiber'
import { Environment, Lightformer, Sparkles, useTexture } from '@react-three/drei'
import { Suspense, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import Garment from './Garment'

const vertex = /* glsl */ `
  uniform float uTime, uHover;
  uniform vec2 uMouse;
  varying vec2 vUv;
  varying vec3 vPos;
  void main() {
    vUv = uv;
    vec3 p = position;
    float t = uTime * 0.8;
    // fabric drape, pinned at the top edge like a hanging garment
    float hang = 1.0 - uv.y;
    p.z += (sin(p.x * 1.5 + t) * 0.12 + sin(p.y * 2.5 + t * 1.3) * 0.06) * (0.3 + hang);
    // cursor ripple
    float d = distance(uv, uMouse);
    p.z += exp(-d * d * 30.0) * 0.25 * sin(d * 30.0 - uTime * 5.0) * uHover;
    vPos = (modelMatrix * vec4(p, 1.0)).xyz;
    gl_Position = projectionMatrix * viewMatrix * vec4(vPos, 1.0);
  }
`

const fragment = /* glsl */ `
  uniform sampler2D uTex, uPrev;
  uniform float uMix;
  varying vec2 vUv;
  varying vec3 vPos;
  void main() {
    // liquid wipe between old and new photo
    float wipe = smoothstep(uMix - 0.2, uMix, vUv.y + sin(vUv.x * 10.0) * 0.05);
    vec2 off = vec2(0.0, max(0.0, 1.0 - uMix) * 0.08 * (1.0 - wipe));
    vec3 a = texture2D(uPrev, vUv).rgb;
    vec3 b = texture2D(uTex, vUv + off).rgb;
    vec3 col = mix(b, a, wipe);
    // shade the folds so the photo reads as fabric
    vec3 n = normalize(cross(dFdx(vPos), dFdy(vPos)));
    col *= 0.75 + 0.35 * abs(dot(n, normalize(vec3(0.3, 0.6, 1.0))));
    gl_FragColor = vec4(col, 1.0);
  }
`

// mouse tilt, plus scroll-driven drift (and a full turn) on the home page, plus drag-to-turn
const follow = (scroll, base = 0, spin) => (m, state) => {
  const tiltX = -state.pointer.y * 0.12, tiltY = state.pointer.x * 0.2 + (spin?.current ?? 0)
  if (scroll) {
    const s = scrollY / (document.body.scrollHeight - innerHeight || 1)
    const turn = Math.PI * 2 * Math.min(1, Math.max(0, (s - 0.45) / 0.5)) // faces you through the collection, turns round in the story
    m.rotation.y += (tiltY - 0.35 + turn - m.rotation.y) * 0.05
    m.position.x += (1.6 - s * 3.2 - m.position.x) * 0.05
  } else {
    m.rotation.y += (tiltY + base - m.rotation.y) * 0.08
  }
  m.rotation.x += (tiltX - m.rotation.x) * 0.06
}

function PhotoCloth({ src, urls }) {
  const mesh = useRef()
  const textures = useTexture(urls)
  textures.forEach((t) => (t.colorSpace = THREE.SRGBColorSpace))
  const tex = textures[Math.max(0, urls.indexOf(src))]
  const motion = useMemo(() => follow(false), [])

  const uniforms = useMemo(() => ({
    uTime: { value: 0 }, uMix: { value: 1.25 }, uHover: { value: 0 },
    uMouse: { value: new THREE.Vector2(0.5, 0.5) },
    uTex: { value: tex }, uPrev: { value: tex },
  }), [])

  useEffect(() => {
    if (uniforms.uTex.value === tex) return
    uniforms.uPrev.value = uniforms.uTex.value
    uniforms.uTex.value = tex
    uniforms.uMix.value = 0
  }, [tex])

  useFrame((state, dt) => {
    const u = uniforms
    u.uTime.value += dt
    u.uMix.value = Math.min(1.25, u.uMix.value + dt * 1.2)
    u.uHover.value += ((mesh.current.userData.hover ? 1 : 0) - u.uHover.value) * 0.08
    motion(mesh.current, state)
  })

  return (
    <mesh
      ref={mesh}
      onPointerMove={(e) => { uniforms.uMouse.value.copy(e.uv); mesh.current.userData.hover = true }}
      onPointerOut={() => (mesh.current.userData.hover = false)}
    >
      <planeGeometry args={[3, 4, 120, 160]} />
      <shaderMaterial vertexShader={vertex} fragmentShader={fragment} uniforms={uniforms} side={THREE.DoubleSide} />
    </mesh>
  )
}

function Studio({ spin }) {
  const drag = useRef(null)
  return (
    <>
      <ambientLight intensity={0.15} />
      <hemisphereLight args={['#bcd0ff', '#1a1208', 0.35]} />
      {/* key light, low and to the side so the twill weave and seams cast micro-shadows */}
      <directionalLight
        position={[2, 3, 6]} intensity={2.2} color="#fff4e6" castShadow
        shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} shadow-normalBias={0.02}
        shadow-camera-left={-4} shadow-camera-right={4} shadow-camera-top={4} shadow-camera-bottom={-4}
      />
      {/* cool rim from behind to pick out the silhouette and fabric sheen */}
      <spotLight position={[-4, 3, -3]} intensity={25} angle={0.6} penumbra={1} color="#a9bfff" />
      <pointLight position={[4, -1, 2]} intensity={6} color="#ffb070" />
      {/* soft studio reflections (rendered locally, no HDR download) */}
      <Environment resolution={256}>
        <Lightformer form="rect" intensity={3} position={[0, 5, -5]} scale={[10, 4, 1]} />
        <Lightformer form="rect" intensity={2} color="#9db4ff" position={[-5, 1, 0]} rotation-y={Math.PI / 2} scale={[8, 3, 1]} />
        <Lightformer form="rect" intensity={1.5} color="#ffcf9e" position={[5, 1, 0]} rotation-y={-Math.PI / 2} scale={[8, 3, 1]} />
      </Environment>
      {/* invisible wall that only shows the garment's shadow */}
      {/* it also catches drags on empty space, which turn the garment */}
      <mesh
        position={[0, 0, -0.8]} receiveShadow
        onPointerDown={(e) => { if (!spin) return; drag.current = e.clientX; e.target.setPointerCapture(e.pointerId) }}
        onPointerMove={(e) => { if (drag.current === null) return; spin.current += (e.clientX - drag.current) * 0.01; drag.current = e.clientX }}
        onPointerUp={() => (drag.current = null)}
      >
        <planeGeometry args={[30, 30]} />
        <shadowMaterial opacity={0.2} />
      </mesh>
    </>
  )
}

// product: show the simulated 3D garment. photo + urls: show a photo on a waving cloth instead.
// turnable: dragging empty space spins the garment
export default function Scene({ product, photo, urls = [], scroll = false, turnable = false, className = 'scene' }) {
  const spin = useRef(0)
  const motion = useMemo(() => follow(scroll, -0.15, spin), [scroll])
  return (
    <Canvas className={className} shadows="percentage" camera={{ position: [0, 0, 6.2], fov: 50 }} dpr={[1, 2]}>
      <Studio spin={turnable ? spin : null} />
      <Suspense fallback={null}>
        {photo
          ? <PhotoCloth src={photo} urls={urls} />
          : <Garment key={product.slug} product={product} motion={motion} />}
      </Suspense>
      <Sparkles count={50} scale={[10, 6, 4]} size={2} speed={0.3} opacity={0.35} color="#9db4ff" />
    </Canvas>
  )
}
