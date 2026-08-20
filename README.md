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
  ├─ ditahan              sebagian mengisi dana penyangga
  └─ boleh dibelanjakan   dibagi sepanjang jeda pemasukan → jatah harian
```

Keputusan yang membedakannya dari aplikasi pencatat biasa:

**Kewajiban dipotong di depan.** Sewa yang belum dibayar tidak pernah tampil
sebagai uang bebas. Konsekuensinya, saat kamu membayarnya, jatah harianmu tidak
ikut jatuh — uangnya memang sudah disisihkan sejak awal.

**Penyangga diisi bertahap, bukan jadi gerbang.** Sebagian uang tersedia (lihat
`bufferFillPercent`) mengisi penyangga dan sisanya tetap boleh dibelanjakan.
Menunggu penyangga penuh sebelum boleh belanja berarti jatah harian Rp 0 selama
berbulan-bulan — aturan yang mustahil dipatuhi akan ditinggalkan.

**Jatah dibagi sepanjang jeda pemasukan yang nyata.** Membagi uang sepanjang 30
hari padahal pemasukan datang tiap 42 hari adalah penyebab langsung kehabisan
uang di tengah jalan. Kalau riwayat menunjukkan jeda yang lebih panjang dari
setelan manual, jeda itu yang dipakai. Penyesuaiannya satu arah: hanya boleh
memperpanjang.

**Jatah harian dikunci, bukan dihitung ulang tiap hari.** Angkanya ditetapkan
per minggu dan hanya berubah kalau seminggu berlalu atau dana yang boleh
dibelanjakan berubah besar (≥20%). Angka yang bergoyang tiap hari tidak bisa
dijadikan pegangan.

**Sisa dan kelebihan terbawa, tapi dibatasi.** Sisa hari ini menambah jatah
besok maksimal 1× jatah; kelebihan memotong jatah besok maksimal 0,5×. Hemat
terasa hasilnya, boros ada konsekuensinya, tapi tidak ada spiral.

## Tiga momen yang ditangani

Pencatatan transaksi hanya mendokumentasikan uang yang sudah keluar — emosinya
selalu terlambat. Tiga tempat aplikasi ini bicara lebih awal:

**Hari uang masuk.** Pemasukan langsung dipecah jadi bagian-bagian yang punya
nama — menutup tagihan, mengisi penyangga, sisanya jatah harian — sebelum sempat
terasa seperti uang bebas seluruhnya (`lib/core/income.ts`).

**Saat laju terlalu cepat.** Pengeluaran kumulatif sejak pemasukan terakhir
dibandingkan dengan rencana. Kalau lajunya ≥1,5× rencana, aplikasi menyebutkan
kapan uangnya akan habis dan berapa hari sebelum pemasukan berikutnya biasanya
datang (`lib/core/pace.ts`).

**Sebelum membeli.** Keinginan dicatat lebih dulu dan ditahan 1–7 hari,
tergantung besarnya dibanding jatah harian. Harganya ditampilkan dalam hari
hidup, bukan hanya rupiah (`lib/core/wish.ts`).

## Coaching

Mesin aturan deterministik dengan prioritas tetap — yang pertama cocok menang,
jadi keluarannya tidak pernah bertentangan dengan dirinya sendiri. Urutannya
ada di `lib/core/insight.ts`, dari `onboarding_incomplete` sampai `steady`.

Fungsinya murni: tidak menyentuh database, tidak punya efek samping. Pencatatan
"memory" antar hari adalah langkah terpisah, jadi sekadar me-refresh halaman
tidak mencemari riwayat.

Nadanya sengaja tenang. Peringatan yang menghakimi setelah uang habis hanya
menghasilkan rasa bersalah, dan rasa bersalah membuat orang berhenti membuka
aplikasinya.

## Arsitektur

```
Next.js App Router (server components + server actions)
        |
lib/core/     logika murni, tanpa I/O, teruji unit test
              funds · allowance · cadence · pace · income · wish · insight
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
