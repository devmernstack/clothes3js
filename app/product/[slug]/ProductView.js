'use client'
import { useState } from 'react'
import Link from 'next/link'
import Scene from '../../Scene'
import Nav from '../../Nav'
import { products } from '../../products'

const sizes = ['28', '30', '32', '34', '36']

export default function ProductView({ product }) {
  const [photo, setPhoto] = useState(null) // null = 3D garment
  const [size, setSize] = useState(null)
  const [bag, setBag] = useState(0)
  const [toast, setToast] = useState('')
  const isJean = product.type === 'jeans'
  const others = products.filter((p) => p.slug !== product.slug)

  const add = () => {
    if (!size) return setToast('Pick a size first')
    setBag((b) => b + 1)
    setToast(`${product.name} (${size}) added to bag`)
  }

  return (
    <>
      <Nav bag={bag} />
      <main className="pdp">
        <div className="pdp-stage">
          <Scene key={product.slug} product={product} photo={photo} urls={product.images} className="pdp-canvas" turnable />
          <p className="hint">{photo ? 'Hover the photo' : 'Pull the fabric · drag the background to turn it'}</p>
          <div className="thumbs">
            <button className={`three-d ${photo ? '' : 'on'}`} onClick={() => setPhoto(null)} aria-label="View 3D garment">3D</button>
            {product.images.map((url, i) => (
              <button key={url} className={url === photo ? 'on' : ''} onClick={() => setPhoto(url)} aria-label={`View photo ${i + 1}`}>
                <img src={url} alt="" />
              </button>
            ))}
          </div>
        </div>

        <div className="pdp-info">
          <Link href="/#drop" className="back">← Back to collection</Link>
          <small>{product.tag}</small>
          <h1 className="pdp-title">{product.name}</h1>
          <p className="price">${product.price}</p>
          <p className="desc">{product.description}</p>

          <p className="label">{isJean ? 'Waist' : 'Chest'} size</p>
          <div className="sizes">
            {(isJean ? sizes : ['S', 'M', 'L', 'XL']).map((s) => (
              <button key={s} className={s === size ? 'on' : ''} onClick={() => { setSize(s); setToast('') }}>{s}</button>
            ))}
          </div>
          <button className="add" onClick={add}>Add to bag</button>
          {toast && <p className="toast" role="status">{toast}</p>}

          <ul className="specs">
            <li>Free shipping over $100</li>
            <li>Free hemming on all jeans</li>
            <li>30-day returns</li>
          </ul>

          <p className="label">You may also like</p>
          <div className="related">
            {others.map((p) => (
              <Link key={p.slug} href={`/product/${p.slug}`}>
                <img src={p.images[0]} alt={p.name} />
                <span>{p.name}</span>
              </Link>
            ))}
          </div>
        </div>
      </main>
    </>
  )
}
