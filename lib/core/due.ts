/**
 * Jatuh tempo biaya tetap.
 *
 * Untuk sekarang hanya siklus bulanan yang dihitung; enum `recurrence` di skema
 * sudah menyiapkan mingguan dan tahunan, tapi UI belum menawarkannya.
 */

import { daysBetween, parseLocalDate } from './money'
import type { LocalDate } from './types'

const daysInMonth = (year: number, monthIndex: number) =>
  new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()

const dateAt = (year: number, monthIndex: number, day: number): LocalDate => {
  // Tagihan tanggal 31 di bulan pendek jatuh di hari terakhir bulan itu.
  const clampedDay = Math.min(day, daysInMonth(year, monthIndex))
  const date = new Date(Date.UTC(year, monthIndex, clampedDay))
  return date.toISOString().slice(0, 10)
}

/** Jatuh tempo bulanan berikutnya pada atau setelah `today`. */
export const nextMonthlyDue = (today: LocalDate, dueDay: number): LocalDate => {
  const safeDay = Math.min(Math.max(Math.trunc(dueDay), 1), 31)
  const now = parseLocalDate(today)
  const year = now.getUTCFullYear()
  const monthIndex = now.getUTCMonth()

  const thisMonth = dateAt(year, monthIndex, safeDay)
  if (daysBetween(today, thisMonth) >= 0) {
    return thisMonth
  }
  return dateAt(year, monthIndex + 1, safeDay)
}

export const daysUntilDue = (today: LocalDate, dueDay: number): number =>
  daysBetween(today, nextMonthlyDue(today, dueDay))
