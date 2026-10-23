'use client'
import { useEffect, useState } from 'react'
import { useTexture } from '@react-three/drei'
import Link from 'next/link'
import Scene from './Scene'
import Nav from './Nav'
import useReveal from './useReveal'
import { products } from './products'
import { textureUrls } from './Garment'

export default function Home() {
  const [product, setProduct] = useState(products[0])
  useReveal()
  // warm the cache so hovering a card swaps garments without a gap
  useEffect(() => products.forEach((p) => useTexture.preload(textureUrls(p.texture))), [])

  return (
    <>
      <Scene product={product} scroll />
      <Nav />

      <main>
        <section className="hero">
          <p className="eyebrow">Selvedge Denim — Est. 2026</p>
          <h1>
            {'BUILT TO FADE'.split('').map((c, i) => (
              <span key={i} style={{ animationDelay: `${i * 0.04}s` }}>{c === ' ' ? ' ' : c}</span>
            ))}
          </h1>
          <p className="sub">Japanese selvedge jeans, shirts and jackets. Brush the fabric with your cursor, click and drag to pull it, scroll to explore.</p>
          <div className="scroll-hint" />
        </section>

        <section id="drop" className="drop">
          <h2 className="reveal">The Drop</h2>
          <div className="grid">
            {products.map((p) => (
              <Link
                key={p.slug}
                href={`/product/${p.slug}`}
                className="card reveal"
                onMouseEnter={() => setProduct(p)}
                onFocus={() => setProduct(p)}
              >
                <div className="photo"><img src={p.images[0]} alt={p.name} loading="lazy" /></div>
                <small>{p.tag}</small>
                <h3>{p.name}</h3>
                <p>${p.price}</p>
              </Link>
            ))}
          </div>
        </section>

        <section id="story" className="story">
          <h2 className="reveal">Wear it in.<br />Not out.</h2>
          <p className="reveal">
            Rope-dyed indigo, woven on vintage shuttle looms and chain-stitched by hand.
            Every crease you put in it tells your story.
          </p>
        </section>

        <section id="join" className="join">
          <h2 className="reveal">Get first access</h2>
          <form className="reveal" onSubmit={(e) => { e.preventDefault(); e.target.reset(); alert('You are on the list.') }}>
            <input type="email" required placeholder="you@email.com" aria-label="Email" />
            <button>Join</button>
          </form>
        </section>
      </main>

      <footer>© 2026 INDIGO MILL · Photos via Unsplash</footer>
    </>
  )
}
