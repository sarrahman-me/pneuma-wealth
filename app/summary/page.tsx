import Link from 'next/link'
import { formatRupiah } from '@/lib/core/format'
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

  const { funds, obligations, allowance, anchor } = await getDailyState(user)
  const bufferPercent = funds.bufferRatio !== null ? Math.round(funds.bufferRatio * 100) : null

  return (
    <main>
      <h1>Ringkasan dana</h1>
      <p>Uangmu dipilah berlapis. Yang sudah punya nama tidak ikut dihitung sebagai uang bebas.</p>

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
          <p className="metric-value">
            {formatRupiah(funds.bufferBalance)} / {formatRupiah(funds.bufferTarget)}
          </p>
          <p className="metric-desc">
            {bufferPercent !== null
              ? `Terisi ${bufferPercent}%.`
              : 'Isi biaya hidup harian dulu di Aturan.'}
          </p>
        </article>

        <article className="metric-card">
          <p className="metric-title">Dana fleksibel</p>
          <p className="metric-value">{formatRupiah(funds.flexible)}</p>
          <p className="metric-desc">Sisa setelah penyangga penuh. Ini yang jadi jatah harian.</p>
        </article>

        <article className="metric-card">
          <p className="metric-title">Runway</p>
          <p className="metric-value">
            {funds.runwayDays !== null ? `${funds.runwayDays} hari` : '—'}
          </p>
          <p className="metric-desc">Bertahan segini lama tanpa pemasukan baru.</p>
        </article>
      </section>

      <section className="metric-details">
        <h2>Jatah harian</h2>
        <p className="metric-helper-body">
          Jatah dasar {formatRupiah(anchor.baseAllowance)} dikunci sejak {anchor.anchoredOn}, dan
          hanya dihitung ulang setelah seminggu atau ketika dana fleksibel berubah besar. Hari ini
          kamu boleh memakai {formatRupiah(allowance.allowed)}.
        </p>
      </section>
    </main>
  )
}
