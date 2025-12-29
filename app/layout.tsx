import './globals.css'
import Link from 'next/link'

export const metadata = {
  title: 'PNEUMA',
  description: 'Personal finance tracker',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <div className="app-shell">
          <nav className="nav">
            <Link href="/">Home</Link>
            <Link href="/rules">Rules</Link>
            <Link href="/fixed-costs">Fixed Costs</Link>
            <Link href="/pools">Pools</Link>
          </nav>
          {children}
        </div>
      </body>
    </html>
  )
}
