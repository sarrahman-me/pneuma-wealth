# Repository Guidelines

## Struktur

Aplikasi web Next.js (App Router) dengan Postgres via Drizzle.

- `lib/core/` — logika murni: waterfall dana, jatah harian, insight, tanggal.
  Tidak boleh mengimpor apa pun yang menyentuh I/O. Semua perilaku di sini
  wajib punya unit test.
- `lib/server/` — perakitan state, query database, auth. Ditandai `server-only`.
- `lib/db/` — skema Drizzle, klien, migrasi ter-versioned.
- `app/` — halaman dan komponen; `app/actions/` berisi server actions.
- `public/sw.js` — service worker. Boleh menyimpan berkas statis saja; respons
  halaman dan API tidak pernah disimpan karena cache-nya dipakai bersama semua
  profil peramban di perangkat itu.
- `scripts/generate-icons.py` — sumber kebenaran ikon PWA. Ubah di sini, lalu
  jalankan ulang; jangan menyunting berkas PNG-nya langsung.

## Perintah

- `npm run dev` — server pengembangan di port 3000.
- `npm run check` — lint + typecheck + test. Jalankan sebelum commit.
- `npm run db:generate` lalu `npm run db:migrate` untuk perubahan skema.

## Konvensi

- Semua nilai uang bilangan bulat rupiah. Jangan pernah memakai float.
- Tanggal lokal (`YYYY-MM-DD`) selalu dihitung dari zona waktu pengguna lewat
  `todayIn(user.timezone)` — jangan pakai `new Date()` di server untuk
  menentukan "hari ini".
- Logika baru masuk ke `lib/core/` sebagai fungsi murni dulu, baru disambungkan
  di `lib/server/`. Ini yang membuatnya bisa diuji tanpa database.
- Setiap query yang menyentuh data pengguna wajib difilter dengan `userId`, dan
  server action wajib memverifikasi kepemilikan sebelum menulis.
- Pengeluaran `source = 'fixed_cost'` tidak boleh ikut memakan jatah harian;
  kewajiban sudah dipotong lewat `scheduledObligations`.
- Jatuh tempo biaya tetap selalu lewat `nextDue`/`occurrencesWithin`, tidak
  pernah dengan mengasumsikan siklus bulanan. Kunci periode pembayaran dibuat
  `periodKeyFor`; bentuk bulanan wajib tetap `YYYY-MM` supaya pembayaran lama
  tidak mendadak tampak belum lunas.
- `reserved + flexible === max(0, available)`. Jangan menambahkan lapis baru
  yang mengklaim rupiah yang sama dua kali; `bufferBalance` sengaja mengukur hal
  lain (kemajuan menuju aman), bukan bagian dari pembagian itu.
- Penyesuaian horizon dari ritme pemasukan hanya boleh memperpanjang, tidak
  pernah memperpendek — supaya penyesuaian otomatis tidak pernah membuat jatah
  lebih longgar dari yang pengguna izinkan.
- Masa tunggu keinginan dibekukan di `ready_on` saat dicatat. Jangan menghitung
  ulang saat dibaca; jatah yang naik akan memperpendek tunggu yang sedang
  berjalan, dan itu persis celah yang dicari dorongan impulsif.
- Tata letak baru harus diuji pada lebar 375px lebih dulu. Sasaran sentuh
  minimal 44px, dan `font-size` field isian tidak boleh turun di bawah 16px —
  di bawah itu Safari iOS memperbesar layar sendiri saat field disentuh.
- Nada coaching tetap tenang dan selalu berakhir dengan satu langkah konkret.
  Peringatan yang menghakimi membuat aplikasi ini ditinggalkan.

## Commit

Riwayat memakai prefix emoji dan deskripsi bahasa Indonesia
(`:hammer: menambahkan ...`). Ikuti pola itu.
