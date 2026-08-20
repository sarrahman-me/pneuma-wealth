/**
 * Laju pembakaran sejak pemasukan terakhir.
 *
 * Ini menjawab masalah yang paling sering terjadi pada pemasukan tak menentu:
 * uang habis di minggu pertama, lalu sisa siklus dijalani dengan sangat sedikit.
 * Rata-rata bulanan menyembunyikan pola itu; laju kumulatif tidak.
 */

import type { IncomeCadence } from './cadence'

export type PaceInput = {
  /** Hari sejak pemasukan terakhir. 0 berarti pemasukan datang hari ini. */
  daysSinceIncome: number | null
  /** Total pengeluaran manual sejak hari pemasukan terakhir, termasuk hari ini. */
  spentSinceIncome: number
  /** Jatah dasar harian yang berlaku — inilah laju yang direncanakan. */
  plannedDaily: number
  /** Uang tersedia sekarang, setelah kewajiban dipotong. */
  available: number
  cadence: IncomeCadence
}

export type Pace = {
  /** Jumlah hari yang sudah berjalan di siklus ini (minimal 1). */
  daysElapsed: number | null
  spentSinceIncome: number
  /** Yang seharusnya terpakai sampai hari ini menurut rencana. */
  plannedSoFar: number | null
  avgDailySpend: number | null
  plannedDaily: number
  /** `avgDailySpend / plannedDaily`. 1 berarti tepat sesuai rencana. */
  paceRatio: number | null
  /** Berapa hari lagi uang habis bila laju sekarang diteruskan. */
  daysUntilEmpty: number | null
  /** Jeda pemasukan yang biasanya terjadi. */
  expectedCycleDays: number | null
  /**
   * Berapa hari kamu akan kehabisan uang sebelum pemasukan berikutnya biasanya
   * datang. Positif berarti ada lubang; null bila belum bisa diperkirakan.
   */
  shortfallDays: number | null
}

/** Di atas ini laju dianggap terlalu cepat dan layak diinterupsi. */
export const FAST_PACE_RATIO = 1.5

/** Sebelum siklus berjalan sesingkat ini, laju belum berarti apa-apa. */
export const MIN_DAYS_FOR_PACE = 3

export const computePace = ({
  daysSinceIncome,
  spentSinceIncome,
  plannedDaily,
  available,
  cadence,
}: PaceInput): Pace => {
  const expectedCycleDays = cadence.typicalGap

  if (daysSinceIncome === null) {
    return {
      daysElapsed: null,
      spentSinceIncome,
      plannedSoFar: null,
      avgDailySpend: null,
      plannedDaily,
      paceRatio: null,
      daysUntilEmpty: null,
      expectedCycleDays,
      shortfallDays: null,
    }
  }

  // Hari pemasukan itu sendiri ikut dihitung sebagai hari pertama siklus.
  const daysElapsed = daysSinceIncome + 1
  const avgDailySpend = Math.floor(spentSinceIncome / daysElapsed)
  const plannedSoFar = plannedDaily * daysElapsed

  const daysUntilEmpty =
    avgDailySpend > 0 ? Math.floor(Math.max(0, available) / avgDailySpend) : null

  const shortfallDays =
    expectedCycleDays !== null && daysUntilEmpty !== null
      ? Math.max(0, expectedCycleDays - (daysElapsed + daysUntilEmpty))
      : null

  return {
    daysElapsed,
    spentSinceIncome,
    plannedSoFar,
    avgDailySpend,
    plannedDaily,
    paceRatio: plannedDaily > 0 ? spentSinceIncome / plannedSoFar : null,
    daysUntilEmpty,
    expectedCycleDays,
    shortfallDays,
  }
}

/** Laju sudah cukup cepat dan siklus sudah cukup panjang untuk layak diinterupsi. */
export const isBurningTooFast = (pace: Pace): boolean =>
  pace.daysElapsed !== null &&
  pace.daysElapsed >= MIN_DAYS_FOR_PACE &&
  pace.paceRatio !== null &&
  pace.paceRatio >= FAST_PACE_RATIO
