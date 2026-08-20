'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { UserButton } from '@clerk/nextjs'

/**
 * Navigasi aplikasi.
 *
 * Di layar lebar, semua tujuan muat sebagai satu baris tautan di kepala
 * halaman. Di ponsel, lima tujuan yang paling sering dibuka pindah ke bilah
 * bawah supaya bisa dijangkau ibu jari sambil memegang ponsel dengan satu
 * tangan — aplikasi ini dipakai sambil berdiri di kasir, bukan di meja kerja.
 *
 * Aturan dan Panduan tinggal di kepala halaman karena keduanya dibuka saat
 * menyiapkan aplikasi, bukan saat mencatat pengeluaran.
 */

const PRIMARY = [
  { href: '/', label: 'Beranda', icon: HomeIcon },
  { href: '/history', label: 'Riwayat', icon: ListIcon },
  { href: '/wishlist', label: 'Keinginan', icon: StarIcon },
  { href: '/fixed-costs', label: 'Biaya Tetap', icon: RepeatIcon },
  { href: '/summary', label: 'Ringkasan', icon: ChartIcon },
] as const

const SECONDARY = [
  { href: '/rules', label: 'Aturan' },
  { href: '/panduan', label: 'Panduan' },
] as const

const isActive = (pathname: string, href: string) =>
  href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`)

export default function Navigation({ showUserButton }: { showUserButton: boolean }) {
  const pathname = usePathname() ?? '/'

  return (
    <>
      <header className="nav">
        <Link href="/" className="nav-brand" aria-label="PNEUMA, beranda">
          PNEUMA
        </Link>

        <nav className="nav-links" aria-label="Navigasi utama">
          {PRIMARY.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={isActive(pathname, item.href) ? 'nav-link nav-link-active' : 'nav-link'}
              aria-current={isActive(pathname, item.href) ? 'page' : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <nav className="nav-secondary" aria-label="Pengaturan">
          {SECONDARY.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={isActive(pathname, item.href) ? 'nav-link nav-link-active' : 'nav-link'}
              aria-current={isActive(pathname, item.href) ? 'page' : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {showUserButton ? (
          <span className="nav-user">
            <UserButton />
          </span>
        ) : null}
      </header>

      <nav className="tabbar" aria-label="Navigasi cepat">
        {PRIMARY.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href)
          return (
            <Link
              key={href}
              href={href}
              className={active ? 'tab tab-active' : 'tab'}
              aria-current={active ? 'page' : undefined}
            >
              <Icon />
              <span className="tab-label">{label}</span>
            </Link>
          )
        })}
      </nav>
    </>
  )
}

/*
 * Ikon digambar sebagai garis `currentColor` supaya ikut token warna tema —
 * termasuk saat tab sedang aktif — tanpa perlu satu berkas gambar per warna.
 */

const iconProps = {
  width: 22,
  height: 22,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  focusable: false,
} as const

function HomeIcon() {
  return (
    <svg {...iconProps}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5.5 9.5V20h13V9.5" />
    </svg>
  )
}

function ListIcon() {
  return (
    <svg {...iconProps}>
      <path d="M8 6h12M8 12h12M8 18h12" />
      <path d="M3.6 6h.01M3.6 12h.01M3.6 18h.01" />
    </svg>
  )
}

function StarIcon() {
  return (
    <svg {...iconProps}>
      <path d="M12 3.6l2.6 5.3 5.9.85-4.25 4.15 1 5.85L12 16.99l-5.25 2.76 1-5.85L3.5 9.75l5.9-.85z" />
    </svg>
  )
}

function RepeatIcon() {
  return (
    <svg {...iconProps}>
      <path d="M4 9a5 5 0 0 1 5-5h11" />
      <path d="M17 1.5 20.5 4 17 6.5" />
      <path d="M20 15a5 5 0 0 1-5 5H4" />
      <path d="M7 17.5 3.5 20 7 22.5" />
    </svg>
  )
}

function ChartIcon() {
  return (
    <svg {...iconProps}>
      <path d="M4 20V4" />
      <path d="M4 20h16" />
      <path d="M8 20v-6M13 20V8M18 20v-9" />
    </svg>
  )
}
