import Link from 'next/link'
import { formatRupiah } from '@/lib/core/format'
import { getCurrentUser } from '@/lib/server/user'
import { getDailyState } from '@/lib/server/state'
import SetupChecklist, { type ChecklistItem } from './SetupChecklist'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Panduan · PNEUMA',
  description: 'Cara memakai PNEUMA sehari-hari',
}

const SECTIONS = [
  { id: 'siapkan', label: 'Siapkan sekali saja' },
  { id: 'harian', label: 'Rutinitas harian' },
  { id: 'uang-masuk', label: 'Saat uang masuk' },
  { id: 'ingin-beli', label: 'Saat ingin membeli sesuatu' },
  { id: 'angka', label: 'Membaca angka di Beranda' },
  { id: 'grafik', label: 'Membaca grafik' },
  { id: 'kerja-sama', label: 'Pembagian tugas' },
  { id: 'aneh', label: 'Kalau angkanya terasa aneh' },
  { id: 'istilah', label: 'Istilah' },
]

export default async function GuidePage() {
  const user = await getCurrentUser()
  const state = user ? await getDailyState(user) : null

  const checklist: ChecklistItem[] | null =
    user && state
      ? [
          {
            id: 'biaya-hidup',
            title: 'Isi biaya hidup harian',
            done: user.settings.dailyLivingCost > 0,
            doneNote: `Terisi ${formatRupiah(user.settings.dailyLivingCost)} per hari.`,
            todoNote:
              'Tanpa angka ini, aplikasi tidak bisa menghitung apa pun tentang rasa aman.',
            href: '/rules',
            hrefLabel: 'Buka Aturan',
          },
          {
            id: 'biaya-tetap',
            title: 'Daftarkan tagihan rutin',
            done: state.obligations.unpaidCount > 0 || state.funds.scheduledObligations > 0,
            doneNote: `${state.obligations.unpaidCount} tagihan tercatat dan sudah disisihkan.`,
            todoNote:
              'Sewa, listrik, internet, cicilan. Uangnya langsung dipisahkan supaya tidak ikut terbelanjakan.',
            href: '/fixed-costs',
            hrefLabel: 'Buka Biaya Tetap',
          },
          {
            id: 'catat',
            title: 'Catat pengeluaran beberapa hari',
            done: state.stats.txCountTotal >= 5,
            doneNote: `${state.stats.txCountTotal} catatan sudah masuk.`,
            todoNote:
              'Aplikasi baru bisa melihat pola setelah ada beberapa catatan. Tidak perlu rapi, yang penting rutin.',
            href: '/',
            hrefLabel: 'Buka Beranda',
          },
          {
            id: 'ritme',
            title: 'Biarkan aplikasi belajar ritme pemasukanmu',
            done: state.cadence.confident,
            doneNote:
              state.cadence.medianGap !== null
                ? `Sudah terbaca: pemasukan datang sekitar ${state.cadence.medianGap} hari sekali.`
                : 'Sudah terbaca.',
            todoNote: `Butuh empat kali pemasukan tercatat. Sekarang baru ${state.cadence.count}.`,
            href: '/summary',
            hrefLabel: 'Lihat Ringkasan',
          },
        ]
      : null

  return (
    <main className="guide">
      <h1>Panduan</h1>
      <p className="guide-lead">
        Aplikasi ini menjawab satu pertanyaan setiap hari:{' '}
        <strong>berapa yang boleh saya belanjakan hari ini, tanpa merusak besok.</strong>{' '}
        Semua yang ada di dalamnya hanya alat untuk menjawab itu dengan jujur.
      </p>
      <p className="guide-lead">
        Kamu tidak perlu tahu apa pun soal keuangan untuk memakainya. Cukup dua
        kebiasaan: catat uang yang keluar, dan lihat angka &ldquo;boleh dipakai hari
        ini&rdquo; sebelum belanja.
      </p>

      <nav className="guide-toc" aria-label="Daftar isi">
        <p className="guide-toc-title">Isi panduan</p>
        <ol>
          {SECTIONS.map((section) => (
            <li key={section.id}>
              <a href={`#${section.id}`}>{section.label}</a>
            </li>
          ))}
        </ol>
      </nav>

      <section id="siapkan" className="guide-section">
        <h2>1. Siapkan sekali saja</h2>
        <p>
          Ini hanya dilakukan di awal. Setelah selesai, kamu tidak perlu menyentuhnya
          lagi kecuali keadaanmu berubah.
        </p>

        <ol className="guide-steps">
          <li>
            <h3>Isi biaya hidup harian</h3>
            <p>
              Perkiraan kasar biaya <em>bertahan hidup</em> per hari: makan, transport,
              hal-hal yang tidak bisa dilewati. Bukan gaya hidup, bukan target hemat.
              Kalau ragu, ambil angka yang sedikit lebih besar — lebih aman.
            </p>
            <p className="guide-note">
              Angka ini dipakai untuk menghitung berapa lama kamu bisa bertahan, dan
              untuk menerjemahkan harga jadi &ldquo;berapa hari hidup&rdquo;. Angka ini
              <strong> tidak</strong> menentukan jatah belanjamu.
            </p>
          </li>
          <li>
            <h3>Daftarkan tagihan rutin</h3>
            <p>
              Sewa, listrik, internet, cicilan — apa pun yang datang tiap bulan. Begitu
              didaftarkan, uangnya langsung dianggap bukan milikmu lagi, bahkan sebelum
              dibayar.
            </p>
            <p className="guide-note">
              Karena itu, saat kamu membayarnya nanti, jatah harianmu tidak ikut jatuh.
              Uangnya memang sudah disisihkan sejak awal.
            </p>
          </li>
          <li>
            <h3>Biarkan sisanya apa adanya</h3>
            <p>
              Setelan lain di halaman Aturan sudah punya nilai bawaan yang masuk akal.
              Jangan diubah sampai kamu punya alasan. Aplikasi akan memberi tahu kalau
              ada yang sebaiknya disesuaikan.
            </p>
          </li>
        </ol>

        {checklist ? (
          <SetupChecklist items={checklist} />
        ) : (
          <p className="guide-note">
            <Link href="/sign-in">Masuk</Link> untuk melihat sejauh mana persiapanmu
            sudah selesai.
          </p>
        )}
      </section>

      <section id="harian" className="guide-section">
        <h2>2. Rutinitas harian</h2>
        <p>
          Satu menit sehari, tidak lebih. Kalau terasa lebih berat dari itu, ada yang
          salah dengan caranya.
        </p>

        <div className="guide-routine">
          <article>
            <h3>Pagi</h3>
            <p>
              Buka Beranda. Lihat satu angka besar:{' '}
              <strong>Boleh dipakai hari ini</strong>. Itu batasmu. Tidak perlu
              menghafal apa pun lagi.
            </p>
          </article>
          <article>
            <h3>Sepanjang hari</h3>
            <p>
              Setiap kali uang keluar, catat. Isi jumlahnya, pilih kategori, tekan
              Simpan. Keterangan boleh dikosongkan.
            </p>
          </article>
          <article>
            <h3>Kalau lupa</h3>
            <p>
              Catat besoknya, ubah tanggalnya ke hari kemarin. Lupa itu wajar dan tidak
              merusak apa pun.
            </p>
          </article>
        </div>

        <div className="guide-callout">
          <h3>Yang sering bikin ragu</h3>
          <dl className="guide-qa">
            <dt>Harus catat sampai serupiah?</dt>
            <dd>
              Tidak. Bulatkan saja. Yang penting polanya benar, bukan angkanya
              sempurna.
            </dd>

            <dt>Kalau belanja pakai uang tunai yang sudah lama di dompet?</dt>
            <dd>Tetap catat. Semua uang yang keluar dihitung sama.</dd>

            <dt>Bayar tagihan bulanan, dicatat di mana?</dt>
            <dd>
              Bukan di Beranda. Buka <Link href="/fixed-costs">Biaya Tetap</Link> lalu
              tekan &ldquo;Tandai lunas&rdquo;. Kalau dicatat sebagai pengeluaran biasa,
              uangnya terhitung dua kali dan jatahmu jadi salah.
            </dd>

            <dt>Salah catat?</dt>
            <dd>
              Tekan &ldquo;Hapus&rdquo; di baris itu, lalu catat ulang. Tidak ada yang
              rusak.
            </dd>

            <dt>Hari ini tidak belanja sama sekali?</dt>
            <dd>Biarkan kosong. Itu juga catatan yang sah.</dd>
          </dl>
        </div>
      </section>

      <section id="uang-masuk" className="guide-section">
        <h2>3. Saat uang masuk</h2>
        <p>
          Ini hari paling menentukan, dan justru paling sering diremehkan. Angka besar
          di rekening terasa seperti uang bebas, padahal sebagian besar sudah punya
          pemilik.
        </p>
        <ol className="guide-steps">
          <li>
            <h3>Catat pemasukannya</h3>
            <p>
              Di Beranda, pindahkan tombol dari <strong>Pengeluaran</strong> ke{' '}
              <strong>Pemasukan</strong>, isi jumlahnya, Simpan.
            </p>
          </li>
          <li>
            <h3>Baca kartu yang muncul</h3>
            <p>
              Aplikasi langsung memecah uang itu di depan matamu: berapa untuk menutup
              tagihan, berapa mengisi dana cadangan, berapa yang benar-benar boleh
              dibelanjakan — dan berapa jatah harianmu sekarang.
            </p>
          </li>
          <li>
            <h3>Jangan belanja besar hari itu</h3>
            <p>
              Ini satu-satunya saran yang bersifat perilaku di panduan ini, dan yang
              paling menentukan. Uang yang baru masuk terasa jauh lebih banyak daripada
              yang sebenarnya. Kalau ada yang ingin dibeli, masukkan ke daftar keinginan
              dulu.
            </p>
          </li>
        </ol>
        <div className="guide-callout">
          <h3>Kenapa jatah harian tidak melonjak setinggi yang diharapkan</h3>
          <p>
            Karena uang itu harus bertahan sampai pemasukan berikutnya, dan aplikasi
            tahu dari riwayatmu berapa lama biasanya jeda itu. Kalau pemasukan datang
            tiap 42 hari, uangnya dibagi 42 hari — bukan 30. Membagi lebih cepat dari
            datangnya pemasukan adalah cara paling pasti untuk kehabisan di tengah
            jalan.
          </p>
        </div>
      </section>

      <section id="ingin-beli" className="guide-section">
        <h2>4. Saat ingin membeli sesuatu</h2>
        <p>
          Halaman <Link href="/wishlist">Keinginan</Link> adalah satu-satunya tempat
          aplikasi ini ikut campur <em>sebelum</em> uang keluar. Sisanya hanya mencatat
          yang sudah lewat.
        </p>
        <ol className="guide-steps">
          <li>
            <h3>Tulis dulu, jangan beli dulu</h3>
            <p>
              Isi nama barang dan perkiraan harganya, tekan &ldquo;Tahan dulu&rdquo;.
              Butuh sepuluh detik.
            </p>
          </li>
          <li>
            <h3>Tunggu</h3>
            <p>
              Aplikasi menahannya 1 sampai 7 hari, tergantung seberapa besar dibanding
              jatah harianmu. Makin besar, makin lama. Selama menunggu, kamu bisa
              melihat harganya diterjemahkan jadi &ldquo;berapa hari hidup&rdquo;.
            </p>
          </li>
          <li>
            <h3>Putuskan</h3>
            <p>
              Setelah waktunya habis, muncul dua tombol:{' '}
              <strong>&ldquo;Masih mau, beli&rdquo;</strong> — dan pembelian itu
              langsung tercatat sebagai pengeluaran — atau{' '}
              <strong>&ldquo;Lepaskan&rdquo;</strong>.
            </p>
          </li>
        </ol>
        <div className="guide-callout">
          <p>
            Yang kamu lepaskan tidak dihapus. Jumlahnya dikumpulkan sebagai{' '}
            <strong>uang yang tidak jadi keluar karena kamu menunggu</strong>. Itu satu-
            satunya angka di aplikasi ini yang murni hasil menahan diri, dan biasanya
            jauh lebih besar dari dugaan.
          </p>
        </div>
      </section>

      <section id="angka" className="guide-section">
        <h2>5. Membaca angka di Beranda</h2>
        <dl className="guide-glossary">
          <dt>Boleh dipakai hari ini</dt>
          <dd>
            Satu-satunya angka yang perlu kamu ingat. Sudah memperhitungkan tagihan yang
            belum dibayar, dana cadangan, dan sisa atau kelebihan kemarin.
          </dd>

          <dt>Sisa</dt>
          <dd>
            Bagian dari jatah hari ini yang belum terpakai. Batang berwarna di bawah
            angka besar menunjukkan hal yang sama secara sekilas.
          </dd>

          <dt>Runway</dt>
          <dd>
            Berapa hari kamu bisa bertahan tanpa pemasukan baru sama sekali, setelah
            semua tagihan lunas. Ini angka rasa aman, bukan angka belanja.
          </dd>

          <dt>Siklus berjalan</dt>
          <dd>Sudah hari ke berapa sejak uang terakhir masuk.</dd>

          <dt>Laju vs rencana</dt>
          <dd>
            1× berarti kamu belanja persis sesuai rencana. 2× berarti dua kali lebih
            cepat. Angka ini berubah merah kalau mulai mengkhawatirkan.
          </dd>

          <dt>Habis dalam</dt>
          <dd>
            Kalau kamu terus belanja dengan kecepatan sekarang, uangnya habis dalam
            sekian hari. Bandingkan dengan &ldquo;Pemasukan biasanya&rdquo; di
            sebelahnya — kalau angka ini lebih kecil, ada lubang yang perlu ditutup.
          </dd>
        </dl>
      </section>

      <section id="grafik" className="guide-section">
        <h2>6. Membaca grafik</h2>
        <dl className="guide-glossary">
          <dt>Sejak pemasukan terakhir</dt>
          <dd>
            Garis tebal adalah uang yang sudah kamu pakai, menumpuk dari hari uang
            masuk. Garis putus-putus adalah rencananya. Kalau garis tebal menanjak
            curam di kiri lalu jauh di atas garis putus-putus, itulah bentuk visual dari
            &ldquo;habis di minggu pertama&rdquo;. Garis tegak di kanan menandai kapan
            pemasukan berikutnya biasanya datang.
          </dd>

          <dt>Ritme 14 hari</dt>
          <dd>
            Satu batang per hari. Batang merah berarti hari itu melewati jatah. Beberapa
            batang merah tidak masalah; yang perlu diperhatikan adalah kalau semuanya
            menumpuk di awal.
          </dd>

          <dt>Ke mana uangmu sudah dijanjikan</dt>
          <dd>
            Di halaman <Link href="/summary">Ringkasan</Link>. Satu batang yang dipecah
            tiga: tagihan, dana cadangan, dan bagian yang boleh dibelanjakan. Biasanya
            bagian terakhir jauh lebih kecil dari yang terasa.
          </dd>

          <dt>Jeda antar pemasukan</dt>
          <dd>
            Juga di Ringkasan. Tiap batang adalah satu jeda yang pernah kamu alami.
            Batang paling kanan bergaris-garis: itu jeda yang sedang berjalan sekarang.
            Kalau sudah melewati garis putus-putus, jeda kali ini lebih panjang dari
            biasanya.
          </dd>
        </dl>
      </section>

      <section id="kerja-sama" className="guide-section">
        <h2>7. Pembagian tugas</h2>
        <p>
          Aplikasi ini tidak bisa mengatur uangmu sendirian, dan tidak berpura-pura
          bisa. Pembagiannya jelas.
        </p>

        <div className="guide-split">
          <article>
            <h3>Tugas aplikasi</h3>
            <ul>
              <li>Menyisihkan uang tagihan sebelum kamu sempat memakainya.</li>
              <li>Menghitung batas harian yang jujur, dan menguncinya supaya stabil.</li>
              <li>
                Membagi uang sepanjang jeda pemasukan yang benar-benar kamu alami,
                bukan sepanjang angka tebakan.
              </li>
              <li>Memberi tahu kalau lajumu terlalu cepat, sebelum uangnya habis.</li>
              <li>Menahan keinginan sebentar supaya dorongan sesaat punya waktu reda.</li>
              <li>Tidak pernah menghakimi, dan selalu memberi satu langkah berikutnya.</li>
            </ul>
          </article>

          <article>
            <h3>Tugas kamu</h3>
            <ul>
              <li>Catat uang yang keluar. Ini satu-satunya hal yang wajib.</li>
              <li>Catat uang yang masuk di hari yang sama.</li>
              <li>Tandai tagihan lunas di halaman Biaya Tetap, bukan di Beranda.</li>
              <li>Lihat batas harian sebelum belanja, bukan sesudah.</li>
              <li>Masukkan keinginan ke daftar tunggu, bukan langsung ke keranjang.</li>
              <li>
                Jujur pada angkanya. Catatan yang dipercantik hanya menipu dirimu
                sendiri.
              </li>
            </ul>
          </article>
        </div>

        <div className="guide-callout">
          <h3>Kalau melewati batas</h3>
          <p>
            Tidak ada hukuman, dan tidak perlu merasa gagal. Kelebihan hari ini memotong
            jatah besok, tapi paling banyak setengahnya — supaya satu hari yang buruk
            tidak berubah jadi minggu yang buruk. Begitu juga sebaliknya: hemat hari ini
            menambah jatah besok. Lanjutkan saja mencatat.
          </p>
        </div>
      </section>

      <section id="aneh" className="guide-section">
        <h2>8. Kalau angkanya terasa aneh</h2>
        <dl className="guide-qa">
          <dt>Jatah harian terasa terlalu kecil</dt>
          <dd>
            Biasanya karena dana cadangan masih diisi. Selama belum penuh, sebagian
            uangmu memang ditahan. Kalau terlalu ketat, turunkan{' '}
            <strong>Porsi pengisian penyangga</strong> di{' '}
            <Link href="/rules">Aturan</Link> — misalnya dari 55% ke 35%. Kamu akan lebih
            longgar sehari-hari, tapi lebih lama sampai aman.
          </dd>

          <dt>Jatah harian terasa terlalu besar</dt>
          <dd>
            Turunkan <strong>Jatah maksimum</strong> di Aturan. Itu batas atas yang
            menahan lonjakan setelah pemasukan besar.
          </dd>

          <dt>Runway terlihat mustahil panjang atau pendek</dt>
          <dd>
            Periksa biaya hidup harian. Angka itu yang membagi, jadi salah sedikit di
            sana akan terasa besar di sini.
          </dd>

          <dt>Saldo tidak cocok dengan rekening asli</dt>
          <dd>
            Aplikasi hanya tahu apa yang kamu catat. Kalau ada pemasukan atau pengeluaran
            yang terlewat, catat susulan dengan tanggal yang benar.
          </dd>

          <dt>Ringkasan menyarankan mengubah target hari penyangga</dt>
          <dd>
            Ikuti saja. Saran itu datang dari jeda pemasukan yang benar-benar pernah kamu
            alami, sedangkan angka bawaan hanya tebakan.
          </dd>
        </dl>
      </section>

      <section id="istilah" className="guide-section">
        <h2>9. Istilah</h2>
        <dl className="guide-glossary">
          <dt>Jatah harian</dt>
          <dd>Batas belanja hari ini. Dikunci per minggu supaya tidak bergoyang.</dd>

          <dt>Dana penyangga</dt>
          <dd>
            Tabungan darurat di dalam aplikasi. Bukan rekening terpisah — hanya bagian
            saldomu yang sengaja tidak boleh disentuh.
          </dd>

          <dt>Kewajiban terjadwal</dt>
          <dd>Tagihan yang belum dibayar tapi sudah pasti akan dibayar.</dd>

          <dt>Uang tersedia</dt>
          <dd>Saldo dikurangi tagihan yang belum dibayar.</dd>

          <dt>Boleh dibelanjakan</dt>
          <dd>
            Bagian uang tersedia yang bukan dana penyangga. Inilah yang dibagi jadi jatah
            harian.
          </dd>

          <dt>Horizon</dt>
          <dd>Rentang hari yang dipakai untuk membagi uang jadi jatah harian.</dd>
        </dl>

        <p className="guide-note">
          Masih ada yang membingungkan? Angka-angka detailnya selalu bisa dilihat di{' '}
          <Link href="/summary">Ringkasan</Link>, lengkap dengan penjelasan dari mana
          asalnya.
        </p>
      </section>
    </main>
  )
}
