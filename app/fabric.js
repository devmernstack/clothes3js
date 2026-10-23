// Brushed cotton flannel, drawn once per colour in the browser. One tile = TILE world
// units and repeats seamlessly. The check is centred on the tile edge so it is symmetric
// about x = 0: the front and back panels (painted mirrored) then match at the side seams.
export const TILE = 0.6

const cache = {}
export function fabric(id) {
  if (cache[id]) return cache[id]
  const n = 512, c = Object.assign(document.createElement('canvas'), { width: n, height: n }), g = c.getContext('2d')
  const ground = { black: '#121213', natural: '#d6c9ae', red: '#a3191e' }[id]
  g.fillStyle = ground; g.fillRect(0, 0, n, n)
  if (id === 'red') {
    // buffalo check: black bands, thin guard lines in the red
    g.fillStyle = 'rgba(16,10,10,.64)'
    for (const [a, b] of [[0, n / 4], [(3 * n) / 4, n]]) { g.fillRect(a, 0, b - a, n); g.fillRect(0, a, n, b - a) }
    g.fillStyle = 'rgba(16,10,10,.35)'; g.fillRect(n / 2 - 3, 0, 6, n); g.fillRect(0, n / 2 - 3, n, 6)
  }
  // twill: 45° hatch, period divides the tile so it stays seamless
  g.strokeStyle = id === 'black' ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.14)'; g.lineWidth = 1.2
  for (let d = -n; d < n; d += 4) { g.beginPath(); g.moveTo(d, 0); g.lineTo(d + n, n); g.stroke() }
  // brushed fuzz; natural (undyed) cotton also gets darker slub flecks
  const img = g.getImageData(0, 0, n, n), p = img.data, amp = id === 'black' ? 14 : 30
  for (let i = 0; i < p.length; i += 4) {
    const v = (Math.random() - 0.5) * amp - (id === 'natural' && Math.random() < 0.004 ? 70 : 0)
    p[i] += v; p[i + 1] += v * (id === 'red' ? 0.55 : 0.95); p[i + 2] += v * (id === 'red' ? 0.55 : 0.85)
  }
  g.putImageData(img, 0, 0)
  return (cache[id] = c)
}
