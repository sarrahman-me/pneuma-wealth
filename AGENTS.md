# Repository Guidelines

## Struktur

Aplikasi web Next.js (App Router) dengan Postgres via Drizzle.

- `lib/core/` — logika murni: waterfall dana, jatah harian, insight, tanggal.
  Tidak boleh mengimpor apa pun yang menyentuh I/O. Semua perilaku di sini
  wajib punya unit test.
- `lib/server/` — perakitan state, query database, auth. Ditandai `server-only`.
- `lib/db/` — skema Drizzle, klien, migrasi ter-versioned.
- `app/` — halaman dan komponen; `app/actions/` berisi server actions.

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

## Commit

Riwayat memakai prefix emoji dan deskripsi bahasa Indonesia
(`:hammer: menambahkan ...`). Ikuti pola itu.
