import { Cormorant_Garamond, Inter } from 'next/font/google'
import './globals.css'

const serif = Cormorant_Garamond({ subsets: ['latin'], weight: ['300', '400', '500'], style: ['normal', 'italic'], variable: '--serif' })
const sans = Inter({ subsets: ['latin'], variable: '--sans' })

export const metadata = { title: 'Bharat Mill — The Hunter Shirt', description: 'A brushed-cotton flannel shirt, made by hand.' }

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable}`}>
      <body>{children}</body>
    </html>
  )
}
