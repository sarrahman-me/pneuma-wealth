/** Utilitas uang dan tanggal. Semua nilai uang adalah bilangan bulat rupiah. */

import type { LocalDate } from './types'

export const clamp = (value: number, min: number, max: number) =>
  value < min ? min : value > max ? max : value

/**
 * Membulatkan ke bawah per seribu supaya angka rekomendasi enak dibaca.
 * Selalu konservatif: tidak pernah membulatkan ke atas.
 */
export const floorToThousand = (value: number) =>
  value <= 0 ? 0 : Math.floor(value / 1_000) * 1_000

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export const parseLocalDate = (date: LocalDate): Date => {
  if (!DATE_PATTERN.test(date)) {
    throw new Error(`Tanggal lokal tidak valid: ${date}`)
  }
  // UTC supaya aritmetika hari bebas dari DST.
  return new Date(`${date}T00:00:00Z`)
}

export const formatLocalDate = (date: Date): LocalDate =>
  date.toISOString().slice(0, 10)

/** Jumlah hari dari `from` ke `to`. Negatif bila `to` lebih awal. */
export const daysBetween = (from: LocalDate, to: LocalDate): number => {
  const ms = parseLocalDate(to).getTime() - parseLocalDate(from).getTime()
  return Math.round(ms / 86_400_000)
}

export const addDays = (date: LocalDate, days: number): LocalDate => {
  const next = parseLocalDate(date)
  next.setUTCDate(next.getUTCDate() + days)
  return formatLocalDate(next)
}

/** Periode bulan `YYYY-MM`. */
export const periodOf = (date: LocalDate): string => date.slice(0, 7)
