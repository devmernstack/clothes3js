// Garment patterns for the cloth simulation in Garment.js.
// World units, y up. Front pieces are drawn as seen from the front, back pieces as
// seen from behind (x mirrored), so left/right placement and lettering read
// correctly from that side. `sx` narrows the whole pattern horizontally.
//
// Each garment is a front and a back layer sewn together at the seams (open at
// the neck, hem, cuffs, waist...), plus overlays: separate pieces of fabric sewn
// on top (collar, yoke, pockets, cuffs, waistband, belt loops...). `lift` is how
// far an overlay sits above the layer under it.

const both = (fn) => [-1, 1].forEach(fn)
const clamp01 = (v) => Math.max(0, Math.min(1, v))
const bump = (y, top, bottom) => Math.sin(Math.PI * clamp01((top - y) / (top - bottom)))

// points along a quadratic curve a -> b with control point c
export const curve = (a, c, b, n = 14) => Array.from({ length: n + 1 }, (_, i) => {
  const t = i / n, u = 1 - t
  return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]
})

// a closed outline pulled in towards its centre, for edge stitching
const inset = (pts, d) => {
  const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length, cy = pts.reduce((a, p) => a + p[1], 0) / pts.length
  const q = pts.map(([x, y]) => { const dx = cx - x, dy = cy - y, l = Math.hypot(dx, dy) || 1; return [x + (dx / l) * d, y + (dy / l) * d] })
  return [...q, q[0]]
}

const distSeg = (px, py, [ax, ay], [bx, by]) => {
  const dx = bx - ax, dy = by - ay, t = clamp01(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy))
  return Math.hypot(px - ax - t * dx, py - ay - t * dy)
}

// ---------------- shirt ----------------

// shirt pattern pieces, shared with the workshop scene (Workshop.js)
export const shirtParts = {
  hemLine: (dy) => [...curve([-0.99, -1.5 + dy], [-0.69, -1.8 + dy], [0, -1.77 + dy], 8), ...curve([0, -1.77 + dy], [0.69, -1.8 + dy], [0.99, -1.5 + dy], 8).slice(1)],
  cuff: (s) => [[s * 2.05, -0.48], [s * 1.6, -0.76], [s * 1.46, -0.47], [s * 1.88, -0.21]],
  pocket: (x) => [[x - 0.24, 0.95], [x + 0.24, 0.95], [x + 0.24, 0.42], [x, 0.32], [x - 0.24, 0.42]],
  flap: (x) => [[x - 0.26, 0.99], [x + 0.26, 0.99], [x + 0.26, 0.84], [x, 0.75], [x - 0.26, 0.84]],
  leaf: (s) => [
    ...curve([s * 0.1, 1.44], [s * 0.25, 1.57], [s * 0.45, 1.58], 6),
    ...curve([s * 0.45, 1.58], [s * 0.44, 1.3], [s * 0.35, 1.04], 6).slice(1),
    [s * 0.06, 1.24],
  ],
}
export { inset }

// style: 'work' (horn buttons), 'western' (pearl snaps, pointed yokes), 'hunter' (flannel; colourway sets
// thread, sheen, inside colour and buttons)
export function shirt({ style = 'work', thread, sheen, reverse, fastener: fast } = {}) {
  const western = style === 'western', hunter = style === 'hunter'
  const fastener = fast ?? (western ? 'snap' : hunter ? 'horn' : 'button')

  const body = (neckY) => (c) => {
    c.moveTo(-0.32, 1.52); c.lineTo(-1.05, 1.36); c.lineTo(-2.0, -0.5); c.lineTo(-1.62, -0.72)
    c.lineTo(-1.0, 0.5); c.lineTo(-1.02, -1.55)
    c.quad(-0.7, -1.85, 0, -1.82); c.quad(0.7, -1.85, 1.02, -1.55)
    c.lineTo(1.0, 0.5); c.lineTo(1.62, -0.72); c.lineTo(2.0, -0.5); c.lineTo(1.05, 1.36); c.lineTo(0.32, 1.52)
    c.quad(0, neckY, -0.32, 1.52); c.close()
  }
  const { hemLine, cuff, pocket, leaf } = shirtParts
  const flap = (x) => western
    ? [[x - 0.27, 0.99], [x + 0.27, 0.99], [x + 0.27, 0.9], [x + 0.12, 0.87], [x, 0.74], [x - 0.12, 0.87], [x - 0.27, 0.9]]
    : shirtParts.flap(x)
  const frontYoke = (s) => [[s * 0.1, 1.42], [s * 0.33, 1.53], [s * 1.05, 1.37], [s * 1.04, 1.12], [s * 0.78, 1.1], [s * 0.55, 0.99], [s * 0.32, 1.1], [s * 0.1, 1.12]]
  const backYoke = western
    ? [[-1.08, 1.4], [-0.3, 1.56], [0, 1.5], [0.3, 1.56], [1.08, 1.4], [1.04, 1.06], [0.5, 1.0], [0, 0.84], [-0.5, 1.0], [-1.04, 1.06]]
    : [[-1.08, 1.4], [-0.3, 1.56], [0, 1.5], [0.3, 1.56], [1.08, 1.4], [1.04, 1.03], [-1.04, 1.03]]
  // sleeve placket: a strip running up the back of the sleeve from the cuff
  const placket = (s) => {
    const [bx, by] = [s * 1.67, -0.34], [dx, dy] = [-s * 0.455 * 0.36, 0.89 * 0.36], [wx, wy] = [0.89 * 0.032, s * 0.455 * 0.032]
    return [[bx - wx, by - wy], [bx + wx, by + wy], [bx + wx + dx, by + wy + dy], [bx - wx + dx, by - wy + dy]]
  }

  const seams = (p) => both((s) => {
    p.seam([[s * 1.05, 1.36], [s * 1.0, 0.5]], { stitch: 2, side: -s }) // armhole, topstitched
    p.stitch([[s * 0.36, 1.47], [s * 1.02, 1.31]]) // shoulder
    p.stitch([[s * 0.96, 0.44], [s * 0.98, -1.48]], { double: -s * 0.03 }) // flat-felled side seam
    p.stitch([[s * 1.06, 0.4], [s * 1.6, -0.64]]) // underarm
    p.stitch([[s * 1.08, 1.27], [s * 1.95, -0.42]]) // top of sleeve
    p.crease([[s * 1.28, 0.3], [s * 1.5, 0.12], [s * 1.62, 0.14]]) // elbow
    p.crease([[s * 1.45, -0.05], [s * 1.66, -0.2]])
  })

  return {
    hanger: 'shirt',
    ...(hunter && { thread, sheen, reverse, tile: 0.6 }), // one check repeat = 0.6 units
    bbox: [-2.15, -1.95, 2.15, 1.72],
    bulge: 0.1,
    outline: { front: body(1.12), back: body(1.44) },
    // edges that stay open instead of being sewn front-to-back
    opening: (x, y) => (y < -1.4 && Math.abs(x) < 1.06) || distSeg(Math.abs(x), y, [2.0, -0.5], [1.62, -0.72]) < 0.1,
    pin: (x, y) => Math.abs(x) < 1.0 && y > 1.2,
    paint: {
      front(p) { seams(p); p.stitch(hemLine(0.05), { double: 0.03 }) },
      back(p) {
        seams(p)
        both((s) => p.crease(western ? [[s * 0.1, 0.86], [s * 0.12, 0.3]] : [[s * 0.12, 1.02], [s * 0.13, 0.45]])) // box pleat
        p.stitch(hemLine(0.05), { double: 0.03 })
      },
      frontInner(p) {
        p.fill((c) => c.rect(-0.14, 1.6, 0.14, -1.9), p.denim) // button facing, outer face turned in
        both((s) => p.stitch([[s * 0.1, 1.3], [s * 0.1, -1.76]], { color: '#c9b79a' }))
      },
      backInner(p) {
        p.fill((c) => c.poly(backYoke), p.denim) // inner yoke
        p.label(0, 1.37, 0.26, 0.1, ['BHARAT MILL', 'M'])
      },
    },
    overlays: [
      {
        side: 'front', lift: 0.011,
        pieces: (c) => { c.rect(-0.1, 1.34, 0.1, -1.79); both((s) => { c.poly(pocket(s * 0.52)); c.poly(cuff(s)); if (western) c.poly(frontYoke(s)) }) },
        paint(p) {
          both((s) => p.stitch([[s * 0.075, 1.32], [s * 0.075, -1.76]])) // placket
          both((s) => {
            const x = s * 0.52
            p.stitch(inset(pocket(x), 0.022)); p.stitch(inset(pocket(x), 0.05))
            p.stitch([[x - 0.215, 0.905], [x + 0.215, 0.905]])
            p.bartack(x - 0.22, 0.93, 0.05, true); p.bartack(x + 0.22, 0.93, 0.05, true)
            p.stitch(inset(cuff(s), 0.03))
            if (western) p.stitch(inset(frontYoke(s), 0.025))
          })
        },
      },
      {
        // collar stand, wraps the neck under the collar
        side: 'front', lift: 0.015, clip: false,
        pieces: (c) => { c.moveTo(-0.33, 1.53); c.quad(0, 1.13, 0.33, 1.53); c.lineTo(0.31, 1.63); c.quad(0, 1.25, -0.31, 1.63); c.close() },
        paint(p) { p.stitch(curve([-0.31, 1.57], [0, 1.19], [0.31, 1.57])); p.stitch(curve([-0.3, 1.6], [0, 1.22], [0.3, 1.6])) },
      },
      {
        side: 'front', lift: (x, y) => 0.022 + 0.008 * clamp01((0.99 - y) / 0.25),
        pieces: (c) => both((s) => c.poly(flap(s * 0.52))),
        paint(p) { both((s) => { p.stitch(inset(flap(s * 0.52), 0.025)); p.buttonhole(s * 0.52, 0.81) }) },
      },
      {
        // collar leaves roll up off the chest towards the fold
        side: 'front', clip: false, lift: (x, y) => 0.022 + 0.024 * clamp01((y - 1.04) / 0.54),
        pieces: (c) => both((s) => c.poly(leaf(s))),
        paint(p) { both((s) => p.stitch(inset(leaf(s), 0.03))) },
      },
      {
        side: 'back', lift: 0.009,
        pieces: (c) => c.poly(backYoke),
        paint(p) { p.stitch(western ? [[-1.04, 1.09], [-0.5, 1.03], [0, 0.87], [0.5, 1.03], [1.04, 1.09]] : [[-1.04, 1.06], [1.04, 1.06]], { double: 0.03 }) },
      },
      {
        side: 'back', lift: 0.011,
        pieces: (c) => both((s) => { c.poly(cuff(s)); c.poly(placket(s)) }),
        paint(p) { both((s) => { p.stitch(inset(cuff(s), 0.03)); p.stitch(inset(placket(s), 0.012)) }) },
      },
      {
        side: 'back', lift: (x, y) => 0.014 + 0.016 * bump(y, 1.04, 0.88), // locker loop
        pieces: (c) => c.rect(-0.028, 1.04, 0.028, 0.88),
        paint(p) { p.bartack(0, 1.02, 0.05); p.bartack(0, 0.9, 0.05) },
      },
      {
        side: 'back', lift: 0.03, clip: false, // collar seen from behind
        pieces: (c) => { c.moveTo(-0.44, 1.6); c.quad(0, 1.52, 0.44, 1.6); c.lineTo(0.42, 1.41); c.quad(0, 1.3, -0.42, 1.41); c.close() },
        paint(p) { p.stitch(curve([-0.4, 1.44], [0, 1.34], [0.4, 1.44])) },
      },
    ],
    hardware: [
      ...[1.12, 0.66, 0.2, -0.26, -0.72, -1.18].map((y) => ({ side: 'front', x: 0, y, lift: 0.012, kind: fastener })),
      { side: 'front', x: 0, y: 1.385, lift: 0.017, kind: fastener },
      ...[-1, 1].map((s) => ({ side: 'front', x: s * 0.52, y: 0.81, lift: 0.031, kind: fastener })),
      ...[-1, 1].map((s) => ({ side: 'back', x: s * 1.74, y: -0.47, lift: 0.013, kind: fastener })),
      ...[-1, 1].map((s) => ({ side: 'back', x: s * 1.59, y: -0.18, lift: 0.013, kind: fastener })),
    ],
  }
}

// ---------------- jeans ----------------

export function jeans({ cuff = false, distressed = false } = {}) {
  const body = (rise) => (c) => {
    c.moveTo(-1.0, 1.7); c.quad(0, rise, 1.0, 1.7); c.quad(1.15, 1.0, 1.12, 0.5); c.lineTo(0.95, -2.1)
    c.lineTo(0.14, -2.1); c.lineTo(0.02, 0.3); c.quad(0, 0.22, -0.02, 0.3); c.lineTo(-0.14, -2.1)
    c.lineTo(-0.95, -2.1); c.lineTo(-1.12, 0.5); c.quad(-1.15, 1.0, -1.0, 1.7); c.close()
  }
  const waistband = (rise) => (c) => { c.moveTo(-1.05, 1.76); c.quad(0, rise, 1.05, 1.76); c.lineTo(1.05, 1.47); c.quad(0, rise - 0.24, -1.05, 1.47); c.close() }
  const waistStitch = (p, rise) => {
    p.stitch(curve([-1.05, 1.69], [0, rise - 0.07], [1.05, 1.69]))
    p.stitch(curve([-1.05, 1.5], [0, rise - 0.22], [1.05, 1.5]))
  }
  const lip = (s, c) => { c.moveTo(s * 1.13, 1.07); c.quad(s * 0.78, 1.07, s * 0.62, 1.52); c.lineTo(s * 0.53, 1.52); c.quad(s * 0.7, 0.97, s * 1.13, 0.97); c.close() }
  const coin = [[-0.62, 1.47], [-0.95, 1.47], [-0.95, 1.09], [-0.64, 1.11]]
  const backPocket = (s) => { const x = s * 0.52; return [[x - 0.3, 1.13], [x + 0.3, 1.11], [x + 0.27, 0.53], [x, 0.41], [x - 0.27, 0.54]] }
  const loops = (list) => ({
    clip: false,
    lift: (x, y) => { const top = list.reduce((a, l) => (Math.abs(l[0] - x) < Math.abs(a[0] - x) ? l : a))[1]; return 0.02 + 0.018 * bump(y, top, top - 0.34) },
    pieces: (c) => list.forEach(([x, top]) => c.rect(x - 0.045, top, x + 0.045, top - 0.34)),
    paint(p) { list.forEach(([x, top]) => { p.bartack(x, top - 0.04, 0.07); p.bartack(x, top - 0.3, 0.07); both((s) => p.stitch([[x + s * 0.03, top - 0.06], [x + s * 0.03, top - 0.28]])) }) },
  })
  const cuffs = (side) => ({
    side, lift: 0.02, clip: false, material: 'reverse', // turned-up hem shows the pale inside and the selvedge
    pieces: (c) => both((s) => c.poly([[s * 0.1, -2.14], [s * 0.99, -2.14], [s * 0.98, -1.86], [s * 0.11, -1.86]])),
    paint(p) {
      both((s) => {
        p.fill((c) => c.rect(s * 0.92, -2.14, s * 0.99, -1.86), '#ece9e1')
        p.fill((c) => c.rect(s * 0.948, -2.14, s * 0.958, -1.86), '#b3262c')
        p.stitch([[s * 0.13, -1.91], [s * 0.96, -1.91]], { color: '#c79a5a' })
        p.crease([[s * 0.12, -1.875], [s * 0.98, -1.875]])
      })
    },
  })
  const hem = (p) => both((s) => {
    if (cuff) return
    p.seam([[s * 0.15, -1.99], [s * 0.95, -1.99]], { stitch: 0 })
    p.stitch([[s * 0.15, -2.04], [s * 0.95, -2.04]])
  })
  const inseam = (p) => both((s) => p.stitch([[s * 0.125, -2.0], [s * 0.03, 0.32]], { double: -s * 0.03 }))

  return {
    hanger: 'clips',
    sx: 0.8,
    bbox: [-1.0, -2.2, 1.0, 1.95],
    bulge: 0.075,
    outline: { front: body(1.56), back: body(1.94) }, // the back rises higher than the front
    opening: (x, y) => y > 1.55 || y < -2.02,
    pin: (x, y) => y > 1.6 && Math.abs(Math.abs(x) - 0.72) < 0.09, // the two hanger clips
    holes: { front: distressed ? [[-0.48, -0.55, 0.2, 0.075], [0.55, 0.28, 0.1, 0.035], [-0.62, 0.66, 0.07, 0.025]] : [] },
    paint: {
      front(p) {
        both((s) => {
          // the cut-away pocket corner shows the facing underneath, in shadow
          p.ctx.save()
          p.clip((c) => { c.moveTo(s * 1.2, 1.07); c.quad(s * 0.78, 1.07, s * 0.62, 1.52); c.lineTo(s * 1.2, 1.8); c.close() })
          p.fill((c) => c.rect(-2, -3, 2, 3), 'rgba(0,0,12,.22)')
          p.ctx.restore()
          // wear: lighter thighs and knees, whiskers at the hips
          p.fade(s * 0.55, 0.42, 0.3, 0.55, distressed ? 0.34 : 0.24)
          p.fade(s * 0.52, -0.72, 0.26, 0.38, distressed ? 0.3 : 0.18)
          for (let k = 0; k < 5; k++) p.whisker([[s * 0.14, 0.92 - k * 0.09], [s * 0.36, 0.86 - k * 0.11], [s * (0.6 + k * 0.03), 0.96 - k * 0.15]], 0.028 - k * 0.003, 0.22)
        })
        inseam(p); hem(p)
        p.seam([[0.02, 0.44], [0.02, 0.3]], { stitch: 1, side: 1 })
      },
      back(p) {
        p.seam([[0, 1.13], [0, 0.3]], { stitch: 2, side: 1 }) // centre back seam
        both((s) => {
          for (let k = 0; k < 4; k++) p.whisker([[s * 0.3, -0.6 - k * 0.07], [s * 0.55, -0.57 - k * 0.07], [s * 0.82, -0.62 - k * 0.07]], 0.022, 0.16) // honeycombs
          p.fade(s * 0.5, 0.75, 0.32, 0.3, 0.14)
        })
        inseam(p); hem(p)
      },
      frontInner(p) {
        p.fill(waistband(1.58), p.denim)
        both((s) => {
          const bag = (c) => { c.moveTo(s * 0.32, 1.5); c.lineTo(s * 1.05, 1.5); c.lineTo(s * 1.02, 0.78); c.quad(s * 0.98, 0.46, s * 0.64, 0.5); c.quad(s * 0.33, 0.55, s * 0.32, 0.9); c.close() }
          p.fill(bag, '#e6e1d5'); p.twill(bag); p.edge(bag, 0.03, 0.25)
        })
        p.fill((c) => c.rect(-0.04, 1.5, -0.26, 0.72), p.denim) // fly shield
      },
      backInner(p) {
        p.fill(waistband(1.96), p.denim)
        p.label(0, 1.7, 0.24, 0.11, ['BHARAT MILL', 'W32 L34'])
      },
    },
    overlays: [
      {
        side: 'front', lift: 0.006, pieces: (c) => c.poly(coin),
        paint(p) { p.stitch(inset(coin, 0.02)); p.stitch([[-0.93, 1.42], [-0.64, 1.42]]) },
      },
      {
        side: 'front', lift: 0.009,
        pieces: (c) => { c.moveTo(0, 1.5); c.lineTo(0.21, 1.5); c.lineTo(0.21, 0.78); c.quad(0.21, 0.5, 0.02, 0.42); c.close() },
        paint(p) { p.stitch([[0.17, 1.47], [0.17, 0.78], [0.17, 0.55], [0.02, 0.47]], { curve: true }); p.bartack(0.07, 0.47, 0.07) }, // J-stitched fly
      },
      {
        side: 'front', lift: 0.011, pieces: (c) => both((s) => lip(s, c)), // front panel edge over the pocket opening
        paint(p) { both((s) => { p.stitch(curve([s * 1.13, 1.035], [s * 0.755, 1.035], [s * 0.59, 1.52])); p.stitch(curve([s * 1.13, 1.0], [s * 0.725, 1.0], [s * 0.56, 1.52])) }) },
      },
      { side: 'front', lift: 0.013, pieces: waistband(1.58), paint: (p) => waistStitch(p, 1.58) },
      ...(cuff ? [cuffs('front')] : []),
      { side: 'front', ...loops([[-0.95, 1.76], [-0.5, 1.76], [0.5, 1.76], [0.95, 1.76]]) },
      {
        side: 'back', lift: 0.007, pieces: (c) => c.poly([[-1.15, 1.52], [1.15, 1.52], [1.15, 1.3], [0, 1.12], [-1.15, 1.3]]), // yoke
        paint(p) { p.stitch([[-1.13, 1.33], [0, 1.155], [1.13, 1.33]], { double: 0.03 }) },
      },
      {
        side: 'back', lift: 0.012, pieces: (c) => both((s) => c.poly(backPocket(s))),
        paint(p) {
          both((s) => {
            const pk = backPocket(s), x = s * 0.52
            p.stitch(inset(pk, 0.022)); p.stitch(inset(pk, 0.048))
            p.stitch([[x - 0.28, 1.06], [x + 0.28, 1.04]], { double: -0.028 })
            for (const dy of [0, -0.032]) { // arcuate
              p.stitch(curve([x - 0.23, 0.97 + dy], [x - 0.11, 0.76 + dy], [x, 0.87 + dy]))
              p.stitch(curve([x, 0.87 + dy], [x + 0.11, 0.76 + dy], [x + 0.23, 0.97 + dy]))
            }
            p.bartack(x - 0.27, 1.1, 0.05, true); p.bartack(x + 0.27, 1.08, 0.05, true)
          })
        },
      },
      { side: 'back', lift: 0.013, pieces: waistband(1.96), paint: (p) => waistStitch(p, 1.96) },
      ...(cuff ? [cuffs('back')] : []),
      { side: 'back', ...loops([[-0.92, 1.78], [0, 1.88], [0.92, 1.78]]) },
      {
        side: 'back', lift: 0.024, material: 'leather', pieces: (c) => c.rect(0.4, 1.55, 0.82, 1.76),
        paint(p) {
          p.stitch(inset([[0.4, 1.55], [0.82, 1.55], [0.82, 1.76], [0.4, 1.76]], 0.018), { color: '#e3cfa4' })
          p.text('BHARAT MILL', 0.61, 1.68, 0.05, '#3a1f0e', { emboss: true })
          p.text('LOT 101 · SELVEDGE', 0.61, 1.615, 0.022, '#3a1f0e', { emboss: true })
        },
      },
    ],
    hardware: [
      { side: 'front', x: -0.02, y: 1.58, lift: 0.02, kind: 'shank' },
      ...[-1, 1].flatMap((s) => [{ side: 'front', x: s * 0.63, y: 1.4, lift: 0.017, kind: 'rivet' }, { side: 'front', x: s * 1.06, y: 1.02, lift: 0.017, kind: 'rivet' }]),
      { side: 'front', x: -0.65, y: 1.43, lift: 0.01, kind: 'rivet' },
      { side: 'front', x: -0.92, y: 1.43, lift: 0.01, kind: 'rivet' },
    ],
  }
}

export const GARMENTS = { shirt, jeans }
