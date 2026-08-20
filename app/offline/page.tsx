/**
 * Halaman pengganti saat perangkat sedang tanpa internet.
 *
 * Sengaja tidak menyentuh database maupun sesi: halaman ini disimpan di cache
 * service worker, jadi isinya harus sama untuk siapa pun yang membukanya.
 */
export const metadata = { title: 'Tidak ada internet — PNEUMA' }

export default function OfflinePage() {
  return (
    <main>
      <h1>Tidak ada internet</h1>
      <section>
        <p>
          PNEUMA butuh internet untuk menampilkan angka hari ini, karena jatah harian
          dihitung ulang setiap kali dibuka — bukan diambil dari salinan lama yang bisa
          keliru.
        </p>
        <p>
          Nyalakan kembali data atau Wi-Fi, lalu muat ulang halaman ini. Catatan yang sudah
          tersimpan sebelumnya tetap aman.
        </p>
      </section>
    </main>
  )
}
