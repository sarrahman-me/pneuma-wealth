/**
 * Masa tunggu keinginan.
 *
 * Pencatatan transaksi hanya mendokumentasikan pembelian yang sudah terjadi —
 * emosinya datang terlambat. Di sini keinginan dicatat **sebelum** uangnya
 * keluar, lalu ditahan sebentar. Sebagian besar dorongan impulsif tidak
 * bertahan melewati jedanya, dan yang bertahan memang layak dibeli.
 *
 * Lama tunggunya ditentukan oleh ukuran keinginan relatif terhadap jatah
 * harian, bukan angka absolut: Rp 500rb berarti hal yang berbeda bagi orang
 * dengan jatah Rp 50rb dan Rp 200rb per hari.
 */

import { addDays, daysBetween } from './money'
import type { LocalDate } from './types'

export type WishStatus = 'waiting' | 'bought' | 'released'

/** Ambang dalam kelipatan jatah harian, urut dari yang paling besar. */
export const COOLING_TIERS: { minDaysOfAllowance: number; coolingDays: number }[] = [
  { minDaysOfAllowance: 7, coolingDays: 7 },
  { minDaysOfAllowance: 3, coolingDays: 3 },
  { minDaysOfAllowance: 1, coolingDays: 1 },
]

/** Tanpa jatah harian yang bermakna, semua keinginan ditahan sehari. */
export const DEFAULT_COOLING_DAYS = 1
export const MAX_COOLING_DAYS = 7

export const coolingDaysFor = (amount: number, dailyAllowance: number): number => {
  if (dailyAllowance <= 0) return DEFAULT_COOLING_DAYS
  const ratio = amount / dailyAllowance
  const tier = COOLING_TIERS.find((candidate) => ratio >= candidate.minDaysOfAllowance)
  return tier ? tier.coolingDays : DEFAULT_COOLING_DAYS
}

export const readyDateFor = (
  today: LocalDate,
  amount: number,
  dailyAllowance: number,
): LocalDate => addDays(today, coolingDaysFor(amount, dailyAllowance))

export type WishItem = {
  id: string
  name: string
  amount: number
  note: string | null
  createdOn: LocalDate
  readyOn: LocalDate
  status: WishStatus
}

export type WishView = WishItem & {
  /** Sisa hari sebelum boleh diputuskan. 0 berarti sudah boleh. */
  daysLeft: number
  ready: boolean
  /** Harga keinginan ini dalam hari hidup. Null bila biaya hidup belum diisi. */
  costInDays: number | null
  /** Harga dalam kelipatan jatah harian. Null bila jatah belum bermakna. */
  costInAllowances: number | null
}

export const viewWish = (
  wish: WishItem,
  today: LocalDate,
  dailyLivingCost: number,
  dailyAllowance: number,
): WishView => {
  const daysLeft = Math.max(0, daysBetween(today, wish.readyOn))

  return {
    ...wish,
    daysLeft,
    ready: daysLeft === 0,
    costInDays: dailyLivingCost > 0 ? Math.floor(wish.amount / dailyLivingCost) : null,
    costInAllowances:
      dailyAllowance > 0 ? Math.round((wish.amount / dailyAllowance) * 10) / 10 : null,
  }
}

/** Total keinginan yang masih menunggu — uang yang berpotensi keluar. */
export const pendingTotal = (wishes: WishItem[]): number =>
  wishes
    .filter((wish) => wish.status === 'waiting')
    .reduce((sum, wish) => sum + wish.amount, 0)

/**
 * Tanggal siap setelah keinginan disunting.
 *
 * Masa tunggu dihitung ulang dari `createdOn`, bukan dari hari ini — mengubah
 * harga bukan alasan untuk mengulang jeda dari nol. Hasilnya lalu ditahan agar
 * tidak pernah lebih awal dari `readyOn` yang sudah berjalan: menaikkan harga
 * boleh memperpanjang tunggu, menurunkannya tidak boleh memperpendeknya. Kalau
 * boleh, mengetik harga lebih kecil jadi cara termudah melewati jedanya.
 */
export const readyDateAfterEdit = (
  wish: Pick<WishItem, 'createdOn' | 'readyOn'>,
  amount: number,
  dailyAllowance: number,
): LocalDate => {
  const recomputed = readyDateFor(wish.createdOn, amount, dailyAllowance)
  return recomputed > wish.readyOn ? recomputed : wish.readyOn
}
