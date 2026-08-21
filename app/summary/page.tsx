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
      <h1>Ringkasan uangmu</h1>
      <p>
        Uangmu dipilah dulu. Yang sudah ada tujuannya tidak ikut dihitung sebagai uang
        bebas.
      </p>

      <FundsBar funds={funds} />

      <section className="metric-grid">
        <article className="metric-card">
          <p className="metric-title">Uang yang ada sekarang</p>
          <p className="metric-value">{formatRupiah(funds.liquidBalance)}</p>
          <p className="metric-desc">Total di rekening harian dan dompet. Tabungan tidak dihitung.</p>
        </article>

        <article className="metric-card">
          <p className="metric-title">Tagihan yang belum dibayar</p>
          <p className="metric-value">− {formatRupiah(funds.scheduledObligations)}</p>
          <p className="metric-desc">
            {obligations.unpaidCount} tagihan belum lunas
            {obligations.daysToNextDue === null
              ? ''
              : obligations.daysToNextDue < 0
                ? `, yang terlama sudah telat ${Math.abs(obligations.daysToNextDue)} hari`
                : obligations.daysToNextDue === 0
                  ? ', ada yang jatuh tempo hari ini'
                  : `, terdekat ${obligations.daysToNextDue} hari lagi`}
            .
          </p>
        </article>

        <article className="metric-card">
          <p className="metric-title">Uang tersedia</p>
          <p className="metric-value">{formatRupiah(funds.available)}</p>
          <p className="metric-desc">Ini yang benar-benar bebas kamu pakai.</p>
        </article>

        <article className={funds.bufferFilled ? 'metric-card' : 'metric-card metric-warn'}>
          <p className="metric-title">Dana cadangan</p>
          <p className="metric-value">{formatRupiah(funds.bufferBalance)}</p>
          {bufferPercent !== null ? (
            <div className="metric-bar" aria-hidden>
              <span style={{ width: `${bufferPercent}%` }} />
            </div>
          ) : null}
          <p className="metric-desc">
            {bufferPercent !== null
              ? `Terisi ${bufferPercent}% dari target ${formatRupiah(funds.bufferTarget)}. Diisi ${user.settings.bufferFillPercent}% dari uangmu, sisanya tetap boleh dibelanjakan.`
              : 'Isi biaya hidup harian dulu di Aturan.'}
          </p>
        </article>

        <article className="metric-card">
          <p className="metric-title">Boleh dibelanjakan</p>
          <p className="metric-value">{formatRupiah(funds.flexible)}</p>
          <p className="metric-desc">
            Dibagi untuk {horizon.days} hari ke depan jadi jatah harian.
          </p>
        </article>

        <article className="metric-card">
          <p className="metric-title">Uangnya cukup untuk</p>
          <p className="metric-value">
            {funds.runwayDays !== null ? `${funds.runwayDays} hari` : '—'}
          </p>
          <p className="metric-desc">Segini lama kalau tidak ada uang masuk lagi.</p>
        </article>
      </section>

      <h2>Pola uang masuk</h2>
      <p>
        Target dana cadangan tidak perlu ditebak — jarak yang benar-benar pernah kamu
        alami ada di riwayatmu sendiri.
      </p>

      <CadenceChart cadence={cadence} />

      <section className="metric-details">
        {cadence.count === 0 ? (
          <p className="metric-helper-body">
            Belum ada uang masuk yang tercatat, jadi polanya belum kelihatan.
          </p>
        ) : (
          <>
            <p className="metric-helper-body">
              {cadence.count} kali uang masuk tercatat
              {cadence.lastDate ? `, terakhir ${formatShortDate(cadence.lastDate)}` : ''}.
              {cadence.medianGap !== null
                ? ` Biasanya berjarak ${cadence.medianGap} hari, dan yang paling lama ${cadence.longestGap} hari.`
                : ' Baru sekali, jadi jaraknya belum bisa dihitung.'}
            </p>

            {suggestionDiffers ? (
              <p className="metric-suggestion">
                Melihat jarak yang pernah kamu alami, target dana cadangan yang lebih masuk
                akal adalah <strong>{suggestion} hari</strong> — sekarang disetel{' '}
                {user.settings.bufferDays} hari. <Link href="/rules">Ubah di Aturan</Link>.
              </p>
            ) : cadence.confident ? (
              <p className="metric-helper-body">
                Target dana cadangan {user.settings.bufferDays} hari sudah pas dengan
                jarak uang masukmu.
              </p>
            ) : (
              <p className="metric-helper-body">
                Butuh beberapa kali uang masuk lagi sebelum sarannya layak dipercaya.
              </p>
            )}
          </>
        )}
      </section>

      <section className="metric-details">
        <h2>Jatah harian</h2>
        <p className="metric-helper-body">
          Jatah dasar {formatRupiah(anchor.baseAllowance)} dikunci sejak {formatShortDate(anchor.anchoredOn)}, dan
          baru dihitung ulang setelah seminggu atau kalau uang yang boleh dibelanjakan
          berubah banyak. Hari ini kamu boleh memakai {formatRupiah(allowance.allowed)}.
        </p>

        {horizon.fromCadence ? (
          <p className="metric-suggestion">
            Uangmu dibagi untuk <strong>{horizon.days} hari</strong>, bukan{' '}
            {user.settings.allowanceHorizonDays} hari seperti yang disetel — karena jarak
            uang masukmu memang selama itu. Membagi uang lebih cepat dari datangnya uang
            berikutnya adalah cara paling pasti untuk kehabisan di tengah jalan.
          </p>
        ) : null}
      </section>
    </main>
  )
}
