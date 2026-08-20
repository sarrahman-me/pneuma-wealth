/**
 * Lapisan uang (waterfall).
 *
 * Perbedaan penting dari versi desktop: kewajiban terjadwal dipotong **di
 * depan**, bukan saat dibayar. Uang yang sudah punya nama tidak pernah ikut
 * dihitung sebagai uang yang boleh dibelanjakan, jadi jatah harian tidak
 * pernah terlalu optimis dan tidak jatuh mendadak di hari pembayaran.
 */

import { clamp } from './money'
import type { CoachMode, Funds, FundsInput } from './types'

/** Di bawah rasio ini penyangga dianggap benar-benar tipis. */
const TIGHT_BUFFER_RATIO = 0.5

const resolveMode = (bufferRatio: number | null, bufferFilled: boolean): CoachMode => {
  if (bufferFilled) return 'calm'
  if (bufferRatio === null) return 'watchful'
  return bufferRatio < TIGHT_BUFFER_RATIO ? 'tight' : 'watchful'
}

export const computeFunds = ({
  liquidBalance,
  scheduledObligations,
  settings,
}: FundsInput): Funds => {
  const obligations = Math.max(0, scheduledObligations)
  const available = liquidBalance - obligations

  const bufferTarget = Math.max(0, settings.dailyLivingCost * settings.bufferDays)
  const bufferBalance = clamp(available, 0, bufferTarget)
  const bufferFilled = bufferTarget > 0 && available >= bufferTarget
  const bufferRatio = bufferTarget > 0 ? clamp(available / bufferTarget, 0, 1) : null

  const flexible = Math.max(0, available - bufferTarget)

  // Runway dihitung dari `available`, jadi angkanya sudah memperhitungkan
  // kewajiban yang belum dibayar. Ini "aman N hari setelah semua tagihan lunas".
  const runwayDays =
    settings.dailyLivingCost > 0
      ? Math.floor(Math.max(0, available) / settings.dailyLivingCost)
      : null

  return {
    liquidBalance,
    scheduledObligations: obligations,
    available,
    bufferTarget,
    bufferBalance,
    bufferFilled,
    bufferRatio,
    flexible,
    runwayDays,
    mode: resolveMode(bufferRatio, bufferFilled),
  }
}
