import Link from 'next/link'
import CadenceChart from '../components/charts/CadenceChart'
import FundsBar from '../components/charts/FundsBar'
import { formatRupiah, formatShortDate } from '@/lib/core/format'
import { getCurrentUser } from '@/lib/server/user'
import { getDailyState } from '@/lib/server/state'

export const dynamic = 'force-dynamic'

export default async function SummaryPage() {
  const user = await getCurrentUser()
  if (!user) {
    return (
      <main>
        <h1>Ringkasan</h1>
        <p>
          <Link href="/sign-in">Masuk</Link> untuk melihat ringkasan.
        </p>
      </main>
    )
  }

  const { funds, obligations, allowance, anchor, cadence, horizon } = await getDailyState(user)
  const bufferPercent = funds.bufferRatio !== null ? Math.round(funds.bufferRatio * 100) : null

  const suggestion = cadence.suggestedBufferDays
  const suggestionDiffers = suggestion !== null && suggestion !== user.settings.bufferDays

  return (
    <main>
      <h1>Ringkasan dana</h1>
      <p>Uangmu dipilah berlapis. Yang sudah punya nama tidak ikut dihitung sebagai uang bebas.</p>

      <FundsBar funds={funds} />

      <section className="metric-grid">
        <article className="metric-card">
          <p className="metric-title">Saldo likuid</p>
          <p className="metric-value">{formatRupiah(funds.liquidBalance)}</p>
          <p className="metric-desc">Total akun harian. Tabungan tidak termasuk.</p>
        </article>

        <article className="metric-card">
          <p className="metric-title">Kewajiban terjadwal</p>
          <p className="metric-value">− {formatRupiah(funds.scheduledObligations)}</p>
          <p className="metric-desc">
            {obligations.unpaidCount} tagihan belum lunas
            {obligations.daysToNextDue !== null
              ? `, terdekat ${obligations.daysToNextDue} hari lagi`
              : ''}
            .
          </p>
        </article>

        <article className="metric-card">
          <p className="metric-title">Uang tersedia</p>
          <p className="metric-value">{formatRupiah(funds.available)}</p>
          <p className="metric-desc">Inilah yang benar-benar bebas kamu atur.</p>
        </article>

        <article className={funds.bufferFilled ? 'metric-card' : 'metric-card metric-warn'}>
          <p className="metric-title">Dana penyangga</p>
          <p className="metric-value">{formatRupiah(funds.bufferBalance)}</p>
          {bufferPercent !== null ? (
            <div className="metric-bar" aria-hidden>
              <span style={{ width: `${bufferPercent}%` }} />
            </div>
          ) : null}
          <p className="metric-desc">
            {bufferPercent !== null
              ? `Terisi ${bufferPercent}% dari target ${formatRupiah(funds.bufferTarget)}. Sisanya diisi ${user.settings.bufferFillPercent}% dari tiap uang masuk.`
              : 'Isi biaya hidup harian dulu di Aturan.'}
          </p>
        </article>

        <article className="metric-card">
          <p className="metric-title">Boleh dibelanjakan</p>
          <p className="metric-value">{formatRupiah(funds.flexible)}</p>
          <p className="metric-desc">
            Dibagi sepanjang {horizon.days} hari jadi jatah harian.
          </p>
        </article>

        <article className="metric-card">
          <p className="metric-title">Runway</p>
          <p className="metric-value">
            {funds.runwayDays !== null ? `${funds.runwayDays} hari` : '—'}
          </p>
          <p className="metric-desc">Bertahan segini lama tanpa pemasukan baru.</p>
        </article>
      </section>

      <h2>Ritme pemasukan</h2>
      <p>
        Target penyangga tidak perlu ditebak — jeda yang benar-benar pernah terjadi
        ada di riwayatmu sendiri.
      </p>

      <CadenceChart cadence={cadence} />

      <section className="metric-details">
        {cadence.count === 0 ? (
          <p className="metric-helper-body">
            Belum ada pemasukan yang tercatat, jadi ritmenya belum bisa dibaca.
          </p>
        ) : (
          <>
            <p className="metric-helper-body">
              {cadence.count} kali pemasukan tercatat
              {cadence.lastDate ? `, terakhir ${formatShortDate(cadence.lastDate)}` : ''}.
              {cadence.medianGap !== null
                ? ` Jeda tengahnya ${cadence.medianGap} hari, dan yang terpanjang ${cadence.longestGap} hari.`
                : ' Baru satu kali, jadi jedanya belum bisa dihitung.'}
            </p>

            {suggestionDiffers ? (
              <p className="metric-suggestion">
                Berdasarkan jeda yang pernah terjadi, target penyangga yang lebih jujur
                adalah <strong>{suggestion} hari</strong> — sekarang disetel{' '}
                {user.settings.bufferDays} hari. <Link href="/rules">Ubah di Aturan</Link>.
              </p>
            ) : cadence.confident ? (
              <p className="metric-helper-body">
                Target penyangga {user.settings.bufferDays} hari sudah sejalan dengan
                jeda pemasukanmu.
              </p>
            ) : (
              <p className="metric-helper-body">
                Butuh beberapa pemasukan lagi sebelum saran target penyangga layak dipercaya.
              </p>
            )}
          </>
        )}
      </section>

      <section className="metric-details">
        <h2>Jatah harian</h2>
        <p className="metric-helper-body">
          Jatah dasar {formatRupiah(anchor.baseAllowance)} dikunci sejak {formatShortDate(anchor.anchoredOn)}, dan
          hanya dihitung ulang setelah seminggu atau ketika dana yang boleh dibelanjakan berubah
          besar. Hari ini kamu boleh memakai {formatRupiah(allowance.allowed)}.
        </p>

        {horizon.fromCadence ? (
          <p className="metric-suggestion">
            Uangmu dibagi sepanjang <strong>{horizon.days} hari</strong>, bukan{' '}
            {user.settings.allowanceHorizonDays} hari seperti yang disetel — karena jeda
            pemasukanmu memang selama itu. Membagi uang lebih cepat dari datangnya
            pemasukan adalah cara paling pasti untuk kehabisan di tengah jalan.
          </p>
        ) : null}
      </section>
    </main>
  )
}
