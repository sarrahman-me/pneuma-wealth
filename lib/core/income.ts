/**
 * Ritual pemasukan.
 *
 * Momen paling berbahaya untuk pemasukan tak menentu bukan saat belanja, tapi
 * saat uang masuk: angka besar di rekening terasa seperti uang bebas. Modul ini
 * memecah uang itu jadi bagian-bagian yang sudah punya nama, sebelum sempat
 * dianggap milik sendiri seluruhnya.
 *
 * Pembagiannya diturunkan dari selisih dua keadaan `computeFunds`, bukan dari
 * rumus terpisah — jadi tidak mungkin bertentangan dengan model dana.
 */

import { computeFunds } from './funds'
import type { Funds, Settings } from './types'

export type IncomePlan = {
  amount: number
  /** Bagian yang langsung menutup tagihan yang belum tertutup. */
  toObligations: number
  toBuffer: number
  toFlexible: number
  before: Funds
  after: Funds
  dailyBefore: number
  dailyAfter: number
  /** Berapa hari hidup yang dibeli pemasukan ini. Null bila biaya hidup belum diisi. */
  coversDays: number | null
}

/**
 * `computeDaily` disuntikkan supaya modul ini tidak bergantung pada aturan
 * jatah harian — pemanggil memakai `computeBaseAllowance`.
 */
export const planIncome = (
  amount: number,
  before: Funds,
  settings: Settings,
  computeDaily: (funds: Funds, settings: Settings) => number,
): IncomePlan => {
  const safeAmount = Math.max(0, Math.trunc(amount))

  const after = computeFunds({
    liquidBalance: before.liquidBalance + safeAmount,
    scheduledObligations: before.scheduledObligations,
    settings,
  })

  const toBuffer = Math.max(0, after.reserved - before.reserved)
  const toFlexible = Math.max(0, after.flexible - before.flexible)

  return {
    amount: safeAmount,
    // Sisanya: bagian yang habis menutup uang tersedia yang tadinya minus.
    toObligations: Math.max(0, safeAmount - toBuffer - toFlexible),
    toBuffer,
    toFlexible,
    before,
    after,
    dailyBefore: computeDaily(before, settings),
    dailyAfter: computeDaily(after, settings),
    coversDays:
      settings.dailyLivingCost > 0
        ? Math.floor(safeAmount / settings.dailyLivingCost)
        : null,
  }
}
