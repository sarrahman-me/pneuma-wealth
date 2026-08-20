import { formatRupiah } from '@/lib/core/format'
import type { IncomePlan } from '@/lib/core/income'
import type { IncomeCadence } from '@/lib/core/cadence'

/**
 * Pemecahan uang yang baru masuk.
 *
 * Ini satu-satunya kartu yang muncul di hari pemasukan, dan sengaja diletakkan
 * paling atas: momen paling menentukan bukan saat belanja, tapi saat angka
 * besar mendarat di rekening dan terasa seperti uang bebas seluruhnya.
 */
export default function IncomeRitual({
  plan,
  cadence,
}: {
  plan: IncomePlan
  cadence: IncomeCadence
}) {
  const parts = [
    {
      key: 'obligations',
      label: 'Menutup tagihan',
      amount: plan.toObligations,
      desc: 'Sudah ada yang menunggu sebelum uangnya masuk.',
      className: 'split-part split-obligation',
    },
    {
      key: 'buffer',
      label: 'Mengisi dana cadangan',
      amount: plan.toBuffer,
      desc: 'Bekal untuk hari-hari tanpa uang masuk.',
      className: 'split-part split-buffer',
    },
    {
      key: 'flexible',
      label: 'Boleh dibelanjakan',
      amount: plan.toFlexible,
      desc: `Dibagi rata jadi ${formatRupiah(plan.dailyAfter)} per hari.`,
      className: 'split-part split-flexible',
    },
  ].filter((part) => part.amount > 0)

  return (
    <section className="ritual">
      <p className="ritual-eyebrow">Uang masuk hari ini</p>
      <h2 className="ritual-amount">{formatRupiah(plan.amount)}</h2>
      <p className="ritual-lead">
        Sebagian besar sudah ada tujuannya. Ini pembagiannya, sebelum keburu terasa
        seperti uang bebas.
      </p>

      <ul className="split-list">
        {parts.map((part) => (
          <li key={part.key} className={part.className}>
            <span className="split-label">{part.label}</span>
            <span className="split-amount">{formatRupiah(part.amount)}</span>
            <span className="split-desc">{part.desc}</span>
          </li>
        ))}
      </ul>

      <div className="ritual-foot">
        <p>
          Jatah harian naik dari {formatRupiah(plan.dailyBefore)} jadi{' '}
          <strong>{formatRupiah(plan.dailyAfter)}</strong>.
          {plan.coversDays !== null
            ? ` Uang ini cukup untuk hidup ${plan.coversDays} hari.`
            : ''}
        </p>
        {cadence.typicalGap !== null ? (
          <p className="ritual-warn">
            Biasanya uang baru masuk lagi {cadence.typicalGap} hari lagi. Uang ini harus
            sampai ke sana.
          </p>
        ) : null}
      </div>
    </section>
  )
}
