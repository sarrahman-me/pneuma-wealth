'use client'

import { useEffect } from 'react'

/**
 * Mendaftarkan service worker setelah halaman selesai dimuat.
 *
 * Pendaftaran ditunda sampai `load` supaya pengambilan berkas service worker
 * tidak berebut bandwidth dengan render pertama, yang justru terasa di jaringan
 * seluler — kondisi paling umum untuk aplikasi ini.
 */
export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (!('serviceWorker' in navigator)) return

    const register = () => {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
        // Gagal mendaftar bukan alasan untuk mengganggu pengguna: aplikasi tetap
        // berfungsi penuh secara daring tanpa service worker.
      })
    }

    if (document.readyState === 'complete') {
      register()
      return
    }
    window.addEventListener('load', register)
    return () => window.removeEventListener('load', register)
  }, [])

  return null
}
