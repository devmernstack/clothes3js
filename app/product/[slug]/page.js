import { notFound } from 'next/navigation'
import { products } from '../../products'
import ProductView from './ProductView'

export const generateStaticParams = () => products.map((p) => ({ slug: p.slug }))

export async function generateMetadata({ params }) {
  const { slug } = await params
  const p = products.find((p) => p.slug === slug)
  return { title: p ? `${p.name} — INDIGO MILL` : 'Not found' }
}

export default async function ProductPage({ params }) {
  const { slug } = await params
  const product = products.find((p) => p.slug === slug)
  if (!product) notFound()
  return <ProductView product={product} />
}
