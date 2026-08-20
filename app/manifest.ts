import type { MetadataRoute } from 'next'

/**
 * Manifest PWA.
 *
 * `display: standalone` membuat aplikasi terbuka tanpa bilah alamat setelah
 * dipasang di layar utama, jadi bilah navigasi bawah di `Navigation.tsx` yang
 * jadi satu-satunya cara berpindah halaman — itu sebabnya bilah itu wajib ada.
 *
 * Warna latar dan tema memakai palet terang karena layar pembuka Android
 * memakai `background_color`, dan ikon bertinta gelap paling terbaca di atasnya.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'PNEUMA — Pelacak keuangan yang tenang',
    short_name: 'PNEUMA',
    description:
      'Asisten keuangan harian yang bicara sebelum uang keluar: jatah harian, ' +
      'tagihan rutin, dan masa tunggu untuk keinginan.',
    lang: 'id',
    dir: 'ltr',
    start_url: '/',
    scope: '/',
    id: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f6f3ee',
    theme_color: '#f6f3ee',
    categories: ['finance', 'lifestyle', 'productivity'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        src: '/icons/maskable-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      { name: 'Riwayat', short_name: 'Riwayat', url: '/history' },
      { name: 'Keinginan', short_name: 'Keinginan', url: '/wishlist' },
      { name: 'Ringkasan', short_name: 'Ringkasan', url: '/summary' },
    ],
  }
}
