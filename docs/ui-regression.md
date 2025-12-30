# UI Regression Checklist

Gunakan checklist ini setelah perubahan UI/UX untuk memastikan halaman tetap konsisten dan tidak ada regresi visual/flow.

## Beranda
- Hero harian tampil:
  - Rekomendasi Belanja Hari Ini (angka besar)
  - Sisa Hari Ini (angka besar)
  - Badge “Melebihi Anggaran” muncul saat overspent.
- Input cepat:
  - Tab “Pengeluaran/Pemasukan” bisa diganti.
  - Input nominal besar, tombol submit disabled jika kosong/<=0.
  - “Ubah tanggal” membuka input tanggal, default hari ini.
  - Setelah submit: input kosong, status “Tersimpan.” muncul.
- Transaksi Hari Ini:
  - Menampilkan label Masuk/Keluar, nominal, jam, badge sumber.
  - Tombol Hapus bekerja, state “Menghapus...” terlihat.
  - Link “Lihat semua riwayat →” ke halaman Riwayat.

## Riwayat
- Toolbar filter:
  - Segmented: Hari ini / 7 hari / 30 hari
  - Filter jenis: Semua / Pengeluaran / Pemasukan
- List transaksi:
  - Menampilkan tanggal, jam, nominal, badge sumber.
  - Hapus berfungsi dan menampilkan status.
- Load more:
  - Tombol “Muat lebih banyak” disable saat loading/habis.
- State kosong:
  - Pesan “Belum ada transaksi di rentang ini.”

## Ringkasan Dana
- Toolbar “Muat Ulang” + error state muncul saat gagal.
- Grid metrik:
  - Card layout rapi, tidak overflow.
  - Dana Fleksibel detail via <details>.
- Status overspent:
  - Card warning muncul saat overspent.
- Panduan singkat <details> berfungsi.

## Aturan / Konfigurasi
- Hero ringkas:
  - Min Harian, Max Harian, Target Hari, Target Dana Penyangga.
- Form editor:
  - 3 input dengan helper text.
  - Validasi: min <= max, target hari >= 1.
  - “Tersimpan” muncul sebagai pill.
  - Error tampil sebagai alert.
- Preview microcopy sesuai nilai.

## Biaya Tetap
- Form “Tambah Biaya Tetap”:
  - Nama, Jumlah, Tanggal Bayar Default.
  - Error tampil sebagai alert.
- Filter segmented:
  - Semua / Belum Lunas / Lunas (filter frontend).
- Summary periode:
  - Total periode, Sudah Lunas, Sisa Belum Lunas.
- List item:
  - Nama + jumlah, pill status, tombol Tandai/Batalkan, Hapus.
  - State kosong: “Belum ada biaya tetap.”

## Manual Steps Cepat (smoke)
1) Beranda: input Pengeluaran, simpan, cek list + ringkasan.
2) Riwayat: pilih 7 hari, filter Pengeluaran, load more.
3) Ringkasan Dana: buka detail Dana Fleksibel, cek warning overspent.
4) Aturan: ubah min/max/hari, simpan, cek pill “Tersimpan”.
5) Biaya Tetap: tambah item, tandai lunas, cek summary & filter.
