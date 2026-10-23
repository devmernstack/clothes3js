'use client'
import { Canvas, useFrame } from '@react-three/fiber'
import { Environment, Lightformer } from '@react-three/drei'
import { Suspense } from 'react'
import Garment from './Garment'
import Workshop from './Workshop'

// how far a section has come into view: 0 until its top reaches 90% of the screen, 1 by 40%
const entered = (id) => { const r = document.getElementById(id)?.getBoundingClientRect(); return r ? Math.min(1, Math.max(0, (innerHeight * 0.9 - r.top) / (innerHeight * 0.5))) : 0 }
// 0..1 while a section scrolls past the middle of the screen
const through = (id) => { const r = document.getElementById(id)?.getBoundingClientRect(); return r ? Math.min(1, Math.max(0, (innerHeight * 0.5 - r.top) / r.height)) : 0 }

// scroll position as story phases, read every frame
const phases = () => ({ settle: entered('cut'), cut: through('cut'), stitch: through('stitch'), hand: through('hand'), fit: through('fit'), buy: through('buy') })
const fit = () => through('fit')

// the piece crosses the screen from chapter to chapter, always opposite that chapter's text:
// right of the hero, centre for the cutting table, then left, right, left, right for buy,
// and over to the far right beside the footer.
// Small screens keep it centred above the text.
const SIDES = [['cut', 0.6], ['stitch', -1.6], ['hand', 1.6], ['fit', -1.6], ['buy', 1.6], ['footer', 2.5]]
const follow = (m, state) => {
  const p = phases(), small = state.size.width < 960
  const x = small ? 0 : SIDES.reduce((x, [id, to]) => x + (to - x) * ease(entered(id)), 1.6)
  const tiltX = -state.pointer.y * 0.1, tiltY = state.pointer.x * 0.12
  m.position.x += (x - m.position.x) * 0.07
  m.rotation.y += (tiltY - 0.45 * Math.sin(Math.PI * p.fit) + Math.PI * 2 * p.buy - m.rotation.y) * 0.06
  m.rotation.x += (tiltX - m.rotation.x) * 0.06
}
const ease = (t) => t * t * (3 - 2 * t)

// pull the camera back on tall screens so the whole piece fits, and raise it above the text
function Framing() {
  useFrame(({ camera, size }) => {
    const a = size.width / size.height
    camera.position.z = 6.2 * Math.min(2.1, Math.max(1, 0.95 / a))
    camera.position.y = a < 0.8 ? -2.3 : 0
  })
  return null
}

function Studio() {
  return (
    <>
      <ambientLight intensity={0.15} />
      <hemisphereLight args={['#fff6ea', '#5c4a36', 0.45]} />
      {/* key light, low and to the side so the weave and seams cast micro-shadows */}
      <directionalLight
        position={[2, 3, 6]} intensity={2.2} color="#fff4e6" castShadow
        shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} shadow-normalBias={0.02}
        shadow-camera-left={-5} shadow-camera-right={5} shadow-camera-top={5} shadow-camera-bottom={-5}
      />
      <spotLight position={[-4, 3, -3]} intensity={25} angle={0.6} penumbra={1} color="#ffe2c8" />
      <pointLight position={[4, -1, 2]} intensity={6} color="#ffb070" />
      {/* soft studio reflections (rendered locally, no HDR download) */}
      <Environment resolution={256}>
        <Lightformer form="rect" intensity={3} position={[0, 5, -5]} scale={[10, 4, 1]} />
        <Lightformer form="rect" intensity={2} color="#ffe9d6" position={[-5, 1, 0]} rotation-y={Math.PI / 2} scale={[8, 3, 1]} />
        <Lightformer form="rect" intensity={1.5} color="#ffcf9e" position={[5, 1, 0]} rotation-y={-Math.PI / 2} scale={[8, 3, 1]} />
      </Environment>
      {/* invisible wall that only shows the shadow */}
      <mesh position={[0, 0, -0.8]} receiveShadow>
        <planeGeometry args={[30, 30]} />
        <shadowMaterial opacity={0.16} color="#3b2f22" />
      </mesh>
    </>
  )
}

export default function Scene({ product, variant }) {
  return (
    <Canvas className="scene" shadows="percentage" camera={{ position: [0, 0, 6.2], fov: 50 }} dpr={[1, 2]}>
      <Framing />
      <Studio />
      <Suspense fallback={null}>
        <Workshop motion={follow} phases={phases} variant={variant} />
        <Garment product={product} variant={variant} motion={follow} fit={fit} />
      </Suspense>
    </Canvas>
  )
}
