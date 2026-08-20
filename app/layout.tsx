import './globals.css'
import Link from 'next/link'
import { ClerkProvider, UserButton } from '@clerk/nextjs'
import { isAuthConfigured } from '@/lib/server/auth'

export const metadata = {
  title: 'PNEUMA',
  description: 'Pelacak keuangan yang tenang',
}

const Shell = ({ children }: { children: React.ReactNode }) => (
  <html lang="id">
    <body>
      <div className="app-shell">
        <nav className="nav">
          <Link href="/">Beranda</Link>
          <Link href="/history">Riwayat</Link>
          <Link href="/wishlist">Keinginan</Link>
          <Link href="/fixed-costs">Biaya Tetap</Link>
          <Link href="/summary">Ringkasan</Link>
          <Link href="/rules">Aturan</Link>
          <Link href="/panduan">Panduan</Link>
          {isAuthConfigured() ? (
            <span style={{ marginLeft: 'auto', display: 'flex' }}>
              <UserButton />
            </span>
          ) : null}
        </nav>
        {children}
      </div>
    </body>
  </html>
)

export default function RootLayout({ children }: { children: React.ReactNode }) {
  if (!isAuthConfigured()) {
    return <Shell>{children}</Shell>
  }
  return (
    <ClerkProvider>
      <Shell>{children}</Shell>
    </ClerkProvider>
  )
}
