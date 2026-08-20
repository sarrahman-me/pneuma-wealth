import type { IncomeCadence } from '@/lib/core/cadence'

/**
 * Jeda antar pemasukan yang benar-benar pernah terjadi.
 *
 * Target penyangga selama ini angka karangan (30 hari). Grafik ini menaruh
 * jeda nyata di sebelahnya, termasuk jeda yang sedang berjalan sekarang.
 */

export default function CadenceChart({ cadence }: { cadence: IncomeCadence }) {
  if (cadence.gaps.length === 0) return null

  const running = cadence.daysSinceLast ?? 0
  const bars = [
    ...cadence.gaps.map((gap, index) => ({
      key: `gap-${index}`,
      days: gap,
      running: false,
    })),
    { key: 'running', days: running, running: true },
  ]

  const ceiling = Math.max(1, ...bars.map((bar) => bar.days))
  const typical = cadence.typicalGap

  return (
    <figure className="chart chart-compact">
      <figcaption className="chart-head">
        <span className="chart-title">Jeda antar pemasukan</span>
        <span className="chart-note">
          {cadence.medianGap !== null ? `Biasanya ${cadence.medianGap} hari` : 'Belum ada pola'}
        </span>
      </figcaption>

      <div
        className="gap-bars"
        role="img"
        aria-label={`Jeda antar pemasukan: ${cadence.gaps.join(', ')} hari. Jeda berjalan sekarang ${running} hari.`}
      >
        {typical !== null ? (
          <div
            className="gap-threshold"
            style={{ bottom: `${(typical / ceiling) * 100}%` }}
            title={`Jeda tipikal ${typical} hari`}
          >
            <span>{typical} hari</span>
          </div>
        ) : null}

        {bars.map((bar) => (
          <div
            key={bar.key}
            className={bar.running ? 'gap-bar gap-bar-running' : 'gap-bar'}
            style={{ height: `${Math.max(4, (bar.days / ceiling) * 100)}%` }}
            title={bar.running ? `Berjalan ${bar.days} hari` : `${bar.days} hari`}
          />
        ))}
      </div>

      <p className="chart-footnote">
        Batang paling kanan adalah jeda yang sedang berjalan sekarang.
      </p>
    </figure>
  )
}
