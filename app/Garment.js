'use client'
import { useFrame } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import { Fragment, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { GARMENTS } from './garments'

// Denim is heavy and stiff: it hangs, sways a little and settles fast. Tune here.
const CELL = 0.08 // cloth grid spacing (world units)
const DENSITY = 300 // texture pixels per world unit
const STEP = 1 / 60
const ITER = 8
const GRAVITY = 5
const DAMPING = 0.94 // velocity kept per step; lower = less swing
const WIND = 0.12
const INERTIA = 0.3 // how much the cloth lags behind when the hanger moves
const SPIN_INERTIA = 0.08 // same, when the hanger turns (sleeves would fling out)
const MEMORY = 0.006 // denim keeps its shape: a weak pull back towards the resting drape
const MIN_GAP = 0.012 // front and back layers never pass through each other
const THREAD = '#d9923a'

const rng = (seed) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646

// ---------------- painting ----------------

const canvas = (w, h) => Object.assign(document.createElement('canvas'), { width: w, height: h })

// a texture-backed surface covering `bbox` ([x0, y0, x1, y1], in that side's view)
function surface(side, bbox, density) {
  const w = Math.max(8, Math.round((bbox[2] - bbox[0]) * density)), h = Math.max(8, Math.round((bbox[3] - bbox[1]) * density))
  return { side, bbox, w, h, color: canvas(w, h), alpha: canvas(w, h) }
}

// bounding box of a pieces() drawing, by recording its points
function bounds(G, fn) {
  const sx = G.sx ?? 1, b = [Infinity, Infinity, -Infinity, -Infinity]
  const add = (x, y) => { x *= sx; b[0] = Math.min(b[0], x); b[1] = Math.min(b[1], y); b[2] = Math.max(b[2], x); b[3] = Math.max(b[3], y) }
  fn({
    moveTo: add, lineTo: add, quad: (cx, cy, x, y) => { add(cx, cy); add(x, y) }, close() {},
    poly: (pts) => pts.forEach(([x, y]) => add(x, y)), rect: (a, b2, c, d) => { add(a, b2); add(c, d) },
    ellipse: (x, y, rx, ry) => { add(x - rx, y - ry); add(x + rx, y + ry) },
  })
  return [b[0] - 0.06, b[1] - 0.06, b[2] + 0.06, b[3] + 0.06]
}

// drawing helpers in garment coordinates. mirror: coordinates are given as seen from the other side
function painter(G, surf, el, diffuse, mirror = false) {
  const ctx = el.getContext('2d'), sx = G.sx ?? 1, m = mirror ? -1 : 1
  const [x0, y0, x1, y1] = surf.bbox, k = surf.w / (x1 - x0)
  const X = (x) => (m * x * sx - x0) * k, Y = (y) => (y1 - y) * k, S = (l) => l * k
  const denim = ctx.createPattern(diffuse, 'repeat')
  denim.setTransform(new DOMMatrix().scale(S(0.9) / diffuse.width))

  const api = {
    moveTo: (x, y) => ctx.moveTo(X(x), Y(y)),
    lineTo: (x, y) => ctx.lineTo(X(x), Y(y)),
    quad: (cx, cy, x, y) => ctx.quadraticCurveTo(X(cx), Y(cy), X(x), Y(y)),
    close: () => ctx.closePath(),
    poly: (pts) => { pts.forEach(([x, y], i) => ctx[i ? 'lineTo' : 'moveTo'](X(x), Y(y))); ctx.closePath() },
    rect: (a, b, c, d) => api.poly([[a, b], [c, b], [c, d], [a, d]]),
    ellipse: (x, y, rx, ry) => { ctx.moveTo(X(x) + S(rx * sx), Y(y)); ctx.ellipse(X(x), Y(y), S(rx * sx), S(ry), 0, 0, Math.PI * 2) },
  }
  const path = (fn) => { ctx.beginPath(); fn(api) }
  // polyline, or a smooth curve through the midpoints
  const trace = (pts, curve) => {
    ctx.beginPath(); ctx.moveTo(X(pts[0][0]), Y(pts[0][1]))
    if (curve && pts.length > 2) for (let i = 1; i < pts.length - 1; i++) {
      const [x, y] = pts[i], [nx, ny] = pts[i + 1], last = i === pts.length - 2
      ctx.quadraticCurveTo(X(x), Y(y), X(last ? nx : (x + nx) / 2), Y(last ? ny : (y + ny) / 2))
    }
    else for (const [x, y] of pts.slice(1)) ctx.lineTo(X(x), Y(y))
  }
  // offset a line sideways (positive = left of its direction)
  const shift = (pts, d) => {
    const [ax, ay] = pts[0], [bx, by] = pts[pts.length - 1], l = Math.hypot(bx - ax, by - ay) || 1
    return pts.map(([x, y]) => [x - ((by - ay) / l) * d, y + ((bx - ax) / l) * d])
  }

  const p = {
    ctx, X, Y, S, denim, path,
    fill(fn, style) { path(fn); ctx.fillStyle = style; ctx.fill() },
    clip(fn) { path(fn); ctx.clip() },
    // inside face of denim: the pale weft side
    reverse(fn) { p.fill(fn, denim); p.fill(fn, 'rgba(214,222,236,.62)') },
    stitch(pts, o = {}) {
      const run = (q) => {
        ctx.save(); ctx.lineCap = 'round'; ctx.setLineDash([S(0.03), S(0.02)])
        ctx.lineWidth = S(0.02); ctx.strokeStyle = 'rgba(0,0,20,.28)'; trace(q, o.curve); ctx.stroke() // thread sinks into the cloth
        ctx.lineWidth = S(0.011); ctx.strokeStyle = o.color || THREAD; trace(q, o.curve); ctx.stroke()
        ctx.translate(-S(0.002), -S(0.002)); ctx.lineWidth = S(0.004); ctx.strokeStyle = 'rgba(255,236,200,.5)'; trace(q, o.curve); ctx.stroke()
        ctx.restore()
      }
      run(pts)
      if (o.double) run(shift(pts, o.double === true ? 0.032 : o.double))
    },
    // folded seam: groove with a highlight, optional rows of topstitching on one side
    seam(pts, { curve, stitch = 1, side = 1 } = {}) {
      ctx.save(); ctx.lineCap = 'round'
      ctx.filter = `blur(${S(0.01)}px)`; ctx.lineWidth = S(0.045); ctx.strokeStyle = 'rgba(255,255,255,.1)'
      ctx.translate(S(0.015), -S(0.015)); trace(pts, curve); ctx.stroke(); ctx.translate(-S(0.015), S(0.015))
      ctx.filter = `blur(${S(0.004)}px)`; ctx.lineWidth = S(0.016); ctx.strokeStyle = 'rgba(0,0,12,.6)'; trace(pts, curve); ctx.stroke()
      ctx.restore()
      for (let i = 1; i <= stitch; i++) p.stitch(shift(pts, side * 0.03 * i), { curve })
    },
    crease(pts) {
      ctx.save(); ctx.lineCap = 'round'; ctx.filter = `blur(${S(0.012)}px)`
      ctx.lineWidth = S(0.03); ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.translate(S(0.012), -S(0.012)); trace(pts, true); ctx.stroke()
      ctx.translate(-S(0.012), S(0.012)); ctx.lineWidth = S(0.022); ctx.strokeStyle = 'rgba(0,0,15,.3)'; trace(pts, true); ctx.stroke()
      ctx.restore()
    },
    // darkened rim just inside a piece, like the roll of a folded edge
    edge(fn, w = 0.05, a = 0.45) {
      ctx.save(); p.clip(fn); ctx.filter = `blur(${S(w * 0.35)}px)`; ctx.lineWidth = S(w); ctx.strokeStyle = `rgba(0,0,15,${a})`; path(fn); ctx.stroke(); ctx.restore()
    },
    // soft shadow a piece sewn on top casts onto this surface
    contact(fn, a = 0.5) {
      ctx.save(); ctx.filter = `blur(${S(0.018)}px)`; ctx.translate(-S(0.008), S(0.016)); p.fill(fn, `rgba(0,0,10,${a})`); ctx.restore()
    },
    fade(x, y, rx, ry, a = 0.25) {
      ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.translate(X(x), Y(y)); ctx.scale((rx * sx) / ry, 1)
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, S(ry))
      g.addColorStop(0, `rgba(170,200,240,${a})`); g.addColorStop(1, 'rgba(170,200,240,0)')
      ctx.fillStyle = g; ctx.fillRect(-S(ry), -S(ry), S(ry) * 2, S(ry) * 2); ctx.restore()
    },
    whisker(pts, w, a) {
      ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.filter = `blur(${S(w * 0.6)}px)`; ctx.lineCap = 'round'
      ctx.lineWidth = S(w); ctx.strokeStyle = `rgba(190,210,245,${a})`; trace(pts, true); ctx.stroke(); ctx.restore()
    },
    bartack(x, y, len, vertical) {
      const h = len / 2, pts = vertical ? [[x, y - h], [x, y + h]] : [[x - h / sx, y], [x + h / sx, y]]
      ctx.save(); ctx.lineWidth = S(0.018); ctx.strokeStyle = 'rgba(0,0,20,.35)'; trace(pts); ctx.stroke()
      ctx.lineWidth = S(0.012); ctx.strokeStyle = THREAD; trace(pts); ctx.stroke(); ctx.restore()
    },
    buttonhole(x, y) {
      p.fill((c) => c.rect(x - 0.01, y + 0.035, x + 0.01, y - 0.035), THREAD)
      p.fill((c) => c.rect(x - 0.003, y + 0.03, x + 0.003, y - 0.03), 'rgba(0,0,10,.8)')
    },
    text(str, x, y, size, color, o = {}) {
      ctx.save(); ctx.translate(X(x), Y(y)); if (mirror) ctx.scale(-1, 1)
      ctx.font = `${o.weight ?? 700} ${S(size)}px Helvetica, Arial, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      if (o.emboss) {
        ctx.fillStyle = 'rgba(255,220,180,.35)'; ctx.fillText(str, S(0.003), S(0.003))
        ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillText(str, -S(0.002), -S(0.002))
      }
      ctx.fillStyle = color; ctx.fillText(str, 0, 0); ctx.restore()
    },
    // woven brand label
    label(x, y, w, h, lines) {
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = S(0.015); ctx.shadowOffsetY = S(0.006)
      p.fill((c) => c.rect(x - w / 2, y - h / 2, x + w / 2, y + h / 2), '#efe9dc'); ctx.restore()
      lines.forEach((t, i) => p.text(t, x, y + h * (0.16 - i * 0.36), h * (i ? 0.22 : 0.3), '#1b2a52', { weight: i ? 500 : 800 }))
      for (const s of [-1, 1]) p.stitch([[x + s * (w / 2 - 0.012), y - h / 2], [x + s * (w / 2 - 0.012), y + h / 2]], { color: '#d8cfbd' })
    },
    leather(fn) {
      p.fill(fn, '#7b4a2a')
      ctx.save(); p.clip(fn); const r = rng(7)
      for (let i = 0; i < 5000; i++) { ctx.fillStyle = r() > 0.5 ? 'rgba(0,0,0,.14)' : 'rgba(255,220,180,.08)'; ctx.fillRect(r() * surf.w, r() * surf.h, S(0.007), S(0.007)) }
      ctx.restore()
    },
    // fine diagonal weave for cotton pocketing
    twill(fn) {
      ctx.save(); p.clip(fn); ctx.strokeStyle = 'rgba(80,70,60,.12)'; ctx.lineWidth = S(0.003)
      for (let d = -surf.h; d < surf.w; d += S(0.012)) { ctx.beginPath(); ctx.moveTo(d, 0); ctx.lineTo(d + surf.h, surf.h); ctx.stroke() }
      ctx.restore()
    },
  }
  return p
}

// rips with white weft threads left spanning the hole (cut from the alpha too)
function paintHoles(p, list, alpha) {
  const { ctx, X, Y, S } = p
  list.forEach(([x, y, rx, ry], n) => {
    const r = rng(n + 11)
    ctx.save()
    if (alpha) { ctx.globalCompositeOperation = 'destination-out'; p.fill((c) => c.ellipse(x, y, rx, ry), '#000'); ctx.globalCompositeOperation = 'source-over' }
    else p.fade(x, y, rx * 1.6, ry * 2.4, 0.35)
    ctx.save(); p.clip((c) => c.ellipse(x, y, rx * 1.02, ry * 1.02))
    ctx.strokeStyle = alpha ? '#fff' : '#ebe6da'; ctx.lineWidth = S(0.009)
    for (let t = y - ry; t <= y + ry; t += 0.019) {
      ctx.beginPath(); ctx.moveTo(X(x - rx * 1.1), Y(t + (r() - 0.5) * 0.006))
      ctx.quadraticCurveTo(X(x), Y(t - 0.008 - r() * 0.01), X(x + rx * 1.1), Y(t + (r() - 0.5) * 0.006)); ctx.stroke()
    }
    ctx.restore()
    ctx.lineWidth = S(0.004); ctx.strokeStyle = alpha ? '#fff' : 'rgba(235,230,218,.9)'
    for (let i = 0; i < 70; i++) {
      const a = r() * Math.PI * 2, ex = x + Math.cos(a) * rx, ey = y + Math.sin(a) * ry, l = 0.02 + r() * 0.03, f = 0.5 + r()
      ctx.beginPath(); ctx.moveTo(X(ex), Y(ey)); ctx.lineTo(X(ex - Math.cos(a) * l * f), Y(ey - Math.sin(a) * l * 0.4)); ctx.stroke()
    }
    ctx.restore()
  })
}

function paintBody(G, side, surf, diffuse, overlays) {
  const outline = G.outline[side], holes = G.holes?.[side] ?? []
  const p = painter(G, surf, surf.color, diffuse)
  p.ctx.fillStyle = p.denim; p.ctx.fillRect(0, 0, surf.w, surf.h)
  p.ctx.save(); p.clip(outline)
  G.paint[side]?.(p)
  for (const o of overlays) p.contact(o.pieces)
  paintHoles(p, holes, false)
  p.edge(outline, 0.1, 0.5)
  p.ctx.restore()
  const a = painter(G, surf, surf.alpha, diffuse)
  a.fill(outline, '#fff'); paintHoles(a, holes, true)
}

// inside face, seen through the neck, hem and waist openings
function paintInner(G, side, surf, diffuse) {
  const outline = G.outline[side], p = painter(G, surf, surf.color, diffuse, side === 'back')
  p.ctx.save(); p.clip(outline); p.reverse((c) => c.rect(-9, -9, 9, 9))
  G.paint[side + 'Inner']?.(p)
  // overlocked seam allowances round the edge
  p.ctx.lineWidth = p.S(0.12); p.ctx.strokeStyle = '#33405c'; p.path(outline); p.ctx.stroke()
  p.ctx.setLineDash([p.S(0.006), p.S(0.006)]); p.ctx.lineWidth = p.S(0.1); p.ctx.strokeStyle = 'rgba(230,225,215,.35)'; p.path(outline); p.ctx.stroke()
  p.ctx.restore()
}

function paintOverlay(G, o, surf, diffuse, above) {
  const p = painter(G, surf, surf.color, diffuse)
  p.ctx.save(); p.clip(o.pieces)
  if (o.material === 'leather') p.leather(o.pieces)
  else if (o.material === 'reverse') p.reverse(o.pieces)
  else p.fill(o.pieces, p.denim)
  o.paint?.(p)
  for (const u of above) p.contact(u.pieces, 0.45)
  p.edge(o.pieces, 0.045, o.material === 'leather' ? 0.35 : 0.5)
  p.ctx.restore()
  const a = painter(G, surf, surf.alpha, diffuse)
  a.fill(o.pieces, '#fff')
  if (o.clip !== false) { a.ctx.globalCompositeOperation = 'destination-in'; a.fill(G.outline[o.side], '#fff') }
}

// read a surface's alpha at a garment-space point
function sampler(surf) {
  const { w, h, bbox: [x0, y0, x1, y1], side } = surf
  const data = surf.alpha.getContext('2d').getImageData(0, 0, w, h).data
  return (x, y) => {
    const u = ((side === 'back' ? -x : x) - x0) / (x1 - x0), v = (y1 - y) / (y1 - y0)
    return u >= 0 && v >= 0 && u < 1 && v < 1 && data[(((v * h) | 0) * w + ((u * w) | 0)) * 4 + 3] > 127
  }
}

// ---------------- simulation ----------------

function buildSim(G, samplers) {
  const [minX, minY, maxX, maxY] = G.bbox
  const nx = Math.round((maxX - minX) / CELL), ny = Math.round((maxY - minY) / CELL)
  const dx = (maxX - minX) / nx, dy = (maxY - minY) / ny, n1 = nx + 1, count = n1 * (ny + 1)
  const id = (i, j) => j * n1 + i
  const X = (k) => minX + (k % n1) * dx, Y = (k) => maxY - Math.floor(k / n1) * dy

  // which grid cells a surface covers, and the triangles for them
  const cells = (sample, side) => {
    const cell = new Uint8Array(nx * ny), on = new Uint8Array(count), index = []
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      let hit = false
      for (let a = 0; a <= 6 && !hit; a++) for (let b = 0; b <= 6 && !hit; b++) hit = sample(minX + (i + a / 6) * dx, maxY - (j + b / 6) * dy)
      if (!hit) continue
      cell[j * nx + i] = 1
      const q = [id(i, j), id(i + 1, j), id(i, j + 1), id(i + 1, j + 1)]
      q.forEach((k) => (on[k] = 1))
      index.push(...(side === 'front' ? [q[0], q[2], q[1], q[1], q[2], q[3]] : [q[0], q[1], q[2], q[1], q[3], q[2]]))
    }
    const c = (i, j) => i >= 0 && j >= 0 && i < nx && j < ny && cell[j * nx + i] === 1
    const edge = (k) => { const i = k % n1, j = (k / n1) | 0; return !(c(i - 1, j - 1) && c(i, j - 1) && c(i - 1, j) && c(i, j)) }
    return { side, c, on, index, edge }
  }
  const F = cells(samplers.front, 'front'), B = cells(samplers.back, 'back')

  // seams: outline points shared by front and back that aren't openings
  const seam = new Uint8Array(count)
  for (let k = 0; k < count; k++) seam[k] = F.on[k] && B.on[k] && F.edge(k) && B.edge(k) && !G.opening(X(k), Y(k)) ? 1 : 0

  // resting volume: layers part further the further they are from a seam
  const dist = new Float32Array(count).fill(Infinity), queue = []
  for (let k = 0; k < count; k++) if (seam[k]) { dist[k] = 0; queue.push(k) }
  for (let h = 0; h < queue.length; h++) {
    const k = queue[h], i = k % n1
    for (const m of [i > 0 ? k - 1 : -1, i < nx ? k + 1 : -1, k - n1, k + n1]) {
      if (m < 0 || m >= count || !(F.on[m] || B.on[m]) || dist[m] <= dist[k] + 1) continue
      dist[m] = dist[k] + 1; queue.push(m)
    }
  }

  const N = count * 2, pos = new Float32Array(N * 3), pinned = new Uint8Array(N), on = new Uint8Array(N)
  const layers = [[F, 0, 1], [B, count, -1]]
  for (const [L, base, sgn] of layers) for (let k = 0; k < count; k++) {
    const d = dist[k] === Infinity ? 0 : dist[k] * CELL
    pos.set([X(k), Y(k), L.on[k] ? sgn * G.bulge * (1 - Math.exp(-d / 0.3)) : 0], (base + k) * 3)
    on[base + k] = L.on[k]
  }
  // pin the topmost point of each column where the hanger holds it
  for (const [L, base] of layers) for (let i = 0; i < n1; i++) for (let j = 0; j <= ny; j++) {
    const k = id(i, j)
    if (!L.on[k]) continue
    if (G.pin(X(k), Y(k))) {
      const z = (base + k) * 3 + 2
      pinned[base + k] = 1; pos[z] = Math.sign(pos[z]) * Math.min(Math.abs(pos[z]), 0.02)
    }
    break
  }

  const len = (a, b) => Math.hypot(pos[a * 3] - pos[b * 3], pos[a * 3 + 1] - pos[b * 3 + 1], pos[a * 3 + 2] - pos[b * 3 + 2])
  const links = []
  for (const [L, base] of layers) {
    const hE = (i, j) => L.c(i, j - 1) || L.c(i, j), vE = (i, j) => L.c(i - 1, j) || L.c(i, j)
    const link = (a, b) => links.push(base + a, base + b, len(base + a, base + b))
    for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
      const k = id(i, j)
      if (!L.on[k]) continue
      if (i < nx && hE(i, j)) link(k, k + 1)
      if (j < ny && vE(i, j)) link(k, k + n1)
      if (L.c(i, j)) { link(k, k + n1 + 1); link(k + 1, k + n1) } // shear
      if (i < nx - 1 && hE(i, j) && hE(i + 1, j)) link(k, k + 2) // bending
      if (j < ny - 1 && vE(i, j) && vE(i, j + 1)) link(k, k + 2 * n1)
    }
  }

  const welds = [], gaps = []
  for (let k = 0; k < count; k++) {
    if (seam[k]) welds.push(k, count + k)
    else if (F.on[k] && B.on[k]) gaps.push(k, count + k)
  }

  // tether every point to its nearest pin so the weight can't stretch the denim
  const free = [], tether = new Int32Array(N).fill(-1), tlen = new Float32Array(N)
  for (const [, base] of layers) {
    const pins = []
    for (let k = base; k < base + count; k++) if (pinned[k]) pins.push(k)
    for (let k = base; k < base + count; k++) {
      if (!on[k] || pinned[k]) continue
      free.push(k)
      let best = -1, bd = Infinity
      for (const q of pins) { const d = len(k, q); if (d < bd) { bd = d; best = q } }
      tether[k] = best; tlen[k] = bd * 1.04
    }
  }

  // nearest covered point of a layer, for things sewn onto it
  const nearest = (L, k) => {
    const ci = k % n1, cj = (k / n1) | 0
    for (let r = 0; r < 10; r++) {
      let best = -1, bd = Infinity
      for (let j = cj - r; j <= cj + r; j++) for (let i = ci - r; i <= ci + r; i++) {
        if (i < 0 || j < 0 || i > nx || j > ny || !L.on[id(i, j)]) continue
        const d = (i - ci) ** 2 + (j - cj) ** 2
        if (d < bd) { bd = d; best = id(i, j) }
      }
      if (best >= 0) return best
    }
    return k
  }
  const at = (x, y) => id(Math.max(0, Math.min(nx, Math.round((x - minX) / dx))), Math.max(0, Math.min(ny, Math.round((maxY - y) / dy))))

  return {
    pos, prev: pos.slice(), rest: pos.slice(), pinned, on, count, X, Y, F, B, cells, nearest, at,
    links: new Float32Array(links), welds: new Int32Array(welds), gaps: new Int32Array(gaps), free: new Int32Array(free), tether, tlen,
  }
}

function step(s, t, grab) {
  const { pos, prev, rest, pinned, free, links, welds, gaps, tether, tlen } = s
  const g = GRAVITY * STEP * STEP, w = WIND * STEP * STEP
  for (let f = 0; f < free.length; f++) {
    const i = free[f] * 3, x = pos[i], y = pos[i + 1], z = pos[i + 2]
    const gust = Math.sin(t * 0.7 + x * 0.5) * 0.7 + Math.sin(t * 1.6 + y * 0.9) * 0.3
    pos[i] += (x - prev[i]) * DAMPING
    pos[i + 1] += (y - prev[i + 1]) * DAMPING - g
    pos[i + 2] += (z - prev[i + 2]) * DAMPING + gust * w
    prev[i] = x; prev[i + 1] = y; prev[i + 2] = z
    pos[i] += (rest[i] - pos[i]) * MEMORY; pos[i + 1] += (rest[i + 1] - pos[i + 1]) * MEMORY; pos[i + 2] += (rest[i + 2] - pos[i + 2]) * MEMORY
  }
  for (let it = 0; it < ITER; it++) {
    for (let l = 0; l < links.length; l += 3) {
      const ka = links[l], kb = links[l + 1], a = ka * 3, b = kb * 3
      const ex = pos[b] - pos[a], ey = pos[b + 1] - pos[a + 1], ez = pos[b + 2] - pos[a + 2]
      const d = Math.sqrt(ex * ex + ey * ey + ez * ez) || 1e-6
      const wa = pinned[ka] ? 0 : 1, wb = pinned[kb] ? 0 : 1
      if (!(wa + wb)) continue
      const c = (d - links[l + 2]) / d / (wa + wb)
      pos[a] += ex * c * wa; pos[a + 1] += ey * c * wa; pos[a + 2] += ez * c * wa
      pos[b] -= ex * c * wb; pos[b + 1] -= ey * c * wb; pos[b + 2] -= ez * c * wb
    }
    // seams: front and back are sewn together
    for (let q = 0; q < welds.length; q += 2) {
      const a = welds[q] * 3, b = welds[q + 1] * 3
      for (let c = 0; c < 3; c++) pos[a + c] = pos[b + c] = (pos[a + c] + pos[b + c]) / 2
    }
    // layers can't pass through each other
    for (let q = 0; q < gaps.length; q += 2) {
      const a = gaps[q] * 3 + 2, b = gaps[q + 1] * 3 + 2, d = pos[a] - pos[b]
      if (d < MIN_GAP) { const c = (MIN_GAP - d) / 2; pos[a] += c; pos[b] -= c }
    }
    for (let f = 0; f < free.length; f++) {
      const k = free[f], q = tether[k]
      if (q < 0) continue
      const i = k * 3, j = q * 3, ex = pos[i] - pos[j], ey = pos[i + 1] - pos[j + 1], ez = pos[i + 2] - pos[j + 2]
      const d = Math.sqrt(ex * ex + ey * ey + ez * ez)
      if (d > tlen[k]) { const c = (d - tlen[k]) / d; pos[i] -= ex * c; pos[i + 1] -= ey * c; pos[i + 2] -= ez * c }
    }
    // a held point follows the cursor softly; denim resists being pulled
    if (grab.k >= 0) { const i = grab.k * 3; for (let c = 0; c < 3; c++) pos[i + c] += (grab.target[c] - pos[i + c]) * 0.2 }
  }
  for (let k = 0; k < pinned.length; k++) if (pinned[k]) for (let c = 0; c < 3; c++) pos[k * 3 + c] = rest[k * 3 + c]
}

// ---------------- materials & hardware ----------------

function clothMaterial(map, alphaMap, nor, rough, o = {}) {
  const leather = o.material === 'leather'
  return new THREE.MeshPhysicalMaterial({
    map, alphaMap, alphaTest: 0.5, side: o.side ?? THREE.FrontSide, shadowSide: THREE.DoubleSide,
    normalMap: leather ? null : nor, normalScale: new THREE.Vector2(1.3, 1.3),
    roughnessMap: leather ? null : rough, roughness: leather ? 0.55 : 1,
    sheen: leather ? 0 : 1, sheenRoughness: 0.8, sheenColor: new THREE.Color(o.inner ? '#c9d4ea' : '#8fa8d8'),
    clearcoat: leather ? 0.25 : 0, clearcoatRoughness: 0.6,
    polygonOffset: !!o.depth, polygonOffsetFactor: -(o.depth ?? 0), polygonOffsetUnits: -(o.depth ?? 0) * 4,
  })
}

const MATS = {
  horn: new THREE.MeshPhysicalMaterial({ color: '#e6dfcf', roughness: 0.35, clearcoat: 0.7 }),
  thread: new THREE.MeshStandardMaterial({ color: '#c9b48c', roughness: 0.9 }),
  silver: new THREE.MeshStandardMaterial({ color: '#d9d9d9', metalness: 1, roughness: 0.25 }),
  pearl: new THREE.MeshPhysicalMaterial({ color: '#f3efe8', roughness: 0.15, clearcoat: 1, iridescence: 1, iridescenceIOR: 1.6 }),
  copper: new THREE.MeshStandardMaterial({ color: '#b87333', metalness: 1, roughness: 0.38 }),
}
const lathe = (pts) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), 28)
const HARDWARE = {
  button: () => {
    const g = new THREE.Group()
    g.add(new THREE.Mesh(lathe([[0, 0], [0.042, 0], [0.045, 0.005], [0.043, 0.011], [0.032, 0.011], [0.028, 0.008], [0, 0.008]]), MATS.horn))
    for (const r of [Math.PI / 4, -Math.PI / 4]) {
      const t = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.004, 0.004), MATS.thread)
      t.position.y = 0.01; t.rotation.y = r; g.add(t)
    }
    return g
  },
  snap: () => {
    const g = new THREE.Group()
    g.add(new THREE.Mesh(lathe([[0, 0], [0.042, 0], [0.044, 0.008], [0.04, 0.012], [0, 0.012]]), MATS.silver))
    g.add(new THREE.Mesh(lathe([[0, 0.011], [0.032, 0.011], [0.03, 0.02], [0.018, 0.027], [0, 0.029]]), MATS.pearl))
    return g
  },
  shank: () => {
    const g = new THREE.Group()
    g.add(new THREE.Mesh(lathe([[0, 0], [0.065, 0], [0.067, 0.012], [0.06, 0.022], [0.04, 0.027], [0, 0.026]]), MATS.copper))
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.047, 0.004, 6, 32), MATS.copper)
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.023; g.add(ring)
    return g
  },
  rivet: () => new THREE.Mesh(lathe([[0, 0], [0.024, 0], [0.024, 0.005], [0.016, 0.012], [0, 0.014]]), MATS.copper),
}

// ---------------- assembly ----------------

function build(G, diffuse, nor, rough) {
  const sx = G.sx ?? 1
  const tex = (c, srgb) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t }
  // weave normal/roughness maps tiled to match the painted denim (one tile = 0.9 units, anchored top-left)
  const tiled = (t, b) => {
    const c = t.clone(), rx = (b[2] - b[0]) / 0.9, ry = (b[3] - b[1]) / 0.9
    c.wrapS = c.wrapT = THREE.RepeatWrapping; c.anisotropy = 8; c.repeat.set(rx, ry); c.offset.set(0, Math.ceil(ry) - ry)
    return c
  }
  const uvs = (sim, surf) => {
    const [x0, y0, x1, y1] = surf.bbox, uv = new Float32Array(sim.count * 2)
    for (let k = 0; k < sim.count; k++) {
      const x = surf.side === 'back' ? -sim.X(k) : sim.X(k)
      uv[k * 2] = (x - x0) / (x1 - x0); uv[k * 2 + 1] = (sim.Y(k) - y0) / (y1 - y0)
    }
    return uv
  }
  const depthMat = (alphaMap) => new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, alphaMap, alphaTest: 0.5 })

  const body = {}
  for (const side of ['front', 'back']) {
    body[side] = surface(side, G.bbox, DENSITY)
    paintBody(G, side, body[side], diffuse, G.overlays.filter((o) => o.side === side))
  }
  const sim = buildSim(G, { front: sampler(body.front), back: sampler(body.back) })

  const layers = ['front', 'back'].map((side) => {
    const surf = body[side], L = side === 'front' ? sim.F : sim.B, base = side === 'front' ? 0 : sim.count
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(sim.pos.subarray(base * 3, (base + sim.count) * 3), 3))
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs(sim, surf), 2))
    geometry.setIndex(L.index)
    const inner = surface(side, G.bbox, DENSITY / 2)
    paintInner(G, side, inner, diffuse)
    const alpha = tex(surf.alpha), n = tiled(nor, G.bbox), r = tiled(rough, G.bbox)
    return {
      side, base, geometry, depth: depthMat(alpha),
      outer: clothMaterial(tex(surf.color, true), alpha, n, r),
      inner: clothMaterial(tex(inner.color, true), alpha, n, r, { side: THREE.BackSide, inner: true }),
    }
  })

  const overlays = G.overlays.map((o, i) => {
    const surf = surface(o.side, bounds(G, o.pieces), DENSITY)
    paintOverlay(G, o, surf, diffuse, G.overlays.slice(i + 1).filter((u) => u.side === o.side))
    const L = sim.cells(sampler(surf), o.side), parentLayer = o.side === 'front' ? sim.F : sim.B
    const parent = new Int32Array(sim.count), lift = new Float32Array(sim.count), pts = []
    const position = new Float32Array(sim.count * 3)
    for (let k = 0; k < sim.count; k++) {
      position.set([sim.X(k), sim.Y(k), 0], k * 3)
      if (!L.on[k]) continue
      parent[k] = sim.nearest(parentLayer, k)
      const vx = ((o.side === 'back' ? -1 : 1) * sim.X(k)) / sx
      lift[k] = typeof o.lift === 'function' ? o.lift(vx, sim.Y(k)) : o.lift
      pts.push(k)
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(position, 3))
    geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(sim.count * 3), 3))
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs(sim, surf), 2))
    geometry.setIndex(L.index)
    const alpha = tex(surf.alpha)
    return {
      side: o.side, geometry, parent, lift, pts: new Int32Array(pts), depth: depthMat(alpha),
      outer: clothMaterial(tex(surf.color, true), alpha, tiled(nor, surf.bbox), tiled(rough, surf.bbox), { material: o.material, depth: i + 1 }),
    }
  })

  const hardware = G.hardware.map((h) => {
    const L = h.side === 'front' ? sim.F : sim.B
    const object = HARDWARE[h.kind]()
    object.traverse((m) => (m.castShadow = true))
    return { side: h.side, k: sim.nearest(L, sim.at((h.side === 'back' ? -1 : 1) * h.x * sx, h.y)), lift: h.lift, object }
  })

  for (const l of [...layers, ...overlays]) l.geometry.computeBoundingSphere()
  return { sim, layers, overlays, hardware }
}

const UP = new THREE.Vector3(0, 1, 0), tmpN = new THREE.Vector3()

// move everything that rides on the simulated cloth. Overlays reuse the normals of the
// layer they're sewn onto. Bounding spheres stay from build time: the unused grid points
// span the whole pattern, so they already cover the cloth wherever it swings.
function sync({ sim, layers, overlays, hardware }) {
  for (const l of layers) { l.geometry.attributes.position.needsUpdate = true; l.geometry.computeVertexNormals() }
  const P = sim.pos
  for (const o of overlays) {
    const l = layers[o.side === 'front' ? 0 : 1], n = l.geometry.attributes.normal.array, base = l.base * 3
    const out = o.geometry.attributes.position.array, on = o.geometry.attributes.normal.array
    for (let f = 0; f < o.pts.length; f++) {
      const k = o.pts[f], q = o.parent[k] * 3, i = k * 3, h = o.lift[k]
      out[i] = P[base + q] + n[q] * h; out[i + 1] = P[base + q + 1] + n[q + 1] * h; out[i + 2] = P[base + q + 2] + n[q + 2] * h
      on[i] = n[q]; on[i + 1] = n[q + 1]; on[i + 2] = n[q + 2]
    }
    o.geometry.attributes.position.needsUpdate = true; o.geometry.attributes.normal.needsUpdate = true
  }
  for (const h of hardware) {
    const l = layers[h.side === 'front' ? 0 : 1], n = l.geometry.attributes.normal.array, q = h.k * 3, base = l.base * 3
    tmpN.set(n[q], n[q + 1], n[q + 2]).normalize()
    h.object.position.set(P[base + q], P[base + q + 1], P[base + q + 2]).addScaledVector(tmpN, h.lift)
    h.object.quaternion.setFromUnitVectors(UP, tmpN)
  }
}

function dispose({ layers, overlays }) {
  for (const l of [...layers, ...overlays]) {
    l.geometry.dispose(); l.depth.dispose()
    for (const m of [l.outer, l.inner]) if (m) { m.map.dispose(); m.alphaMap.dispose(); m.normalMap?.dispose(); m.roughnessMap?.dispose(); m.dispose() }
  }
}

// ---------------- hangers ----------------

const metal = <meshStandardMaterial color="#d6d6d6" metalness={1} roughness={0.22} />

function Hanger({ type }) {
  // the shirt hanger sits inside, between the layers; only the hook shows at the neck
  const shoulders = useMemo(() => new THREE.CatmullRomCurve3(
    [[-1.08, 1.29], [-0.6, 1.4], [-0.3, 1.46], [0, 1.5], [0.3, 1.46], [0.6, 1.4], [1.08, 1.29]].map(([x, y]) => new THREE.Vector3(x, y, 0)),
  ), [])
  if (type === 'shirt') return (
    <group>
      <mesh castShadow><tubeGeometry args={[shoulders, 48, 0.02, 8]} />{metal}</mesh>
      <mesh position={[0, 1.63, 0]}><cylinderGeometry args={[0.016, 0.016, 0.26]} />{metal}</mesh>
      <mesh position={[0, 1.9, 0]} castShadow><torusGeometry args={[0.15, 0.016, 8, 32, Math.PI * 1.4]} />{metal}</mesh>
    </group>
  )
  return (
    <group>
      <mesh position={[0, 2.0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow><cylinderGeometry args={[0.03, 0.03, 1.9]} />{metal}</mesh>
      {[-0.72, 0.72].map((x) => (
        <mesh key={x} position={[x, 1.8, 0]} castShadow><boxGeometry args={[0.14, 0.32, 0.07]} />{metal}</mesh>
      ))}
      <mesh position={[0, 2.06, 0]}><cylinderGeometry args={[0.018, 0.018, 0.12]} />{metal}</mesh>
      <mesh position={[0, 2.25, 0]} castShadow><torusGeometry args={[0.16, 0.018, 8, 32, Math.PI * 1.4]} />{metal}</mesh>
    </group>
  )
}

// ---------------- component ----------------

export const textureUrls = (tex) => ['diff', 'nor', 'rough'].map((m) => `/textures/${tex}/${m}.jpg`)

export default function Garment({ product, motion }) {
  const G = useMemo(() => GARMENTS[product.type](product), [product])
  const [diff, nor, rough] = useTexture(textureUrls(product.texture))
  const g = useMemo(() => build(G, diff.image, nor, rough), [G, diff, nor, rough])
  useEffect(() => () => dispose(g), [g])

  const group = useRef()
  const grab = useRef({ k: -1, target: new Float32Array(3), plane: new THREE.Plane() })
  const last = useRef({ x: 0, y: 1.5, rot: 0, t: 0, acc: 0 })

  useFrame((state, delta) => {
    const grp = group.current, L = last.current, { pos, prev, free } = g.sim
    motion?.(grp, state)
    grp.position.y += (0.35 - grp.position.y) * 0.06 // settle onto the rail

    // the hanger moved: let the cloth lag behind a little (in the hanger's frame)
    const dx = (grp.position.x - L.x) * INERTIA, dy = (grp.position.y - L.y) * INERTIA, dr = (grp.rotation.y - L.rot) * SPIN_INERTIA
    L.x = grp.position.x; L.y = grp.position.y; L.rot = grp.rotation.y
    for (let f = 0; f < free.length; f++) for (const a of [pos, prev]) {
      const i = free[f] * 3, x = a[i], z = a[i + 2]
      a[i] = x - dx - z * dr; a[i + 1] -= dy; a[i + 2] = z + x * dr
    }

    if (grab.current.k >= 0) {
      const v = new THREE.Vector3()
      state.raycaster.setFromCamera(state.pointer, state.camera)
      if (state.raycaster.ray.intersectPlane(grab.current.plane, v)) grab.current.target.set(grp.worldToLocal(v).toArray())
    }

    L.acc = Math.min(L.acc + delta, STEP * 2)
    while (L.acc >= STEP) { L.t += STEP; step(g.sim, L.t, grab.current); L.acc -= STEP }
    sync(g)
  })

  const local = (e) => group.current.worldToLocal(e.point.clone())
  const handlers = {
    // brushing the cursor across the fabric presses it in
    onPointerMove(e) {
      if (grab.current.k >= 0) return
      const p = local(e), { pos, free } = g.sim
      const dir = e.ray.direction.clone().transformDirection(group.current.matrixWorld.clone().invert())
      for (let f = 0; f < free.length; f++) {
        const i = free[f] * 3, d = Math.hypot(pos[i] - p.x, pos[i + 1] - p.y, pos[i + 2] - p.z)
        if (d < 0.3) { const s = (1 - d / 0.3) * 0.003; pos[i] += dir.x * s; pos[i + 1] += dir.y * s; pos[i + 2] += dir.z * s }
      }
    },
    // click and drag to pull it
    onPointerDown(e) {
      const p = local(e), { pos, free } = g.sim
      let best = -1, bd = 0.35 ** 2
      for (let f = 0; f < free.length; f++) {
        const i = free[f] * 3, d = (pos[i] - p.x) ** 2 + (pos[i + 1] - p.y) ** 2 + (pos[i + 2] - p.z) ** 2
        if (d < bd) { bd = d; best = free[f] }
      }
      if (best < 0) return
      e.stopPropagation()
      grab.current.k = best
      grab.current.target.set(p.toArray())
      grab.current.plane.setFromNormalAndCoplanarPoint(e.camera.getWorldDirection(new THREE.Vector3()).negate(), e.point)
      e.target.setPointerCapture(e.pointerId)
      document.body.style.cursor = 'grabbing'
    },
    onPointerUp(e) {
      if (grab.current.k < 0) return
      grab.current.k = -1
      e.target.releasePointerCapture?.(e.pointerId)
      document.body.style.cursor = ''
    },
    onPointerOver: () => grab.current.k < 0 && (document.body.style.cursor = 'grab'),
    onPointerOut: () => grab.current.k < 0 && (document.body.style.cursor = ''),
  }

  return (
    <group ref={group} position={[0, 1.5, 0]} scale={0.88} {...handlers}>
      <Hanger type={G.hanger} />
      {g.layers.map((l) => (
        <Fragment key={l.side}>
          <mesh geometry={l.geometry} material={l.outer} customDepthMaterial={l.depth} castShadow receiveShadow />
          <mesh geometry={l.geometry} material={l.inner} receiveShadow />
        </Fragment>
      ))}
      {g.overlays.map((o, i) => (
        <mesh key={i} geometry={o.geometry} material={o.outer} customDepthMaterial={o.depth} castShadow receiveShadow />
      ))}
      {g.hardware.map((h, i) => <primitive key={i} object={h.object} />)}
    </group>
  )
}
