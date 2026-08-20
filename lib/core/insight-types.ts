import type { CoachMode, DailyAllowance, Funds, LocalDate, Settings } from './types'

export type Tone = 'calm' | 'alert'

/** Potongan waktu dalam sehari — dipakai untuk memilih ajakan yang masuk akal. */
export type TimeBucket = 'morning' | 'midday' | 'afternoon' | 'evening' | 'night'

export type InsightStats = {
  txCountTotal: number
  txCountToday: number
  spent7d: number
  daysWithTx7d: number
  /** Porsi pengeluaran 7 hari yang bersifat keinginan, 0..1. Null bila belum ada data. */
  discretionaryShare7d: number | null
  /** Hari sejak pemasukan terakhir. Null bila belum pernah ada pemasukan. */
  daysSinceIncome: number | null
  unpaidFixedCostCount: number
  unpaidFixedCostAmount: number
  /** Hari menuju biaya tetap terdekat yang belum dibayar. Null bila tidak ada. */
  daysToNextDue: number | null
}

export type MemoryEntry = {
  dateLocal: LocalDate
  mode: CoachMode
  headline: string
  ruleId: string
}

export type InsightInput = {
  today: LocalDate
  timeBucket: TimeBucket
  settings: Settings
  funds: Funds
  allowance: DailyAllowance
  stats: InsightStats
  lastMemory: MemoryEntry | null
}

export type CoachingInsight = {
  ruleId: string
  statusTitle: string
  bullets: string[]
  nextStep: string
  tone: Tone
  mode: CoachMode
  /** Jembatan dari hari sebelumnya, muncul hanya bila ada yang layak disambung. */
  continuityLine: string | null
  keyNumbers: number[]
}
