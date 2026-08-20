/**
 * Jatah harian.
 *
 * Versi desktop menghitung ulang jatah dari saldo setiap kali halaman dibuka,
 * jadi angkanya bergoyang tiap hari dan hemat kemarin tidak pernah terasa.
 * Di sini jatah dikunci pada sebuah anchor dan hanya dihitung ulang saat ada
 * alasan nyata: seminggu berlalu, atau dana fleksibel berubah besar.
 */

import { daysBetween, floorToThousand } from './money'
import type {
  AllowanceAnchor,
  DailyAllowance,
  Funds,
  LocalDate,
  Settings,
} from './types'

/** Anchor otomatis diperbarui setiap minggu. */
export const ANCHOR_INTERVAL_DAYS = 7

/** Perubahan dana fleksibel sebesar ini memicu anchor baru di luar jadwal. */
export const ANCHOR_DRIFT_RATIO = 0.2

/** Sisa kemarin boleh terbawa paling banyak satu kali jatah dasar. */
export const CARRY_FORWARD_RATIO = 1

/** Kelebihan kemarin dipotong paling banyak setengah jatah dasar, supaya tidak spiral. */
export const CARRY_DEBT_RATIO = 0.5

/** Jatah dasar dari dana fleksibel, sebelum carry-over. */
export const computeBaseAllowance = (funds: Funds, settings: Settings): number => {
  const horizon = settings.allowanceHorizonDays
  const raw = horizon > 0 ? Math.floor(funds.flexible / horizon) : 0
  const capped = Math.min(raw, settings.allowanceMax)
  const rounded = floorToThousand(Math.max(0, capped))

  // Batas bawah hanya berlaku kalau penyangga sudah aman. Kalau belum, menaikkan
  // jatah ke `allowanceMin` justru akan menggerogoti penyangga.
  return funds.bufferFilled ? Math.max(rounded, settings.allowanceMin) : rounded
}

export const needsReanchor = (
  anchor: AllowanceAnchor | null,
  today: LocalDate,
  funds: Funds,
): boolean => {
  if (!anchor) return true
  if (daysBetween(anchor.anchoredOn, today) >= ANCHOR_INTERVAL_DAYS) return true
  // Anchor dari masa depan berarti data tidak konsisten — hitung ulang.
  if (daysBetween(anchor.anchoredOn, today) < 0) return true

  if (anchor.flexibleAtAnchor <= 0) return funds.flexible > 0

  const drift =
    Math.abs(funds.flexible - anchor.flexibleAtAnchor) / anchor.flexibleAtAnchor
  return drift >= ANCHOR_DRIFT_RATIO
}

export const createAnchor = (
  today: LocalDate,
  funds: Funds,
  settings: Settings,
): AllowanceAnchor => ({
  anchoredOn: today,
  baseAllowance: computeBaseAllowance(funds, settings),
  flexibleAtAnchor: funds.flexible,
})

/**
 * Sisa atau kelebihan kemarin yang terbawa ke hari ini, sudah dibatasi.
 * `previousAllowed` adalah jatah kemarin SETELAH carry, bukan jatah dasarnya.
 * Hemat dihargai, tapi tidak menumpuk jadi izin foya-foya; boros ada
 * konsekuensinya, tapi tidak menghabiskan jatah hari ini sepenuhnya.
 */
export const computeCarry = (
  previousAllowed: number,
  previousSpent: number,
): number => {
  if (previousAllowed <= 0) return 0
  const diff = previousAllowed - previousSpent
  if (diff >= 0) return Math.min(diff, Math.floor(previousAllowed * CARRY_FORWARD_RATIO))
  return Math.max(diff, -Math.floor(previousAllowed * CARRY_DEBT_RATIO))
}

export const computeDailyAllowance = (
  anchor: AllowanceAnchor,
  carry: number,
  spentToday: number,
): DailyAllowance => {
  const base = anchor.baseAllowance
  const allowed = Math.max(0, base + carry)
  const remaining = allowed - spentToday

  return {
    base,
    carry,
    allowed,
    spent: spentToday,
    remaining,
    overspent: spentToday > allowed,
  }
}
