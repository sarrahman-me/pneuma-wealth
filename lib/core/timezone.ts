/**
 * Tanggal dan jam menurut zona waktu pengguna.
 *
 * Versi desktop memakai jam sistem mesin. Di web, jam sistem adalah jam server,
 * jadi "hari ini" harus selalu dihitung terhadap zona waktu pengguna.
 */

import type { LocalDate } from './types'

/** `en-CA` menghasilkan format `YYYY-MM-DD`, persis yang kita simpan. */
export const todayIn = (timezone: string, now: Date = new Date()): LocalDate =>
  new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(now)

export const hourIn = (timezone: string, now: Date = new Date()): number =>
  Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      hour: '2-digit',
      hour12: false,
    }).format(now),
  )
