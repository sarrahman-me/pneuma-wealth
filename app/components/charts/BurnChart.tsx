import { formatRupiah } from '@/lib/core/format'
import { FAST_PACE_RATIO, type Pace } from '@/lib/core/pace'
import type { BurnPoint } from '@/lib/server/state'

/**
 * Kurva pembakaran sejak pemasukan terakhir.
 *
 * Kumulatif nyata melawan garis rencana. Kalau kurvanya menanjak curam di
 * kiri lalu mendatar, itu bukan "hemat di akhir bulan" — itu kehabisan uang.
 * Grafik ini yang paling langsung menjawab pola habis-di-minggu-pertama.
 */

const WIDTH = 700
const HEIGHT = 210
const PADDING = { top: 16, right: 12, bottom: 28, left: 12 }

export default function BurnChart({
  burn,
  pace,
}: {
  burn: BurnPoint[]
  pace: Pace
}) {
  if (burn.length < 2) return null

  // Sumbu x direntang sampai panjang siklus yang biasanya terjadi, supaya
  // terlihat berapa jauh lagi yang harus ditempuh — bukan hanya yang sudah lewat.
  const horizon = Math.max(
    burn.length - 1,
    pace.expectedCycleDays ?? 0,
  )
  const ceiling = Math.max(
    1,
    burn[burn.length - 1].cumulative,
    pace.plannedDaily * (horizon + 1),
  )

  const plotWidth = WIDTH - PADDING.left - PADDING.right
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom

  const xOf = (dayIndex: number) =>
    PADDING.left + (horizon > 0 ? (plotWidth * dayIndex) / horizon : 0)
  const yOf = (value: number) => PADDING.top + plotHeight * (1 - value / ceiling)

  const actual = burn
    .map((point) => `${xOf(point.dayIndex).toFixed(1)},${yOf(point.cumulative).toFixed(1)}`)
    .join(' ')

  const planned = `${xOf(0).toFixed(1)},${yOf(pace.plannedDaily).toFixed(1)} ${xOf(horizon).toFixed(1)},${yOf(pace.plannedDaily * (horizon + 1)).toFixed(1)}`

  const area = `${xOf(0).toFixed(1)},${(PADDING.top + plotHeight).toFixed(1)} ${actual} ${xOf(burn[burn.length - 1].dayIndex).toFixed(1)},${(PADDING.top + plotHeight).toFixed(1)}`

  // Ambangnya disamakan dengan aturan coaching, supaya warna merah di grafik
  // dan kalimat peringatan tidak pernah bercerita hal yang berbeda.
  const ahead = pace.paceRatio !== null && pace.paceRatio >= FAST_PACE_RATIO

  return (
    <figure className="chart">
      <figcaption className="chart-head">
        <span className="chart-title">Sejak uang terakhir masuk</span>
        <span className="chart-note">
          {formatRupiah(pace.spentSinceIncome)} terpakai dalam {pace.daysElapsed} hari
        </span>
      </figcaption>

      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="chart-svg"
        role="img"
        aria-label={`Total belanja ${formatRupiah(pace.spentSinceIncome)} dalam ${pace.daysElapsed} hari, dibanding rencana ${formatRupiah(pace.plannedSoFar ?? 0)}.`}
      >
        {pace.expectedCycleDays !== null && pace.expectedCycleDays <= horizon ? (
          <g>
            <line
              x1={xOf(pace.expectedCycleDays)}
              y1={PADDING.top}
              x2={xOf(pace.expectedCycleDays)}
              y2={PADDING.top + plotHeight}
              className="chart-marker"
            />
            <text
              x={xOf(pace.expectedCycleDays) - 8}
              y={PADDING.top + plotHeight - 6}
              textAnchor="end"
              className="chart-label"
            >
              pemasukan berikutnya
            </text>
          </g>
        ) : null}

        <polygon
          points={area}
          className={ahead ? 'chart-area chart-area-over' : 'chart-area'}
        />
        <polyline points={planned} className="chart-line chart-line-plan" />
        <polyline
          points={actual}
          className={ahead ? 'chart-line chart-line-over' : 'chart-line chart-line-actual'}
        />

        <text x={PADDING.left + 2} y={HEIGHT - 8} className="chart-label">
          hari pemasukan
        </text>
        <text
          x={WIDTH - PADDING.right}
          y={HEIGHT - 8}
          textAnchor="end"
          className="chart-label"
        >
          hari ke-{horizon}
        </text>

        <circle
          cx={xOf(burn[burn.length - 1].dayIndex)}
          cy={yOf(burn[burn.length - 1].cumulative)}
          r={4}
          className={ahead ? 'chart-dot chart-dot-over' : 'chart-dot'}
        />
      </svg>

      <div className="chart-legend">
        <span className="legend-item">
          <i className="swatch swatch-spent" /> Total yang sudah terpakai
        </span>
        <span className="legend-item">
          <i className="swatch swatch-plan" /> Kalau sesuai jatah harian
        </span>
      </div>
    </figure>
  )
}
