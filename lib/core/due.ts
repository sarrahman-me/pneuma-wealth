/**
 * Jatuh tempo biaya tetap.
 *
 * Satu biaya tetap punya siklus sendiri: harian, mingguan, bulanan, atau
 * tahunan. Menyamaratakan semuanya jadi bulanan bukan penyederhanaan yang
 * netral — tagihan tahunan akan disisihkan dua belas kali lipat dari yang
 * seharusnya, dan langganan mingguan hanya seperempatnya. Keduanya membuat
 * jatah harian berbohong ke arah yang berlawanan.
 *
 * `dueDay` dibaca berbeda tergantung siklusnya; lihat `DueSchedule`.
 */

import { addDays, daysBetween, formatLocalDate, parseLocalDate } from './money'
import type { LocalDate } from './types'

export type Recurrence = 'daily' | 'weekly' | 'monthly' | 'yearly'

export type DueSchedule = {
  recurrence: Recurrence
  /**
   * Harian: diabaikan.
   * Mingguan: hari dalam pekan, 1–7 (1 = Senin, 7 = Minggu).
   * Bulanan dan tahunan: tanggal, 1–31.
   */
  dueDay: number
  /** Hanya dipakai siklus tahunan: bulan 1–12. */
  dueMonth: number
}

/** Batas aman jumlah kejadian yang dihitung dalam satu horizon. */
const MAX_OCCURRENCES = 400

const daysInMonth = (year: number, monthIndex: number) =>
  new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()

const dateAt = (year: number, monthIndex: number, day: number): LocalDate => {
  // Tagihan tanggal 31 di bulan pendek jatuh di hari terakhir bulan itu.
  const clampedDay = Math.min(day, daysInMonth(year, monthIndex))
  const date = new Date(Date.UTC(year, monthIndex, clampedDay))
  return formatLocalDate(date)
}

const clampInt = (value: number, min: number, max: number) =>
  Math.min(Math.max(Math.trunc(Number.isFinite(value) ? value : min), min), max)

/** Hari dalam pekan menurut ISO: 1 = Senin … 7 = Minggu. */
export const isoWeekday = (date: LocalDate): number => {
  const day = parseLocalDate(date).getUTCDay()
  return day === 0 ? 7 : day
}

/** Jatuh tempo bulanan berikutnya pada atau setelah `today`. */
export const nextMonthlyDue = (today: LocalDate, dueDay: number): LocalDate => {
  const safeDay = clampInt(dueDay, 1, 31)
  const now = parseLocalDate(today)
  const year = now.getUTCFullYear()
  const monthIndex = now.getUTCMonth()

  const thisMonth = dateAt(year, monthIndex, safeDay)
  if (daysBetween(today, thisMonth) >= 0) {
    return thisMonth
  }
  return dateAt(year, monthIndex + 1, safeDay)
}

/** Jatuh tempo berikutnya pada atau setelah `today`, apa pun siklusnya. */
export const nextDue = (today: LocalDate, schedule: DueSchedule): LocalDate => {
  switch (schedule.recurrence) {
    case 'daily':
      return today

    case 'weekly': {
      const target = clampInt(schedule.dueDay, 1, 7)
      return addDays(today, (target - isoWeekday(today) + 7) % 7)
    }

    case 'yearly': {
      const monthIndex = clampInt(schedule.dueMonth, 1, 12) - 1
      const day = clampInt(schedule.dueDay, 1, 31)
      const year = parseLocalDate(today).getUTCFullYear()

      const thisYear = dateAt(year, monthIndex, day)
      return daysBetween(today, thisYear) >= 0 ? thisYear : dateAt(year + 1, monthIndex, day)
    }

    default:
      return nextMonthlyDue(today, schedule.dueDay)
  }
}

/** Kejadian sesudah `due`, dihitung dari tanggal nominal supaya tidak terseret pembulatan bulan pendek. */
const advance = (due: LocalDate, schedule: DueSchedule): LocalDate => {
  const at = parseLocalDate(due)

  switch (schedule.recurrence) {
    case 'daily':
      return addDays(due, 1)
    case 'weekly':
      return addDays(due, 7)
    case 'yearly':
      return dateAt(
        at.getUTCFullYear() + 1,
        clampInt(schedule.dueMonth, 1, 12) - 1,
        clampInt(schedule.dueDay, 1, 31),
      )
    default:
      return dateAt(at.getUTCFullYear(), at.getUTCMonth() + 1, clampInt(schedule.dueDay, 1, 31))
  }
}

/**
 * Semua jatuh tempo dari hari ini sampai `horizonDays` hari ke depan.
 *
 * Siklus pendek muncul berkali-kali dalam satu horizon, dan setiap kejadian
 * adalah uang yang benar-benar akan keluar — jadi semuanya ikut disisihkan,
 * bukan hanya yang terdekat.
 */
export const occurrencesWithin = (
  today: LocalDate,
  schedule: DueSchedule,
  horizonDays: number,
): LocalDate[] => {
  if (horizonDays < 0) return []

  const dues: LocalDate[] = []
  let due = nextDue(today, schedule)

  while (daysBetween(today, due) <= horizonDays && dues.length < MAX_OCCURRENCES) {
    dues.push(due)
    due = advance(due, schedule)
  }

  return dues
}

/**
 * Kunci periode pembayaran. Bentuknya berbeda per siklus supaya satu kejadian
 * hanya bisa ditandai lunas sekali. Siklus bulanan tetap `YYYY-MM` seperti
 * sebelumnya, jadi pembayaran yang sudah tercatat tidak perlu dipindahkan.
 */
export const periodKeyFor = (recurrence: Recurrence, due: LocalDate): string => {
  switch (recurrence) {
    case 'daily':
      return due
    case 'weekly':
      return isoWeekKey(due)
    case 'yearly':
      return due.slice(0, 4)
    default:
      return due.slice(0, 7)
  }
}

/** Pekan ISO, mis. `2026-W34`. Pekan dimulai Senin dan boleh menyeberang tahun. */
export const isoWeekKey = (date: LocalDate): string => {
  // Kamis di pekan yang sama menentukan tahun sekaligus nomor pekannya — ini
  // yang membuat pekan di pergantian tahun tidak terbelah jadi dua kunci.
  const thursday = addDays(date, 4 - isoWeekday(date))
  const year = parseLocalDate(thursday).getUTCFullYear()
  const week = Math.floor(daysBetween(`${year}-01-01`, thursday) / 7) + 1

  return `${year}-W${String(week).padStart(2, '0')}`
}

export const daysUntilDue = (today: LocalDate, schedule: DueSchedule): number =>
  daysBetween(today, nextDue(today, schedule))

const WEEKDAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu']
const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

/** Penjelasan siklus dalam bahasa manusia, mis. "Tanggal 25 tiap bulan". */
export const describeSchedule = (schedule: DueSchedule): string => {
  switch (schedule.recurrence) {
    case 'daily':
      return 'Setiap hari'
    case 'weekly':
      return `Setiap ${WEEKDAYS[clampInt(schedule.dueDay, 1, 7) - 1]}`
    case 'yearly':
      return `Tiap ${clampInt(schedule.dueDay, 1, 31)} ${MONTHS[clampInt(schedule.dueMonth, 1, 12) - 1]}`
    default:
      return `Tanggal ${clampInt(schedule.dueDay, 1, 31)} tiap bulan`
  }
}
