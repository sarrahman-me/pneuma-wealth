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

import { computeFunds } from './funds'
import { addDays, daysBetween } from './money'
import type { Funds, LocalDate, Settings } from './types'

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

/**
 * Seberapa berat keinginan ini bagi keadaan uang hari ini.
 *
 * - `aman`   — harganya masih tertutup bagian yang memang boleh dibelanjakan.
 * - `ketat`  — sebagian harganya menggerogoti dana cadangan.
 * - `belum`  — harganya menembus uang yang sudah jadi milik tagihan.
 */
export type WishVerdict = 'aman' | 'ketat' | 'belum'

export type WishImpact = {
  verdict: WishVerdict
  /** Bagian harga yang tidak tertutup uang yang boleh dibelanjakan. */
  fromBuffer: number
  /** Bagian harga yang menembus uang yang sudah disisihkan untuk tagihan. */
  fromObligations: number
  /** Kekurangan sebelum keinginan ini terjangkau tanpa menyentuh cadangan. */
  shortfall: number
  bufferBefore: number
  bufferAfter: number
  dailyBefore: number
  dailyAfter: number
  /** Turunnya jatah harian setelah pembelian. Tidak pernah negatif. */
  dailyDrop: number
}

export type WishView = WishItem & {
  /** Sisa hari sebelum boleh diputuskan. 0 berarti sudah boleh. */
  daysLeft: number
  ready: boolean
  /** Harga keinginan ini dalam hari hidup. Null bila biaya hidup belum diisi. */
  costInDays: number | null
  /** Harga dalam kelipatan jatah harian. Null bila jatah belum bermakna. */
  costInAllowances: number | null
  /** Akibatnya kalau dibeli hari ini. Null bila keadaan uang belum diketahui. */
  impact: WishImpact | null
}

/**
 * Akibat membeli sebuah keinginan hari ini.
 *
 * Diturunkan dari selisih dua keadaan `computeFunds` — cara yang sama dipakai
 * ritual pemasukan — jadi angka yang ditampilkan di sini tidak mungkin
 * bertentangan dengan model dana. Ini menjawab pertanyaan yang tidak dijawab
 * masa tunggu: menunggu memastikan keinginannya bertahan, hitungan ini
 * memperlihatkan harganya dalam hal yang benar-benar kamu rasakan besok.
 *
 * `computeDaily` disuntikkan supaya modul ini tidak bergantung pada aturan
 * jatah harian — pemanggil memakai `computeBaseAllowance`.
 */
export const planWishPurchase = (
  amount: number,
  funds: Funds,
  settings: Settings,
  computeDaily: (funds: Funds, settings: Settings) => number,
): WishImpact => {
  const price = Math.max(0, Math.trunc(amount))

  const after = computeFunds({
    liquidBalance: funds.liquidBalance - price,
    scheduledObligations: funds.scheduledObligations,
    settings,
  })

  const available = Math.max(0, funds.available)
  const flexible = Math.max(0, funds.flexible)

  // Harga dipecah menurut lapisan mana yang harus disentuh untuk menutupinya.
  const fromObligations = Math.max(0, price - available)
  const fromBuffer = Math.max(0, Math.min(price, available) - flexible)

  const dailyBefore = computeDaily(funds, settings)
  const dailyAfter = computeDaily(after, settings)

  return {
    verdict: fromObligations > 0 ? 'belum' : fromBuffer > 0 ? 'ketat' : 'aman',
    fromBuffer,
    fromObligations,
    shortfall: Math.max(0, price - flexible),
    bufferBefore: funds.bufferBalance,
    bufferAfter: after.bufferBalance,
    dailyBefore,
    dailyAfter,
    dailyDrop: Math.max(0, dailyBefore - dailyAfter),
  }
}

export const viewWish = (
  wish: WishItem,
  today: LocalDate,
  dailyLivingCost: number,
  dailyAllowance: number,
  impact: WishImpact | null = null,
): WishView => {
  const daysLeft = Math.max(0, daysBetween(today, wish.readyOn))

  return {
    ...wish,
    daysLeft,
    ready: daysLeft === 0,
    costInDays: dailyLivingCost > 0 ? Math.floor(wish.amount / dailyLivingCost) : null,
    costInAllowances:
      dailyAllowance > 0 ? Math.round((wish.amount / dailyAllowance) * 10) / 10 : null,
    impact,
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
