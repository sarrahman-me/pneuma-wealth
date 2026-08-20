import { formatRupiah, formatShortDate } from '@/lib/core/format'
import type { DayPoint } from '@/lib/server/state'

/**
 * Ritme 14 hari: batang pengeluaran melawan garis jatah.
 *
 * Deretan angka tidak menunjukkan pola; bentuk menunjukkannya. Batang yang
 * menjulang di awal lalu rata di bawah adalah wujud "habis di minggu pertama".
 */

const WIDTH = 700
const HEIGHT = 190
const PADDING = { top: 14, right: 8, bottom: 26, left: 8 }

export default function RhythmChart({ days }: { days: DayPoint[] }) {
  if (days.length === 0) return null

  const ceiling = Math.max(
    1,
    ...days.map((day) => day.spent),
    ...days.map((day) => day.allowed),
  )

  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom
  const plotWidth = WIDTH - PADDING.left - PADDING.right
  const slot = plotWidth / days.length
  const barWidth = Math.max(6, slot * 0.56)

  const yOf = (value: number) => PADDING.top + plotHeight * (1 - value / ceiling)
  const xOf = (index: number) => PADDING.left + slot * index + slot / 2

  const allowanceLine = days
    .map((day, index) => `${xOf(index).toFixed(1)},${yOf(day.allowed).toFixed(1)}`)
    .join(' ')

  const totalSpent = days.reduce((sum, day) => sum + day.spent, 0)
  const overDays = days.filter((day) => day.spent > day.allowed).length

  return (
    <figure className="chart">
      <figcaption className="chart-head">
        <span className="chart-title">Ritme 14 hari</span>
        <span className="chart-note">
          Total {formatRupiah(totalSpent)} · {overDays} hari melewati jatah
        </span>
      </figcaption>

      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="chart-svg"
        role="img"
        aria-label={`Pengeluaran harian 14 hari terakhir, total ${formatRupiah(totalSpent)}, ${overDays} hari melewati jatah.`}
      >
        {days.map((day, index) => {
          const height = Math.max(0, plotHeight * (day.spent / ceiling))
          const over = day.spent > day.allowed
          return (
            <rect
              key={day.dateLocal}
              x={xOf(index) - barWidth / 2}
              y={PADDING.top + plotHeight - height}
              width={barWidth}
              height={height}
              rx={3}
              className={over ? 'chart-bar chart-bar-over' : 'chart-bar'}
            >
              <title>{`${formatShortDate(day.dateLocal)}: ${formatRupiah(day.spent)} dari jatah ${formatRupiah(day.allowed)}`}</title>
            </rect>
          )
        })}

        <polyline points={allowanceLine} className="chart-line chart-line-plan" />

        {days.map((day, index) =>
          index % 3 === 0 || index === days.length - 1 ? (
            <text
              key={`label-${day.dateLocal}`}
              x={xOf(index)}
              y={HEIGHT - 8}
              textAnchor="middle"
              className="chart-label"
            >
              {formatShortDate(day.dateLocal)}
            </text>
          ) : null,
        )}
      </svg>

      <div className="chart-legend">
        <span className="legend-item">
          <i className="swatch swatch-spent" /> Terpakai
        </span>
        <span className="legend-item">
          <i className="swatch swatch-over" /> Melewati jatah
        </span>
        <span className="legend-item">
          <i className="swatch swatch-plan" /> Jatah hari itu
        </span>
      </div>
    </figure>
  )
}
