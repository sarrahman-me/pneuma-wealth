import './globals.css'
import type { Metadata, Viewport } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import Navigation from './components/Navigation'
import ServiceWorkerRegistrar from './components/ServiceWorkerRegistrar'
import { isAuthConfigured } from '@/lib/server/auth'

export const metadata: Metadata = {
  title: 'PNEUMA',
  description: 'Pelacak keuangan yang tenang',
  applicationName: 'PNEUMA',
  manifest: '/manifest.webmanifest',
  // Dipakai iOS saat aplikasi dipasang ke layar utama: tanpa ini, membuka
  // aplikasi dari layar utama tetap memunculkan bilah alamat Safari.
  appleWebApp: {
    capable: true,
    title: 'PNEUMA',
    statusBarStyle: 'default',
  },
  formatDetection: { telephone: false },
  other: {
    // Next.js sudah memancarkan `mobile-web-app-capable` yang baku, tapi iOS 16
    // ke bawah hanya mengenali nama lamanya. Tanpa ini, pengguna iOS lama tetap
    // dapat bilah alamat Safari saat membuka dari layar utama.
    'apple-mobile-web-app-capable': 'yes',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Layar penuh sampai ke tepi; jarak aman notch dan bilah gestur diurus di CSS
  // lewat env(safe-area-inset-*).
  viewportFit: 'cover',
  // Zoom sengaja tidak dikunci — angka rupiah di sini panjang, dan mencubit
  // untuk memperbesar harus tetap bisa.
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f2ece3' },
    { media: '(prefers-color-scheme: dark)', color: '#1b1a17' },
  ],
}

const Shell = ({ children }: { children: React.ReactNode }) => (
  <html lang="id">
    <body>
      <div className="app-shell">
        <Navigation showUserButton={isAuthConfigured()} />
        {children}
      </div>
      <ServiceWorkerRegistrar />
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
