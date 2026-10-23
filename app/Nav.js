import Link from 'next/link'

export default function Nav({ bag = 0 }) {
  return (
    <nav>
      <Link href="/"><b>INDIGO MILL</b></Link>
      <span><Link href="/#drop">Collection</Link><Link href="/#story">Story</Link><em className="bag">Bag ({bag})</em></span>
    </nav>
  )
}
