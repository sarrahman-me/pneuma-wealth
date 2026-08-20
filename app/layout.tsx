import './globals.css'
import type { Metadata, Viewport } from 'next'
import { Source_Serif_4, Inter } from 'next/font/google'
import { ClerkProvider } from '@clerk/nextjs'
import Navigation from './components/Navigation'
import ServiceWorkerRegistrar from './components/ServiceWorkerRegistrar'
import { isAuthConfigured } from '@/lib/server/auth'

/*
 * Dua keluarga huruf, dua tugas.
 *
 * Serif membawa suara: judul, kalimat, dan setiap angka rupiah. Sans hanya
 * mengurus perkakas — navigasi, tombol, label kecil huruf besar. Pembagian ini
 * yang membuat halaman terbaca seperti terbitan, bukan seperti dasbor.
 *
 * Keduanya di-host sendiri lewat next/font, bukan ditarik dari Google saat
 * halaman dibuka. Aplikasi ini dipasang sebagai PWA dan harus tetap tampil utuh
 * tanpa jaringan.
 */
const serif = Source_Serif_4({
  subsets: ['latin'],
  weight: ['400', '600'],
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--font-serif',
})

const sans = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-sans',
})

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
    { media: '(prefers-color-scheme: light)', color: '#f0eee6' },
    { media: '(prefers-color-scheme: dark)', color: '#141413' },
  ],
}

const Shell = ({ children }: { children: React.ReactNode }) => (
  <html lang="id" className={`${serif.variable} ${sans.variable}`}>
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
