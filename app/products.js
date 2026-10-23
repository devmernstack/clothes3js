// Photos: Unsplash (free license), cropped to 3:4 via URL params
const img = (id) => `https://images.unsplash.com/${id}?w=900&h=1200&fit=crop&q=80`

export const products = [
  {
    slug: 'raw-indigo-jean',
    type: 'jeans',
    texture: 'denim_fabric_03', // Poly Haven CC0 scan in public/textures
    cuff: true, // turned-up hem showing the selvedge
    name: 'Raw Indigo Jean',
    price: 140,
    tag: '14oz Selvedge',
    description: 'Unwashed Japanese selvedge with a straight leg and mid rise. Stiff on day one, yours by month six.',
    images: [img('photo-1624378439575-d8705ad7ae80'), img('photo-1604176354204-9268737828e4'), img('photo-1576995853123-5a10305d93c0')],
  },
  {
    slug: 'chambray-shirt',
    type: 'shirt',
    texture: 'denim_fabric_04', // Poly Haven CC0 scan in public/textures
    style: 'work',
    name: 'Chambray Work Shirt',
    price: 110,
    tag: 'Lightweight',
    description: 'Soft-hand chambray with a pointed collar and twin chest pockets. Wear it buttoned or open over a tee.',
    images: [img('photo-1596755094514-f87e34085b2c'), img('photo-1588359348347-9bc6cbbb689e')],
  },
  {
    slug: 'western-shirt',
    type: 'shirt',
    texture: 'denmin_fabric_02', // Poly Haven CC0 scan in public/textures
    style: 'western', // pearl snaps, pointed yokes
    name: 'Stonewash Western Shirt',
    price: 165,
    tag: 'Heavyweight',
    description: 'Heavy western shirt in acid-stonewash denim with pearl snaps and pointed pocket flaps.',
    images: [img('photo-1516257984-b1b4d707412e')],
  },
  {
    slug: 'distressed-jean',
    type: 'jeans',
    texture: 'denim_fabric', // Poly Haven CC0 scan in public/textures
    distressed: true,
    name: 'Distressed Taper Jean',
    price: 125,
    tag: 'Light Wash',
    description: 'A relaxed taper with hand-finished rips and a light vintage wash. Comfort stretch at the waist.',
    images: [img('photo-1541099649105-f69ad21f3246'), img('photo-1582552938357-32b906df40cb')],
  },
]
