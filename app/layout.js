import './globals.css'

export const metadata = { title: 'INDIGO MILL — Selvedge Denim', description: 'Japanese selvedge jeans and denim shirts.' }

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
