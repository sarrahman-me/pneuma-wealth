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
  { id: 'istilah', label: 'Arti kata-kata di sini' },
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
              'Tanpa angka ini, aplikasi tidak bisa menghitung apa-apa soal rasa aman.',
            href: '/rules',
            hrefLabel: 'Buka Aturan',
          },
          {
            id: 'biaya-tetap',
            title: 'Daftarkan tagihan rutin',
            done: state.obligations.unpaidCount > 0 || state.funds.scheduledObligations > 0,
            doneNote: `${state.obligations.unpaidCount} tagihan tercatat dan uangnya sudah dipisahkan.`,
            todoNote:
              'Kontrakan, listrik, internet, cicilan. Uangnya langsung dipisahkan supaya tidak ikut terbelanjakan.',
            href: '/fixed-costs',
            hrefLabel: 'Buka Tagihan Rutin',
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
            title: 'Biarkan aplikasi mengenali pola uang masukmu',
            done: state.cadence.confident,
            doneNote:
              state.cadence.medianGap !== null
                ? `Sudah kebaca: uang masuk sekitar ${state.cadence.medianGap} hari sekali.`
                : 'Sudah kebaca.',
            todoNote: `Butuh empat kali uang masuk tercatat. Sekarang baru ${state.cadence.count}.`,
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
              Kira-kira berapa yang kamu butuhkan sehari untuk <em>bertahan hidup</em>:
              makan, transport, hal-hal yang tidak bisa dilewati. Bukan gaya hidup, bukan
              target hemat. Kalau ragu, ambil angka yang agak lebih besar — lebih aman.
            </p>
            <p className="guide-note">
              Angka ini dipakai untuk menghitung berapa lama kamu bisa bertahan, dan
              untuk mengubah harga jadi &ldquo;berapa hari hidup&rdquo;. Angka ini
              <strong> tidak</strong> menentukan jatah belanjamu.
            </p>
          </li>
          <li>
            <h3>Daftarkan tagihan rutin</h3>
            <p>
              Kontrakan, listrik, internet, cicilan — apa pun yang datang tiap bulan.
              Begitu didaftarkan, uangnya langsung dianggap bukan hakmu lagi, walaupun
              belum dibayar.
            </p>
            <p className="guide-note">
              Karena itu, waktu kamu bayar nanti, jatah harianmu tidak ikut anjlok.
              Uangnya memang sudah dipisahkan sejak awal.
            </p>
          </li>
          <li>
            <h3>Biarkan sisanya apa adanya</h3>
            <p>
              Setelan lain di halaman Aturan sudah diisi angka yang masuk akal. Biarkan
              saja sampai kamu punya alasan mengubahnya. Aplikasi akan memberi tahu kalau
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

            <dt>Bayar tagihan rutin, dicatat di mana?</dt>
            <dd>
              Bukan di Beranda. Buka <Link href="/fixed-costs">Tagihan Rutin</Link> lalu
              tekan &ldquo;Sudah dibayar&rdquo;. Kalau dicatat sebagai pengeluaran biasa,
              uangnya terhitung dua kali dan jatahmu jadi keliru.
            </dd>

            <dt>Tagihanku ada yang mingguan dan tahunan, bukan bulanan?</dt>
            <dd>
              Pilih pengulangannya waktu menambah di Tagihan Rutin: setiap hari, minggu,
              bulan, atau tahun. Yang dipisahkan adalah setiap kali tagihan itu jatuh tempo
              dalam beberapa hari ke depan — jadi langganan mingguan dipisahkan empat kali
              sebulan, dan tagihan tahunan baru dipisahkan kalau waktunya sudah dekat.
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
          Ini hari yang paling menentukan, dan justru paling sering disepelekan. Angka
          besar di rekening terasa seperti uang bebas, padahal sebagian besar sudah ada
          yang punya.
        </p>
        <ol className="guide-steps">
          <li>
            <h3>Catat pemasukannya</h3>
            <p>
              Di Beranda, pindahkan tombol dari <strong>Uang keluar</strong> ke{' '}
              <strong>Uang masuk</strong>, isi jumlahnya, Simpan.
            </p>
          </li>
          <li>
            <h3>Baca kartu yang muncul</h3>
            <p>
              Aplikasi langsung membagi uang itu di depan matamu: berapa untuk bayar
              tagihan, berapa untuk mengisi dana cadangan, berapa yang benar-benar boleh
              dibelanjakan — dan berapa jatah harianmu sekarang.
            </p>
          </li>
          <li>
            <h3>Jangan belanja besar hari itu</h3>
            <p>
              Ini satu-satunya saran soal kebiasaan di panduan ini, dan yang paling
              menentukan. Uang yang baru masuk selalu terasa jauh lebih banyak dari yang
              sebenarnya. Kalau ada yang ingin dibeli, masukkan ke daftar Keinginan dulu.
            </p>
          </li>
        </ol>
        <div className="guide-callout">
          <h3>Kenapa jatah harian tidak melonjak setinggi yang diharapkan</h3>
          <p>
            Karena uang itu harus cukup sampai uang masuk berikutnya, dan aplikasi tahu
            dari riwayatmu berapa lama biasanya jaraknya. Kalau uang masuk tiap 42 hari,
            uangnya dibagi 42 hari — bukan 30. Membagi lebih cepat dari datangnya uang
            berikutnya adalah cara paling pasti untuk kehabisan di tengah jalan.
          </p>
        </div>
      </section>

      <section id="ingin-beli" className="guide-section">
        <h2>4. Saat ingin membeli sesuatu</h2>
        <p>
          Halaman <Link href="/wishlist">Keinginan</Link> adalah satu-satunya tempat
          aplikasi ini ikut campur <em>sebelum</em> uang keluar. Sisanya hanya mencatat
          yang sudah terjadi.
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
              Aplikasi menahannya 1 sampai 7 hari, tergantung seberapa besar harganya
              dibanding jatah harianmu. Makin besar, makin lama. Selama menunggu, harganya
              ditampilkan juga sebagai &ldquo;berapa hari hidup&rdquo;.
            </p>
          </li>
          <li>
            <h3>Lihat harganya bagi hari-harimu</h3>
            <p>
              Di bawah tiap keinginan ada satu baris yang menghitung akibatnya kalau
              dibeli hari ini: jatah harianmu jadi berapa, dan dana cadanganmu tinggal
              berapa. Baris itu juga menyebut kalau sebagian harganya terpaksa diambil
              dari dana cadangan, atau bahkan dari uang yang sudah jadi milik tagihan.
              Angkanya cuma memberi tahu — tombol belinya tidak pernah dikunci, karena
              itu tetap uangmu.
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
            <strong>uang yang tidak jadi keluar karena kamu mau menunggu</strong>. Cuma
            angka ini di seluruh aplikasi yang murni hasil menahan diri, dan biasanya jauh
            lebih besar dari yang kamu kira.
          </p>
        </div>
      </section>

      <section id="angka" className="guide-section">
        <h2>5. Membaca angka di Beranda</h2>
        <dl className="guide-glossary">
          <dt>Boleh dipakai hari ini</dt>
          <dd>
            Satu-satunya angka yang perlu kamu ingat. Tagihan yang belum dibayar, dana
            cadangan, serta sisa atau kelebihan kemarin sudah ikut dihitung di sini.
          </dd>

          <dt>Sisa</dt>
          <dd>
            Bagian dari jatah hari ini yang belum terpakai. Batang berwarna di bawah
            angka besar menunjukkan hal yang sama secara sekilas.
          </dd>

          <dt>Uangnya cukup untuk</dt>
          <dd>
            Berapa hari kamu masih bisa hidup kalau tidak ada uang masuk sama sekali,
            setelah semua tagihan dibayar. Ini angka rasa aman, bukan angka belanja.
          </dd>

          <dt>Sejak uang masuk</dt>
          <dd>Sudah hari ke berapa sejak uang terakhir masuk.</dd>

          <dt>Kecepatan belanja</dt>
          <dd>
            1× berarti belanjamu pas sesuai rencana. 2× berarti dua kali lebih cepat.
            Angkanya berubah merah kalau sudah mulai mengkhawatirkan.
          </dd>

          <dt>Habis dalam</dt>
          <dd>
            Kalau belanjamu segini terus, uangnya habis dalam sekian hari. Bandingkan
            dengan &ldquo;Uang masuk biasanya&rdquo; di sebelahnya — kalau angka ini lebih
            kecil, ada lubang yang perlu ditutup.
          </dd>
        </dl>
      </section>

      <section id="grafik" className="guide-section">
        <h2>6. Membaca grafik</h2>
        <dl className="guide-glossary">
          <dt>Sejak uang terakhir masuk</dt>
          <dd>
            Garis tebal adalah uang yang sudah kamu pakai, menumpuk sejak hari uang masuk.
            Garis putus-putus adalah rencananya. Kalau garis tebal menanjak curam di kiri
            lalu jauh di atas garis putus-putus, begitulah rupanya &ldquo;habis di minggu
            pertama&rdquo;. Garis tegak di kanan menandai kapan biasanya uang masuk lagi.
          </dd>

          <dt>14 hari terakhir</dt>
          <dd>
            Satu batang untuk satu hari. Batang merah berarti hari itu lewat dari jatah.
            Beberapa batang merah tidak apa-apa; yang perlu diperhatikan kalau semuanya
            menumpuk di awal.
          </dd>

          <dt>Uangmu sudah dipesan untuk apa saja</dt>
          <dd>
            Di halaman <Link href="/summary">Ringkasan</Link>. Satu batang yang dibagi
            tiga: tagihan, dana cadangan, dan bagian yang boleh dibelanjakan. Biasanya
            bagian terakhir jauh lebih kecil dari yang terasa.
          </dd>

          <dt>Jarak antar uang masuk</dt>
          <dd>
            Juga di Ringkasan. Tiap batang adalah satu jarak yang pernah kamu alami.
            Batang paling kanan bergaris-garis: itu jarak yang sedang berjalan sekarang.
            Kalau sudah lewat dari garis putus-putus, kali ini lebih lama dari biasanya.
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
              <li>Memisahkan uang tagihan sebelum kamu sempat memakainya.</li>
              <li>Menghitung batas harian yang jujur, dan menguncinya supaya tidak goyang.</li>
              <li>
                Membagi uang sepanjang jarak uang masuk yang benar-benar kamu alami, bukan
                sepanjang angka tebakan.
              </li>
              <li>Memberi tahu kalau belanjamu terlalu cepat, sebelum uangnya habis.</li>
              <li>Menahan keinginan sebentar supaya kepingin sesaat punya waktu reda.</li>
              <li>Tidak pernah menghakimi, dan selalu memberi satu langkah berikutnya.</li>
            </ul>
          </article>

          <article>
            <h3>Tugas kamu</h3>
            <ul>
              <li>Catat uang yang keluar. Ini satu-satunya hal yang wajib.</li>
              <li>Catat uang yang masuk di hari yang sama.</li>
              <li>Tandai sudah dibayar di halaman Tagihan Rutin, bukan di Beranda.</li>
              <li>Lihat batas harian sebelum belanja, bukan sesudah.</li>
              <li>Masukkan keinginan ke daftar tunggu dulu, jangan langsung ke keranjang.</li>
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
            jatah besok, tapi paling banyak setengahnya — supaya satu hari yang kebablasan
            tidak jadi satu minggu yang kebablasan. Begitu juga sebaliknya: hemat hari ini
            menambah jatah besok. Terus saja mencatat.
          </p>
        </div>
      </section>

      <section id="aneh" className="guide-section">
        <h2>8. Kalau angkanya terasa aneh</h2>
        <dl className="guide-qa">
          <dt>Jatah harian terasa terlalu kecil</dt>
          <dd>
            Biasanya karena dana cadangan masih diisi. Selama belum penuh, sebagian
            uangmu memang ditahan. Kalau terasa terlalu ketat, turunkan{' '}
            <strong>berapa persen tiap uang masuk untuk dana cadangan</strong> di{' '}
            <Link href="/rules">Aturan</Link> — misalnya dari 55% ke 35%. Sehari-hari jadi
            lebih longgar, tapi lebih lama sampai aman.
          </dd>

          <dt>Jatah harian terasa terlalu besar</dt>
          <dd>
            Turunkan <strong>Jatah maksimum</strong> di Aturan. Itu batas atas yang
            menahan jatah melonjak setelah dapat uang besar.
          </dd>

          <dt>&ldquo;Uangnya cukup untuk&rdquo; terlihat kepanjangan atau kependekan</dt>
          <dd>
            Periksa biaya hidup harian. Angka itu yang jadi pembaginya, jadi salah sedikit
            di sana akan terasa besar di sini.
          </dd>

          <dt>Saldo tidak cocok dengan rekening asli</dt>
          <dd>
            Aplikasi cuma tahu apa yang kamu catat. Kalau ada uang masuk atau keluar yang
            terlewat, catat susulan dengan tanggal yang benar.
          </dd>

          <dt>Ringkasan menyarankan mengubah target dana cadangan</dt>
          <dd>
            Ikuti saja. Saran itu datang dari jarak uang masuk yang benar-benar pernah kamu
            alami, sedangkan angka bawaannya cuma tebakan.
          </dd>
        </dl>
      </section>

      <section id="istilah" className="guide-section">
        <h2>9. Arti kata-kata di sini</h2>
        <dl className="guide-glossary">
          <dt>Jatah harian</dt>
          <dd>Batas belanja hari ini. Dikunci per minggu supaya angkanya tidak goyang.</dd>

          <dt>Dana cadangan</dt>
          <dd>
            Tabungan darurat di dalam aplikasi. Bukan rekening terpisah — cuma bagian
            uangmu yang sengaja tidak boleh disentuh.
          </dd>

          <dt>Tagihan rutin</dt>
          <dd>
            Pengeluaran yang datang lagi setiap hari, minggu, bulan, atau tahun:
            kontrakan, listrik, langganan, cicilan.
          </dd>

          <dt>Uang tersedia</dt>
          <dd>Uang yang ada sekarang dikurangi tagihan yang belum dibayar.</dd>

          <dt>Boleh dibelanjakan</dt>
          <dd>
            Bagian uang tersedia yang bukan dana cadangan. Ini yang dibagi jadi jatah
            harian.
          </dd>
        </dl>

        <p className="guide-note">
          Masih ada yang bikin bingung? Angka detailnya selalu bisa dilihat di{' '}
          <Link href="/summary">Ringkasan</Link>, lengkap dengan keterangan dari mana
          asalnya.
        </p>
      </section>
    </main>
  )
}
