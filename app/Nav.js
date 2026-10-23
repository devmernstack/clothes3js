export default function Nav({ count = 0, onCart }) {
  return (
    <nav>
      <span className="nav-links"><a href="#cut">The making</a><a href="#fit">Fitting</a></span>
      <a href="#hero" className="wordmark">Bharat Mill</a>
      <span className="nav-links right"><a href="#buy">Details</a><button className="bag" onClick={onCart}>Cart ({count})</button></span>
    </nav>
  )
}

export function Footer() {
  return (
    <footer id="footer">
      <div className="footer-cols">
        <div><h4>The shirt</h4><a href="#cut">How it's made</a><a href="#buy">Details &amp; sizes</a></div>
        <div><h4>Atelier</h4><span>Repairs for life</span><span>Made to order</span></div>
        <div><h4>Visit</h4><span>Mon–Sat, 10–18</span></div>
      </div>
      <p className="footer-mark">Bharat Mill</p>
      <p className="fine">© 2026 Bharat Mill · Fabric weave scan via Poly Haven</p>
    </footer>
  )
}
