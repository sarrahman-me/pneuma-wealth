/**
 * Jatah harian.
 *
 * Versi desktop menghitung ulang jatah dari saldo setiap kali halaman dibuka,
 * jadi angkanya bergoyang tiap hari dan hemat kemarin tidak pernah terasa.
 * Di sini jatah dikunci pada sebuah anchor dan hanya dihitung ulang saat ada
 * alasan nyata: seminggu berlalu, atau dana fleksibel berubah besar.
 */

import type { IncomeCadence } from './cadence'
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

/**
 * Horizon pembagian jatah, disesuaikan dengan ritme pemasukan yang nyata.
 *
 * Membagi uang sepanjang 30 hari padahal pemasukan datang tiap 42 hari adalah
 * penyebab langsung kehabisan uang sebelum pemasukan berikutnya. Kalau riwayat
 * menunjukkan jeda yang lebih panjang dari setelan manual, jeda itulah yang
 * dipakai. Arahnya sengaja satu sisi — hanya boleh memperpanjang, tidak pernah
 * memperpendek — jadi penyesuaian ini tidak pernah membuat jatah membesar
 * melebihi yang pengguna izinkan sendiri.
 */
export const resolveHorizonDays = (
  settings: Settings,
  cadence: IncomeCadence | null,
): { days: number; fromCadence: boolean } => {
  const manual = settings.allowanceHorizonDays
  const observed = cadence?.suggestedBufferDays ?? null

  if (observed === null || observed <= manual) {
    return { days: manual, fromCadence: false }
  }
  return { days: observed, fromCadence: true }
}

/**
 * Jatah dasar dari dana fleksibel, sebelum carry-over.
 *
 * `allowanceMin` dulu hanya berlaku setelah penyangga penuh, yang berarti
 * pengguna dengan penyangga belum penuh selalu melihat Rp 0. Sekarang batas
 * bawah selalu berlaku, tapi tidak pernah menjanjikan lebih dari yang sanggup
 * ditopang uang tersedia sepanjang horizon — jadi tetap tidak bisa berbohong.
 */
export const computeBaseAllowance = (funds: Funds, settings: Settings): number => {
  const horizon = settings.allowanceHorizonDays
  if (horizon <= 0) return 0

  const fromFlexible = Math.floor(Math.max(0, funds.flexible) / horizon)
  const supportable = Math.floor(Math.max(0, funds.available) / horizon)
  const lifted = Math.max(fromFlexible, Math.min(settings.allowanceMin, supportable))

  return floorToThousand(Math.min(lifted, settings.allowanceMax))
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
