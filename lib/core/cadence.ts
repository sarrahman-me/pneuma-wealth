/**
 * Ritme pemasukan.
 *
 * Untuk pemasukan tak menentu, angka yang paling penting bukan "berapa" tapi
 * "berapa lama jedanya". `bufferDays` default 30 hanyalah tebakan; jeda yang
 * benar-benar pernah terjadi ada di riwayat pengguna sendiri. Modul ini
 * membacanya supaya target penyangga berhenti jadi angka karangan.
 */

import { daysBetween } from './money'
import type { LocalDate } from './types'

export type IncomeEvent = { dateLocal: LocalDate; amount: number }

export type IncomeCadence = {
  /** Jumlah hari-pemasukan yang tercatat (bukan jumlah transaksi). */
  count: number
  /** Jeda antar hari-pemasukan, urut dari yang paling lama berlalu. */
  gaps: number[]
  medianGap: number | null
  /** Jeda yang "biasanya cukup" — persentil 80 dari jeda yang pernah terjadi. */
  typicalGap: number | null
  longestGap: number | null
  medianAmount: number | null
  lastDate: LocalDate | null
  daysSinceLast: number | null
  /**
   * Saran target hari penyangga, dibulatkan ke atas dari jeda tipikal dan
   * dibatasi ke rentang yang masuk akal. Null bila datanya belum cukup.
   */
  suggestedBufferDays: number | null
  /** Butuh minimal 3 jeda sebelum sarannya layak dipercaya. */
  confident: boolean
}

export const MIN_GAPS_FOR_CONFIDENCE = 3
const SUGGESTION_MIN_DAYS = 14
const SUGGESTION_MAX_DAYS = 120

const median = (sorted: number[]): number | null => {
  if (sorted.length === 0) return null
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1
    ? sorted[middle]
    : Math.round((sorted[middle - 1] + sorted[middle]) / 2)
}

/** Persentil dengan pembulatan ke atas — sengaja konservatif untuk penyangga. */
export const percentile = (sorted: number[], fraction: number): number | null => {
  if (sorted.length === 0) return null
  const index = Math.ceil(fraction * sorted.length) - 1
  return sorted[Math.min(Math.max(index, 0), sorted.length - 1)]
}

/**
 * `events` boleh berisi beberapa transaksi di tanggal yang sama; tanggal yang
 * sama digabung supaya satu pembayaran yang dicatat terpisah tidak terbaca
 * sebagai dua kali pemasukan dengan jeda nol hari.
 */
export const analyzeIncome = (
  events: IncomeEvent[],
  today: LocalDate,
): IncomeCadence => {
  const byDate = new Map<LocalDate, number>()
  for (const event of events) {
    byDate.set(event.dateLocal, (byDate.get(event.dateLocal) ?? 0) + event.amount)
  }

  const days = [...byDate.keys()].sort()
  const amounts = [...byDate.values()].sort((a, b) => a - b)

  const gaps: number[] = []
  for (let index = 1; index < days.length; index += 1) {
    gaps.push(daysBetween(days[index - 1], days[index]))
  }

  const sortedGaps = [...gaps].sort((a, b) => a - b)
  const typicalGap = percentile(sortedGaps, 0.8)
  const lastDate = days.length > 0 ? days[days.length - 1] : null
  const confident = gaps.length >= MIN_GAPS_FOR_CONFIDENCE

  return {
    count: days.length,
    gaps,
    medianGap: median(sortedGaps),
    typicalGap,
    longestGap: sortedGaps.length > 0 ? sortedGaps[sortedGaps.length - 1] : null,
    medianAmount: median(amounts),
    lastDate,
    daysSinceLast: lastDate ? daysBetween(lastDate, today) : null,
    suggestedBufferDays:
      confident && typicalGap !== null
        ? Math.min(Math.max(typicalGap, SUGGESTION_MIN_DAYS), SUGGESTION_MAX_DAYS)
        : null,
    confident,
  }
}
