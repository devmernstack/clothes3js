'use client'
import { useEffect, useState } from 'react'
import Scene from './Scene'
import Nav, { Footer } from './Nav'
import useReveal from './useReveal'
import { product } from './products'

const chapters = [
  { id: 'cut', n: '01', title: 'Cutting', lede: 'Twelve pieces, one bolt.',
    text: 'The flannel is laid flat and every pattern piece is chalked onto the cloth, then cut out along the line with tailor’s shears. Each piece is laid on the grain, so the shirt hangs straight.' },
  { id: 'stitch', n: '02', title: 'Stitching', lede: 'Felled seams, inside and out.',
    text: 'Fronts, back and sleeves come together first, then cuffs, pockets and the two-piece collar. Every seam is felled and topstitched, so nothing frays inside.' },
  { id: 'hand', n: '03', title: 'Handwork', lede: 'Finished by hand.',
    text: 'The pocket flaps are pressed down and the buttons are sewn on one at a time, with a thread shank so they sit proud of the placket and close easily.' },
  { id: 'fit', n: '04', title: 'The fitting', lede: 'On the form.',
    text: 'Off the hanger and onto the dress form. The shirt takes its shape: shoulders set, sleeves fall, the shirttail hangs straight.' },
]

const money = (n) => `$${n.toLocaleString('en-US')}`

// colour + size + add to cart; used in the buy section and the sticky bar
function Picker({ variant, setVariant, size, setSize, add, compact }) {
  return (
    <div className={compact ? 'picker compact' : 'picker'}>
      <div className="swatches" role="radiogroup" aria-label="Colour">
        {product.variants.map((v) => (
          <button key={v.id} role="radio" aria-checked={v.id === variant.id} aria-label={v.name} title={v.name}
            className={v.id === variant.id ? 'swatch on' : 'swatch'} style={{ '--c': v.swatch }} onClick={() => setVariant(v)} />
        ))}
        {!compact && <span className="swatch-name">{variant.name}</span>}
      </div>
      <div className="sizes" role="radiogroup" aria-label="Size">
        {product.sizes.map((s) => (
          <button key={s} role="radio" aria-checked={s === size} className={s === size ? 'on' : ''} onClick={() => setSize(s)}>{s}</button>
        ))}
      </div>
      <button className="add" onClick={add}>Add to cart<span className="add-price"> · {money(product.price)}</span></button>
    </div>
  )
}

export default function Home() {
  const [variant, setVariant] = useState(product.variants[0])
  const [size, setSize] = useState(null)
  const [cart, setCart] = useState([])
  const [open, setOpen] = useState(false)
  const [toast, setToast] = useState('')
  const [bar, setBar] = useState(false)
  useReveal()

  // the sticky buy bar shows once the hero has scrolled away
  useEffect(() => {
    const on = () => setBar(scrollY > innerHeight * 0.6)
    on(); addEventListener('scroll', on, { passive: true })
    return () => removeEventListener('scroll', on)
  }, [])
  useEffect(() => {
    if (!open) return
    const esc = (e) => e.key === 'Escape' && setOpen(false)
    addEventListener('keydown', esc)
    return () => removeEventListener('keydown', esc)
  }, [open])
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 2600); return () => clearTimeout(t) }, [toast])

  const add = () => {
    if (!size) return setToast('Pick a size first')
    setCart((c) => {
      const i = c.findIndex((l) => l.variant.id === variant.id && l.size === size)
      return i < 0 ? [...c, { variant, size, qty: 1 }] : c.map((l, j) => (j === i ? { ...l, qty: l.qty + 1 } : l))
    })
    setToast(`Added: ${product.name}, ${variant.name}, ${size}`)
    setOpen(true)
  }
  const setQty = (i, q) => setCart((c) => (q < 1 ? c.filter((_, j) => j !== i) : c.map((l, j) => (j === i ? { ...l, qty: q } : l))))
  const count = cart.reduce((a, l) => a + l.qty, 0), total = count * product.price
  const picker = { variant, setVariant, size, setSize, add }

  return (
    <>
      <Scene product={product} variant={variant} />
      <Nav count={count} onCart={() => setOpen(true)} />

      <main>
        <section id="hero" className="hero">
          <p className="eyebrow rise">N° 01 — Autumn / Winter 2026</p>
          <h1 className="display">
            <span className="line"><span>The Hunter</span></span>
            <span className="line"><span><em>Shirt.</em></span></span>
          </h1>
          <p className="lede rise">{product.description} Scroll to watch it being made.</p>
          <div className="hero-actions rise">
            <a href="#buy" className="cta">Shop · {money(product.price)}</a>
            <div className="swatches" aria-label="Colour">
              {product.variants.map((v) => (
                <button key={v.id} aria-label={v.name} title={v.name} className={v.id === variant.id ? 'swatch on' : 'swatch'} style={{ '--c': v.swatch }} onClick={() => setVariant(v)} />
              ))}
            </div>
          </div>
          <div className="hero-meta rise"><span>{product.tag}</span><span>{product.variants.length} colours · 12 pieces</span><span>Scroll ↓</span></div>
        </section>

        {chapters.map((c, i) => (
          <section key={c.id} id={c.id} className={`chapter ${i % 2 ? 'right' : 'left'}`}>
            <div className="chapter-card reveal">
              <p className="num">{c.n} <span>/ 04</span></p>
              <h2>{c.title}</h2>
              <p className="chapter-lede">{c.lede}</p>
              <p>{c.text}</p>
            </div>
          </section>
        ))}

        <section id="buy" className="buy">
          <div className="buy-card reveal">
            <small>{product.tag} · {variant.name}</small>
            <h2>{product.name}</h2>
            <p className="price">{money(product.price)}</p>
            <p className="desc">{product.description}</p>
            <p className="label">Colour</p>
            <Picker {...picker} />
            <div className="details">
              <details open>
                <summary>Fabric &amp; construction</summary>
                <p>100% brushed cotton flannel, 8 oz. Felled seams, two-piece collar, button-flap chest pockets, curved shirttail hem.</p>
              </details>
              <details>
                <summary>Fit &amp; size guide</summary>
                <p>Regular fit, roomy enough to layer. Chest: S 104 cm · M 110 cm · L 116 cm · XL 122 cm.</p>
              </details>
              <details>
                <summary>Care</summary>
                <p>Machine wash cold, inside out. Hang to dry. Gets softer with every wash.</p>
              </details>
              <details>
                <summary>Shipping &amp; returns</summary>
                <p>Free shipping over $100. Returns within 30 days, unworn and unwashed.</p>
              </details>
            </div>
          </div>
        </section>
      </main>

      <Footer />

      {/* sticky buy bar */}
      <div className={`buy-bar ${bar && !open ? 'show' : ''}`} aria-hidden={!bar}>
        <div className="buy-bar-name"><strong>{product.name}</strong><span>{variant.name} · {money(product.price)}</span></div>
        <Picker {...picker} compact />
      </div>

      {toast && <p className="toast" role="status">{toast}</p>}

      {/* cart drawer */}
      <div className={`scrim ${open ? 'show' : ''}`} onClick={() => setOpen(false)} />
      <aside className={`drawer ${open ? 'open' : ''}`} aria-label="Cart" aria-hidden={!open}>
        <header><h3>Your cart <sup>({count})</sup></h3><button className="close" onClick={() => setOpen(false)} aria-label="Close cart">×</button></header>
        {cart.length === 0 ? <p className="empty">Your cart is empty.</p> : (
          <ul className="lines">
            {cart.map((l, i) => (
              <li key={l.variant.id + l.size}>
                <span className="line-swatch" style={{ '--c': l.variant.swatch }} />
                <div className="line-info"><strong>{product.name}</strong><span>{l.variant.name} · Size {l.size}</span>
                  <div className="qty">
                    <button onClick={() => setQty(i, l.qty - 1)} aria-label="One less">−</button><span>{l.qty}</span><button onClick={() => setQty(i, l.qty + 1)} aria-label="One more">+</button>
                    <button className="remove" onClick={() => setQty(i, 0)}>Remove</button>
                  </div>
                </div>
                <span className="line-price">{money(l.qty * product.price)}</span>
              </li>
            ))}
          </ul>
        )}
        <footer>
          <p className="subtotal"><span>Subtotal</span><span>{money(total)}</span></p>
          <p className="ship-note">{total >= 100 ? 'Free shipping included.' : 'Free shipping over $100.'}</p>
          <button className="add" disabled={!count} onClick={() => alert('This is a showcase: checkout is not connected yet.')}>Checkout</button>
        </footer>
      </aside>
    </>
  )
}
