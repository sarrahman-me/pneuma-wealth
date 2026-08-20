import { formatRupiah } from '@/lib/core/format'
import type { Funds } from '@/lib/core/types'

/**
 * Satu batang untuk seluruh waterfall dana.
 *
 * Tabel angka membuat pengguna menjumlah sendiri; batang bertumpuk langsung
 * menunjukkan betapa kecilnya bagian yang benar-benar bebas dibelanjakan.
 */

type Segment = {
  key: string
  label: string
  amount: number
  className: string
}

export default function FundsBar({ funds }: { funds: Funds }) {
  const total = Math.max(
    1,
    funds.scheduledObligations + Math.max(0, funds.available),
  )

  const segments: Segment[] = [
    {
      key: 'obligations',
      label: 'Tagihan',
      amount: funds.scheduledObligations,
      className: 'seg seg-obligation',
    },
    {
      key: 'buffer',
      label: 'Dana cadangan',
      amount: funds.reserved,
      className: 'seg seg-buffer',
    },
    {
      key: 'flexible',
      label: 'Boleh dibelanjakan',
      amount: funds.flexible,
      className: 'seg seg-flexible',
    },
  ].filter((segment) => segment.amount > 0)

  if (segments.length === 0) return null

  return (
    <figure className="chart chart-compact">
      <figcaption className="chart-head">
        <span className="chart-title">Uangmu sudah dipesan untuk apa saja</span>
        <span className="chart-note">Uang yang ada {formatRupiah(funds.liquidBalance)}</span>
      </figcaption>

      <div
        className="stack-bar"
        role="img"
        aria-label={segments
          .map((segment) => `${segment.label} ${formatRupiah(segment.amount)}`)
          .join(', ')}
      >
        {segments.map((segment) => (
          <div
            key={segment.key}
            className={segment.className}
            style={{ flexGrow: segment.amount / total }}
            title={`${segment.label}: ${formatRupiah(segment.amount)}`}
          />
        ))}
      </div>

      <ul className="stack-legend">
        {segments.map((segment) => (
          <li key={segment.key}>
            <i className={segment.className} />
            <span className="stack-legend-label">{segment.label}</span>
            <span className="stack-legend-value">{formatRupiah(segment.amount)}</span>
          </li>
        ))}
      </ul>
    </figure>
  )
}
