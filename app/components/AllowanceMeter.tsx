import { formatRupiah } from '@/lib/core/format'
import type { DailyAllowance } from '@/lib/core/types'

/**
 * Jatah hari ini sebagai satu batang. Angka "sisa Rp 40.000" tidak memberi
 * tahu seberapa dekat batasnya; panjang batang memberi tahu dalam sekali lihat.
 */
export default function AllowanceMeter({ allowance }: { allowance: DailyAllowance }) {
  if (allowance.allowed <= 0) return null

  const usedPercent = Math.min(100, (allowance.spent / allowance.allowed) * 100)
  const overPercent =
    allowance.overspent
      ? Math.min(100, ((allowance.spent - allowance.allowed) / allowance.allowed) * 100)
      : 0

  return (
    <div className="meter">
      <div
        className="meter-track"
        role="img"
        aria-label={`Terpakai ${formatRupiah(allowance.spent)} dari jatah ${formatRupiah(allowance.allowed)}.`}
      >
        <div
          className={allowance.overspent ? 'meter-fill meter-fill-over' : 'meter-fill'}
          style={{ width: `${usedPercent}%` }}
        />
        {overPercent > 0 ? (
          <div className="meter-over" style={{ width: `${overPercent}%` }} />
        ) : null}
      </div>
      <div className="meter-foot">
        <span>{formatRupiah(allowance.spent)} terpakai</span>
        <span>{formatRupiah(allowance.allowed)} jatah</span>
      </div>
    </div>
  )
}
