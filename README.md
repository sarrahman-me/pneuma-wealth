# PNEUMA

Pelacak keuangan pribadi yang tenang, berbasis web. Fokusnya satu pertanyaan:
**berapa yang boleh saya belanjakan hari ini, tanpa merusak besok.**

Dirancang untuk pemasukan yang tidak menentu — freelance, usaha, proyek — di
mana metrik yang berguna bukan "sisa bulan ini", tapi **runway**: berapa lama
kamu aman tanpa pemasukan baru.

## Cara kerjanya

Uangmu dipilah berlapis, dan tiap lapis punya alasan:

```
saldo likuid              saldo akun harian (tabungan tidak termasuk)
− kewajiban terjadwal     tagihan belum lunas yang jatuh tempo dalam horizon
= uang tersedia           yang benar-benar bebas kamu atur
− dana penyangga          biaya hidup harian × target hari penyangga
= dana fleksibel          dibagi sepanjang horizon jatah → jatah harian
```

Tiga keputusan yang membedakannya dari aplikasi pencatat biasa:

**Kewajiban dipotong di depan.** Sewa yang belum dibayar tidak pernah tampil
sebagai uang bebas. Konsekuensinya, saat kamu membayarnya, jatah harianmu tidak
ikut jatuh — uangnya memang sudah disisihkan sejak awal.

**Jatah harian dikunci, bukan dihitung ulang tiap hari.** Angkanya ditetapkan
per minggu dan hanya berubah kalau seminggu berlalu atau dana fleksibel berubah
besar (≥20%). Angka yang bergoyang tiap hari tidak bisa dijadikan pegangan.

**Sisa dan kelebihan terbawa, tapi dibatasi.** Sisa hari ini menambah jatah
besok maksimal 1× jatah; kelebihan memotong jatah besok maksimal 0,5×. Hemat
terasa hasilnya, boros ada konsekuensinya, tapi tidak ada spiral.

## Coaching

Mesin aturan deterministik dengan prioritas tetap — yang pertama cocok menang,
jadi keluarannya tidak pernah bertentangan dengan dirinya sendiri. Urutannya
ada di `lib/core/insight.ts`, dari `onboarding_incomplete` sampai `steady`.

Fungsinya murni: tidak menyentuh database, tidak punya efek samping. Pencatatan
"memory" antar hari adalah langkah terpisah, jadi sekadar me-refresh halaman
tidak mencemari riwayat.

## Arsitektur

```
Next.js App Router (server components + server actions)
        |
lib/core/     logika murni, tanpa I/O, teruji unit test
lib/server/   perakitan state, query, auth
        |
Drizzle ORM → Neon Postgres
```

Semua nilai uang adalah bilangan bulat rupiah. Tidak ada tipe pecahan di mana
pun. `date_local` selalu dihitung terhadap zona waktu pengguna, bukan zona
waktu server.

## Pengembangan

```bash
npm install
npm run dev
```

Tanpa kunci Clerk, aplikasi berjalan dengan pengguna dev lokal — praktis untuk
mengembangkan UI. Di produksi, ketiadaan Clerk membuat aplikasi menolak jalan,
bukan melayani data keuangan tanpa autentikasi.

| Perintah | Fungsi |
|---|---|
| `npm run check` | lint + typecheck + test |
| `npm run test` | unit test logika inti |
| `npm run db:generate` | buat migrasi dari perubahan skema |
| `npm run db:migrate` | terapkan migrasi |
| `npm run db:studio` | lihat isi database |

Environment: `vercel env pull .env.local`.

## Status

Project pribadi. Siklus biaya tetap yang didukung baru bulanan; enum
`recurrence` di skema sudah menyiapkan mingguan dan tahunan, tapi UI belum
menawarkannya.
