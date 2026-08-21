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
 * 2. Penyangga diisi **bertahap**, bukan sebagai gerbang, dan aturan bertahap
 *    itu berlaku sampai penyangga benar-benar penuh. Versi sebelumnya
 *    menetapkan `flexible = available - bufferTarget` begitu uang tersedia
 *    melewati target, sehingga ada jurang di perbatasan: dengan target Rp 1 jt,
 *    uang tersedia Rp 999.999 menyisakan Rp 799.999 yang boleh dibelanjakan,
 *    tapi Rp 1.000.000 menyisakan Rp 0. Bertambah satu rupiah membuat jatah
 *    harian anjlok — uang naik tapi terasa makin miskin. Sekarang porsi yang
 *    ditahan tumbuh mulus mengikuti `bufferFillPercent` dan berhenti di target,
 *    jadi lebih banyak uang tidak pernah berarti lebih sedikit jatah.
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

  // Sekian persen dari uang tersedia ditahan sebagai penyangga, sisanya boleh
  // dibelanjakan — sampai penahanan itu menyentuh target dan berhenti di sana.
  // Tanpa target penyangga (biaya hidup belum diisi) semua uang fleksibel.
  const fillPercent = clamp(Math.trunc(settings.bufferFillPercent), 0, 100)
  const reserved =
    bufferTarget > 0
      ? Math.min(bufferTarget, Math.floor((positive * fillPercent) / 100))
      : 0
  const flexible = positive - reserved

  // `bufferBalance` adalah uang yang benar-benar sedang ditahan sebagai
  // penyangga — angka yang sama dengan yang tampil di batang dana. Rasa aman
  // diukur dari sini, bukan dari seluruh uang tersedia, supaya "penuh" berarti
  // penyangganya memang sudah terkumpul.
  const bufferBalance = reserved
  const bufferFilled = bufferTarget > 0 && reserved >= bufferTarget
  const bufferRatio = bufferTarget > 0 ? clamp(reserved / bufferTarget, 0, 1) : null

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
