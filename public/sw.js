/*
 * Service worker PNEUMA.
 *
 * Aturan pentingnya satu: JANGAN PERNAH menyimpan respons halaman atau API.
 * Semua halaman di sini berisi angka keuangan milik satu pengguna, dan cache
 * service worker dipakai bersama seluruh profil peramban di perangkat itu —
 * menyimpannya berarti data satu akun bisa muncul di sesi akun lain.
 *
 * Yang disimpan hanya berkas statis yang isinya sama untuk semua orang
 * (bundel ber-hash dari /_next/static dan ikon), plus satu halaman /offline
 * sebagai pengganti saat jaringan mati. Itu sudah cukup untuk membuat aplikasi
 * bisa dipasang dan terbuka seketika, tanpa membocorkan apa pun.
 */

const VERSION = 'pneuma-v1'
const SHELL = `${VERSION}-shell`
const ASSETS = `${VERSION}-assets`

const OFFLINE_URL = '/offline'

const PRECACHE = [OFFLINE_URL, '/icons/icon-192.png', '/icons/icon-512.png']

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL)
      // Satu per satu dan tahan galat: `addAll` menggagalkan seluruh pemasangan
      // kalau satu berkas saja gagal diambil, dan service worker yang gagal
      // dipasang membuat aplikasi tidak bisa dipasang sama sekali.
      await Promise.allSettled(PRECACHE.map((path) => cache.add(path)))
      await self.skipWaiting()
    })(),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys()
      await Promise.all(
        names.filter((name) => !name.startsWith(VERSION)).map((name) => caches.delete(name)),
      )
      await self.clients.claim()
    })(),
  )
})

/** Berkas statis ber-hash: isinya tidak pernah berubah untuk URL yang sama. */
const isImmutableAsset = (url) =>
  url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (isImmutableAsset(url)) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request)
        if (cached) return cached
        const response = await fetch(request)
        if (response.ok) {
          const cache = await caches.open(ASSETS)
          cache.put(request, response.clone())
        }
        return response
      })(),
    )
    return
  }

  // Halaman: selalu ambil dari jaringan, tidak pernah disimpan. Kalau jaringan
  // mati, tampilkan halaman /offline supaya aplikasi tidak menampilkan layar
  // galat bawaan peramban.
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          return await fetch(request)
        } catch {
          const cached = await caches.match(OFFLINE_URL)
          return (
            cached ??
            new Response('Sedang luring.', {
              status: 503,
              headers: { 'content-type': 'text/plain; charset=utf-8' },
            })
          )
        }
      })(),
    )
  }
})
