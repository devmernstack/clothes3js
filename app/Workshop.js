'use client'
import { useFrame } from '@react-three/fiber'
import { Line, useTexture } from '@react-three/drei'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { curve, inset, shirtParts } from './garments'
import { fabric, TILE } from './fabric'
import { HARDWARE } from './Garment'

// The making of the shirt, chapters 1-3: the bolt of flannel, cutting the twelve pattern
// pieces, stitching them together, and the handwork. Everything is a pure function of the
// scroll phases, so scrolling back plays it in reverse.
//
// Pieces are drawn in their sewn-together (assembled) position. `d` is where each one is cut
// from the cloth: always a whole number of check repeats away, so a check matches once
// it's sewn, the way a careful cutter lays out plaid.

const { hemLine, cuff, pocket, flap, leaf } = shirtParts
const mirror = (pts) => pts.map(([x, y]) => [-x, y])
const neckF = curve([-0.32, 1.52], [0, 1.12], [0.32, 1.52], 16)
const neckB = curve([0.32, 1.52], [0, 1.44], [-0.32, 1.52], 12)
const hem = [...curve([-1.02, -1.55], [-0.7, -1.85], [0, -1.82], 10), ...curve([0, -1.82], [0.7, -1.85], [1.02, -1.55], 10).slice(1)]
const frontL = [[0.1, 1.338], ...neckF.filter(([x]) => x < 0.09).reverse(), [-1.05, 1.36], [-1.0, 0.5], [-1.02, -1.55], ...hem.filter(([x]) => x > -1.0 && x < 0.08), [0.1, -1.818]]
const back = [[-0.32, 1.52], [-1.05, 1.36], [-1.0, 0.5], ...hem, [1.0, 0.5], [1.05, 1.36], ...neckB.slice(0, -1)]
const sleeveL = [[-1.05, 1.36], [-2.0, -0.5], [-1.62, -0.72], [-1.0, 0.5]]
const stand = [...curve([-0.33, 1.53], [0, 1.13], [0.33, 1.53], 12), ...curve([0.31, 1.63], [0, 1.25], [-0.31, 1.63], 12)]

// convex hull (monotone chain): the outline the scissors follow round the three-part collar
const hull = (pts) => {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]), cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  const half = (list) => list.reduce((h, q) => { while (h.length > 1 && cross(h[h.length - 2], h[h.length - 1], q) <= 0) h.pop(); h.push(q); return h }, [])
  const lo = half(p), hi = half([...p].reverse())
  return [...lo.slice(0, -1), ...hi.slice(0, -1)]
}

const PIECES = [
  { shapes: [back], d: [-3.0, 0], z: -0.03 },
  { shapes: [frontL], d: [-0.6, 0], z: 0 },
  { shapes: [mirror(frontL)], d: [0.6, 0], z: 0.004 },
  { shapes: [sleeveL], d: [4.2, 0], z: 0.002 },
  { shapes: [mirror(sleeveL)], d: [2.4, 0], z: 0.002 },
  { shapes: [cuff(-1)], d: [3.6, 2.4], z: 0.008 },
  { shapes: [cuff(1)], d: [1.2, 2.4], z: 0.008 },
  { shapes: [pocket(-0.52)], d: [-1.2, 1.8], z: 0.01 },
  { shapes: [pocket(0.52)], d: [-1.2, 1.8], z: 0.01 },
  { shapes: [flap(-0.52)], d: [0.6, 1.2], z: 0.02, hinge: 0.99 },
  { shapes: [flap(0.52)], d: [0.6, 1.2], z: 0.02, hinge: 0.99 },
  { shapes: [leaf(-1), leaf(1), stand], d: [-3.0, 0.6], z: 0.03 },
].map((pc) => {
  // the closed cutting line, in assembled coordinates, with running lengths for even scissor speed
  const o = pc.shapes.length > 1 ? hull(pc.shapes.flat()) : pc.shapes[0], path = [...o, o[0]], run = [0]
  for (let i = 1; i < path.length; i++) run.push(run[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]))
  return { ...pc, path, run }
})
const SHEET = { x: 0.2, y: 0.6, w: 9.4, h: 5.8 }

const SEAMS = [
  ...[-1, 1].map((s) => [[s * 1.05, 1.36], [s * 1.0, 0.5]]), // armholes
  ...[-1, 1].map((s) => [[s * 0.36, 1.47], [s * 1.02, 1.31]]), // shoulders
  ...[-1, 1].map((s) => [[s * 0.075, 1.3], [s * 0.075, -1.76]]), // placket
  ...[-1, 1].map((s) => inset(cuff(s), 0.03)),
  ...[-1, 1].map((s) => inset(pocket(s * 0.52), 0.025)),
  hemLine(0.05),
  ...[-1, 1].map((s) => inset(leaf(s), 0.03)),
]
const BUTTONS = [[0, 1.385], ...[1.12, 0.66, 0.2, -0.26, -0.72, -1.18].map((y) => [0, y]), [-0.52, 0.81], [0.52, 0.81]]

const clamp = (v) => Math.min(1, Math.max(0, v))
const ease = (t) => t * t * (3 - 2 * t)
const lerp = (a, b, t) => a + (b - a) * t
const pop = (t) => (t <= 0 ? 0.0001 : t >= 1 ? 1 : 1 + 2.7 * (t - 1) ** 3 + 1.7 * (t - 1) ** 2) // ease-out-back
// reveal the first fraction t of a drei <Line>
const reveal = (line, t) => { if (line) { const n = line.userData.n ?? (line.userData.n = line.geometry.instanceCount); line.geometry.instanceCount = Math.round(n * clamp(t)) } }

// point and heading a fraction t along a polyline (by index, for seams)
const along = (pts, t) => {
  const i = Math.min(pts.length - 2, Math.floor(clamp(t) * (pts.length - 1))), f = clamp(t) * (pts.length - 1) - i
  return [lerp(pts[i][0], pts[i + 1][0], f), lerp(pts[i][1], pts[i + 1][1], f)]
}
// ... and by distance, for the scissors
const alongRun = ({ path, run }, t) => {
  const d = clamp(t) * run[run.length - 1]
  let i = 1
  while (i < run.length - 1 && run[i] < d) i++
  const f = (d - run[i - 1]) / (run[i] - run[i - 1] || 1), a = path[i - 1], b = path[i]
  return [lerp(a[0], b[0], f), lerp(a[1], b[1], f), Math.atan2(b[1] - a[1], b[0] - a[0])]
}

// tailor's shears lying flat on the cloth; the cut happens at the origin
function Shears({ inner }) {
  const blade = useMemo(() => new THREE.ExtrudeGeometry(new THREE.Shape([[0, 0.012], [0.46, 0.002], [0.46, -0.004], [0, -0.022]].map(([x, y]) => new THREE.Vector2(x, y))), { depth: 0.008, bevelEnabled: false }), [])
  const steel = <meshStandardMaterial color="#d9dadc" metalness={1} roughness={0.22} />
  const grip = <meshStandardMaterial color="#1b1b1d" roughness={0.45} />
  return (
    <group position={[-0.12, 0, 0]}>
      {[1, -1].map((s) => (
        <group key={s} ref={(el) => (inner.current[s > 0 ? 0 : 1] = el)}>
          <mesh geometry={blade} scale={[1, s, 1]} position={[0, 0, s > 0 ? 0.012 : 0.004]} castShadow>{steel}</mesh>
          <mesh position={[-0.2, s * 0.07, 0.01]} castShadow><torusGeometry args={[0.07, 0.018, 8, 24]} />{grip}</mesh>
          <mesh position={[-0.08, s * 0.03, 0.01]} rotation={[0, 0, s * 0.45]} castShadow><boxGeometry args={[0.16, 0.024, 0.014]} />{grip}</mesh>
        </group>
      ))}
      <mesh position={[0, 0, 0.022]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.014, 0.014, 0.012, 16]} />{steel}</mesh>
    </group>
  )
}

export default function Workshop({ motion, phases, variant }) {
  const [nor] = useTexture(['/textures/caban/nor.jpg'])
  const { pieceMat, sheetMat, waveGeo, wasteGeo, pieceGeos } = useMemo(() => {
    const map = new THREE.CanvasTexture(fabric(variant.id))
    map.colorSpace = THREE.SRGBColorSpace; map.wrapS = map.wrapT = THREE.RepeatWrapping; map.repeat.set(1 / TILE, 1 / TILE); map.anisotropy = 8
    const n = nor.clone(); n.wrapS = n.wrapT = THREE.RepeatWrapping; n.repeat.set(1 / 0.9, 1 / 0.9)
    const opts = { map, normalMap: n, normalScale: new THREE.Vector2(1.2, 1.2), roughness: 1, sheen: 0.8, sheenRoughness: 0.9, sheenColor: new THREE.Color(variant.sheen), side: THREE.DoubleSide }
    // the bolt, waving in the hero (uvs = world x/y so the cloth lines up with the pieces)
    const waveGeo = new THREE.PlaneGeometry(SHEET.w, SHEET.h, 90, 51).translate(SHEET.x, SHEET.y, -0.002)
    waveGeo.setAttribute('uv', new THREE.BufferAttribute(Float32Array.from({ length: waveGeo.attributes.position.count * 2 }, (_, i) => waveGeo.attributes.position.array[(i >> 1) * 3 + (i & 1)]), 2))
    waveGeo.userData.flat = waveGeo.attributes.position.array.slice()
    // the same cloth once on the table, with a hole where every piece is cut out
    const [x0, y0, x1, y1] = [SHEET.x - SHEET.w / 2, SHEET.y - SHEET.h / 2, SHEET.x + SHEET.w / 2, SHEET.y + SHEET.h / 2]
    const waste = new THREE.Shape([[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(([x, y]) => new THREE.Vector2(x, y)))
    waste.holes = PIECES.map((pc) => new THREE.Path(pc.path.slice(0, -1).map(([x, y]) => new THREE.Vector2(x + pc.d[0], y + pc.d[1]))))
    return {
      pieceMat: new THREE.MeshPhysicalMaterial(opts),
      sheetMat: new THREE.MeshPhysicalMaterial({ ...opts, transparent: true }),
      waveGeo,
      wasteGeo: new THREE.ShapeGeometry(waste).translate(0, 0, -0.002),
      // ShapeGeometry uvs are the shape's own x/y, i.e. assembled coordinates
      pieceGeos: PIECES.map((p) => new THREE.ShapeGeometry(p.shapes.map((s) => new THREE.Shape(s.map(([x, y]) => new THREE.Vector2(x, y)))))),
    }
  }, [nor, variant])
  const buttons = useMemo(() => BUTTONS.map(([x, y]) => {
    const b = HARDWARE[variant.fastener](); b.position.set(x, y, 0.035); b.rotation.x = Math.PI / 2; b.traverse((m) => (m.castShadow = true)); return b
  }), [variant])

  const root = useRef(), rig = useRef(), table = useRef(), wave = useRef(), waste = useRef(), needle = useRef(), shears = useRef(), blades = useRef([])
  const pieces = useRef([]), hinges = useRef([]), chalk = useRef([]), cuts = useRef([]), seams = useRef([])

  useFrame((state) => {
    const p = phases(), t = state.clock.elapsedTime, N = PIECES.length
    motion?.(root.current, state)
    root.current.visible = p.fit < 0.002
    if (!root.current.visible) return

    // rig: banner in the hero -> flat on the cutting table -> stood upright to sew -> close-up for handwork
    const lay = ease(p.settle), up = ease(clamp(p.stitch / 0.35)), zoom = Math.sin(Math.PI * p.hand)
    const r = rig.current
    r.rotation.x = -1.0 * lay * (1 - up)
    r.scale.setScalar(lerp(lerp(0.3, 0.56, lay), 0.88, up) * (1 + 0.4 * zoom))
    // the table comes forward so its far end isn't hidden behind the shadow wall
    r.position.set(lerp(state.size.width < 960 ? 0 : 1.15, -0.5, lay) * (1 - up), lerp(lerp(0.15, -0.5, lay), 0.35, up) - 0.9 * zoom, 1.6 * lay * (1 - up))

    // the bolt waves until it settles on the table; then the cut-up remnant stays until sewing starts
    const flat = waveGeo.userData.flat, a = waveGeo.attributes.position.array
    if (lay < 0.999) {
      for (let i = 0; i < a.length; i += 3) a[i + 2] = flat[i + 2] + (1 - lay) * (Math.sin(flat[i] * 1.1 + t) * 0.28 + Math.sin(flat[i + 1] * 1.9 + t * 1.3) * 0.12)
      waveGeo.attributes.position.needsUpdate = true; waveGeo.computeVertexNormals()
    }
    wave.current.visible = lay < 0.999
    waste.current.visible = lay >= 0.999 && up < 0.999
    sheetMat.opacity = 1 - up
    table.current.visible = lay > 0.01 && up < 0.999
    table.current.material.opacity = lay * (1 - up)

    // cutting: chalk every outline, then the shears follow each line in turn
    const chalkT = clamp(p.cut / 0.28) * N, cutT = clamp((p.cut - 0.3) / 0.6) * N
    let at = null
    PIECES.forEach((pc, i) => {
      const g = pieces.current[i], k = ease(clamp((p.stitch - 0.12 - i * 0.035) / 0.34)), cut = clamp(cutT - i)
      const freed = ease(clamp((cutT - i - 1) * 3)) // a piece lifts a little once it's cut free
      g.visible = lay > 0.999
      g.position.set(pc.d[0] * (1 - k), pc.d[1] * (1 - k), lerp(freed * 0.07, pc.z, k) + Math.sin(Math.PI * k) * 0.5)
      if (pc.hinge) hinges.current[i].rotation.x = Math.PI * 0.94 * k * (1 - ease(clamp(p.hand / 0.3))) // flaps arrive turned up, folded down by hand
      pc.shapes.forEach((_, j) => { const c = chalk.current[i * 4 + j]; reveal(c, chalkT - i); c.material.opacity = 1 - Math.max(up, freed) })
      reveal(cuts.current[i], cut); cuts.current[i].material.opacity = 1 - up
      if (cut > 0 && cut < 1) at = [...alongRun(pc, cut), pc.d]
    })
    shears.current.visible = !!at
    if (at) {
      shears.current.position.set(at[0] + at[3][0], at[1] + at[3][1], 0.02)
      shears.current.rotation.z = at[2]
      const snip = 0.06 + 0.22 * Math.abs(Math.sin(t * 9))
      blades.current[0].rotation.z = snip; blades.current[1].rotation.z = -snip
    }

    // seams are sewn one after another; the needle rides the one being sewn
    const sew = clamp((p.stitch - 0.55) / 0.42) * SEAMS.length
    let tip = null
    SEAMS.forEach((pts, i) => { const f = clamp(sew - i); reveal(seams.current[i], f); if (f > 0 && f < 1) tip = along(pts, f) })
    needle.current.visible = !!tip
    if (tip) needle.current.position.set(tip[0], tip[1] + 0.18, 0.06)

    buttons.forEach((b, i) => b.scale.setScalar(pop(clamp((p.hand - 0.25 - i * 0.055) / 0.12))))
  })

  return (
    <group ref={root}>
      <group ref={rig}>
        <mesh ref={table} position={[SHEET.x, SHEET.y, -0.03]} receiveShadow>
          <planeGeometry args={[SHEET.w + 1.2, SHEET.h + 1]} />
          <meshStandardMaterial color="#b08a62" roughness={0.75} transparent />
        </mesh>
        <mesh ref={wave} geometry={waveGeo} material={sheetMat} receiveShadow castShadow />
        <mesh ref={waste} geometry={wasteGeo} material={sheetMat} receiveShadow />
        {PIECES.map((pc, i) => (
          <group key={i} ref={(el) => (pieces.current[i] = el)}>
            <group position={[0, pc.hinge ?? 0, 0]} ref={(el) => (hinges.current[i] = el)}>
              <mesh position={[0, -(pc.hinge ?? 0), 0]} geometry={pieceGeos[i]} material={pieceMat} castShadow receiveShadow />
              {pc.shapes.map((s, j) => (
                <Line key={j} position={[0, -(pc.hinge ?? 0), 0.004]} points={[...s, s[0]].map(([x, y]) => [x, y, 0])} color={variant.chalk} lineWidth={1.6} transparent
                  ref={(el) => (chalk.current[i * 4 + j] = el)} />
              ))}
            </group>
          </group>
        ))}
        {/* the cut line opens up behind the shears (drawn on the table, so it stays where it was cut) */}
        {PIECES.map((pc, i) => (
          <Line key={i} position={[pc.d[0], pc.d[1], 0.006]} points={pc.path.map(([x, y]) => [x, y, 0])} color="#6b4f33" lineWidth={2.4} transparent
            ref={(el) => (cuts.current[i] = el)} />
        ))}
        <group ref={shears} scale={2.2}><Shears inner={blades} /></group>
        {SEAMS.map((pts, i) => (
          <Line key={i} position={[0, 0, 0.032]} points={pts.map(([x, y]) => [x, y, 0])} color={variant.thread} lineWidth={1.4} dashed dashSize={0.03} gapSize={0.02}
            ref={(el) => (seams.current[i] = el)} />
        ))}
        {buttons.map((b, i) => <primitive key={i} object={b} />)}
        <mesh ref={needle} rotation={[0, 0, 0.35]} castShadow>
          <cylinderGeometry args={[0.006, 0.0015, 0.36, 8]} />
          <meshStandardMaterial color="#e8e8e8" metalness={1} roughness={0.2} />
        </mesh>
      </group>
    </group>
  )
}
