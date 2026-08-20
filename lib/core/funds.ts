/**
 * Lapisan uang (waterfall).
 *
 * Dua keputusan penting di sini:
 *
 * 1. Kewajiban terjadwal dipotong **di depan**, bukan saat dibayar. Uang yang
 *    sudah punya nama tidak pernah ikut dihitung sebagai uang yang boleh
 *    dibelanjakan, jadi jatah harian tidak pernah terlalu optimis dan tidak
 *    jatuh mendadak di hari pembayaran.
 *
 * 2. Penyangga diisi **bertahap**, bukan sebagai gerbang. Versi sebelumnya
 *    menetapkan `flexible = available - bufferTarget`, sehingga selama
 *    penyangga belum penuh dana fleksibel nol dan jatah harian Rp 0. Untuk
 *    pemasukan tak menentu itu bisa berbulan-bulan — aturan yang mustahil
 *    dipatuhi akan ditinggalkan. Sekarang sebagian uang mengisi penyangga dan
 *    sisanya tetap boleh dipakai, jadi selalu ada angka yang hidup.
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
  const positive = Math.max(0, available)

  const bufferTarget = Math.max(0, settings.dailyLivingCost * settings.bufferDays)
  const bufferFilled = bufferTarget > 0 && available >= bufferTarget

  // Selama penyangga belum penuh, uang dibagi dua: sebagian mengisi penyangga,
  // sisanya boleh dibelanjakan. Tanpa target penyangga (biaya hidup belum
  // diisi) semua uang dianggap fleksibel.
  const fillPercent = clamp(Math.trunc(settings.bufferFillPercent), 0, 100)
  const flexible = bufferFilled
    ? available - bufferTarget
    : bufferTarget > 0
      ? Math.floor((positive * (100 - fillPercent)) / 100)
      : positive

  // `bufferBalance` mengukur rasa aman: seluruh uang yang belum dibelanjakan
  // memang ada di sana. `reserved` mengukur hal lain — bagian yang belum boleh
  // disentuh. Keduanya sengaja dipisah supaya persentase penyangga tidak ikut
  // turun hanya karena sebagian uang boleh dibelanjakan.
  const bufferBalance = clamp(available, 0, bufferTarget)
  const bufferRatio = bufferTarget > 0 ? clamp(available / bufferTarget, 0, 1) : null
  const reserved = positive - flexible

  // Runway dihitung dari `available`, jadi angkanya sudah memperhitungkan
  // kewajiban yang belum dibayar. Ini "aman N hari setelah semua tagihan lunas".
  const runwayDays =
    settings.dailyLivingCost > 0
      ? Math.floor(positive / settings.dailyLivingCost)
      : null

  return {
    liquidBalance,
    scheduledObligations: obligations,
    available,
    bufferTarget,
    bufferBalance,
    reserved,
    bufferFilled,
    bufferRatio,
    flexible,
    runwayDays,
    mode: resolveMode(bufferRatio, bufferFilled),
  }
}
