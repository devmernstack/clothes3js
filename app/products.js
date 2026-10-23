// The one piece this site showcases, and its colourways
export const product = {
  type: 'shirt',
  style: 'hunter',
  fabric: 'flannel', // colour painted in fabric.js
  texture: 'caban', // weave maps: Poly Haven CC0 scan in public/textures
  name: 'The Hunter Shirt',
  price: 185,
  tag: 'Brushed cotton flannel',
  description: 'A heavyweight brushed-cotton flannel shirt for every day, cut from a single bolt into twelve pieces, felled at every seam and finished by hand.',
  sizes: ['S', 'M', 'L', 'XL'],
  variants: [
    { id: 'black', name: 'Black', swatch: '#141414', thread: '#d8cbb0', fastener: 'button', sheen: '#4a4c52', reverse: 'rgba(255,255,255,.06)', chalk: '#f4efe6' },
    { id: 'natural', name: 'Natural', swatch: '#d6c9ae', thread: '#7a5f40', fastener: 'horn', sheen: '#fff6e8', reverse: 'rgba(255,250,240,.25)', chalk: '#35508a' },
    { id: 'red', name: 'Red check', swatch: '#a3191e', thread: '#dccdb0', fastener: 'horn', sheen: '#ffb4a4', reverse: 'rgba(235,215,205,.3)', chalk: '#f4efe6' },
  ],
}
