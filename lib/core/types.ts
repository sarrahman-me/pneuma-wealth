/**
 * Tipe inti PNEUMA.
 *
 * Semua nilai uang adalah bilangan bulat rupiah. Tidak ada pecahan, tidak ada
 * float — pembulatan hanya terjadi di titik yang eksplisit (`floorToThousand`).
 */

/** Tanggal lokal pengguna dalam format `YYYY-MM-DD`. */
export type LocalDate = string

export type Settings = {
  /**
   * Biaya bertahan hidup per hari. Dipakai HANYA untuk menghitung target
   * penyangga dan runway — bukan jatah belanja harian.
   */
  dailyLivingCost: number
  /** Berapa hari hidup yang ingin dijamin oleh dana penyangga. */
  bufferDays: number
  /** Horizon pembagian dana fleksibel jadi jatah harian. */
  allowanceHorizonDays: number
  /** Batas bawah jatah harian, berlaku hanya ketika penyangga sudah penuh. */
  allowanceMin: number
  /** Batas atas jatah harian, supaya angka tidak melonjak setelah pemasukan besar. */
  allowanceMax: number
  /** Kewajiban dianggap "sudah punya nama" bila jatuh tempo dalam N hari ini. */
  obligationHorizonDays: number
}

export const DEFAULT_SETTINGS: Settings = {
  dailyLivingCost: 0,
  bufferDays: 30,
  allowanceHorizonDays: 30,
  allowanceMin: 0,
  allowanceMax: 500_000,
  obligationHorizonDays: 30,
}

/** Seberapa aman posisi penyangga saat ini. */
export type CoachMode = 'calm' | 'watchful' | 'tight'

export type FundsInput = {
  /** Total saldo akun yang dipakai sehari-hari (tabungan/goal tidak termasuk). */
  liquidBalance: number
  /** Total biaya tetap yang belum lunas dan jatuh tempo dalam horizon kewajiban. */
  scheduledObligations: number
  settings: Settings
}

export type Funds = {
  liquidBalance: number
  scheduledObligations: number
  /** Uang yang benar-benar bebas dipakai setelah kewajiban dipotong di depan. */
  available: number
  bufferTarget: number
  /** Bagian `available` yang sedang mengisi penyangga. */
  bufferBalance: number
  bufferFilled: boolean
  /** 0..1, atau null bila target penyangga belum diatur. */
  bufferRatio: number | null
  /** Sisa `available` setelah penyangga penuh — inilah yang dibagi jadi jatah. */
  flexible: number
  /** Berapa hari bertahan tanpa pemasukan baru, null bila biaya hidup belum diisi. */
  runwayDays: number | null
  mode: CoachMode
}

/**
 * Jatah harian dikunci pada satu titik waktu, bukan dihitung ulang tiap hari.
 * Ini yang membuat angkanya stabil dan hemat hari ini terasa hasilnya besok.
 */
export type AllowanceAnchor = {
  anchoredOn: LocalDate
  /** Jatah dasar harian yang berlaku sejak `anchoredOn`. */
  baseAllowance: number
  /** Dana fleksibel saat anchor dibuat, untuk mendeteksi perubahan besar. */
  flexibleAtAnchor: number
}

export type DailyAllowance = {
  base: number
  /** Sisa (positif) atau kelebihan (negatif) kemarin yang terbawa, sudah dibatasi. */
  carry: number
  /** `base + carry`, tidak pernah negatif. */
  allowed: number
  spent: number
  remaining: number
  overspent: boolean
}
