import { describe, expect, it } from 'vitest'
import { analyzeIncome } from './cadence'
import { computePace, isBurningTooFast } from './pace'

const cadence = analyzeIncome(
  [
    { dateLocal: '2026-05-01', amount: 5_000_000 },
    { dateLocal: '2026-06-01', amount: 5_000_000 },
    { dateLocal: '2026-07-01', amount: 5_000_000 },
    { dateLocal: '2026-08-01', amount: 5_000_000 },
  ],
  '2026-08-08',
)

describe('computePace', () => {
  it('menghitung laju terhadap rencana, bukan terhadap rata-rata', () => {
    const pace = computePace({
      daysSinceIncome: 6,
      spentSinceIncome: 2_100_000,
      plannedDaily: 100_000,
      available: 2_900_000,
      cadence,
    })
    expect(pace.daysElapsed).toBe(7)
    expect(pace.plannedSoFar).toBe(700_000)
    expect(pace.avgDailySpend).toBe(300_000)
    expect(pace.paceRatio).toBe(3)
  })

  it('memproyeksikan kapan uang habis pada laju sekarang', () => {
    const pace = computePace({
      daysSinceIncome: 6,
      spentSinceIncome: 2_100_000,
      plannedDaily: 100_000,
      available: 2_900_000,
      cadence,
    })
    // 2,9jt / 300rb per hari
    expect(pace.daysUntilEmpty).toBe(9)
    // Siklus biasanya 31 hari; 7 + 9 = 16, jadi ada lubang 15 hari.
    expect(pace.expectedCycleDays).toBe(31)
    expect(pace.shortfallDays).toBe(15)
  })

  it('tanpa lubang ketika laju sesuai rencana', () => {
    const pace = computePace({
      daysSinceIncome: 6,
      spentSinceIncome: 700_000,
      plannedDaily: 100_000,
      available: 4_300_000,
      cadence,
    })
    expect(pace.paceRatio).toBe(1)
    expect(pace.shortfallDays).toBe(0)
  })

  it('netral ketika belum pernah ada pemasukan', () => {
    const pace = computePace({
      daysSinceIncome: null,
      spentSinceIncome: 0,
      plannedDaily: 100_000,
      available: 1_000_000,
      cadence,
    })
    expect(pace.daysElapsed).toBeNull()
    expect(pace.paceRatio).toBeNull()
    expect(pace.shortfallDays).toBeNull()
  })

  it('tidak membagi nol ketika belum ada pengeluaran', () => {
    const pace = computePace({
      daysSinceIncome: 3,
      spentSinceIncome: 0,
      plannedDaily: 100_000,
      available: 1_000_000,
      cadence,
    })
    expect(pace.avgDailySpend).toBe(0)
    expect(pace.daysUntilEmpty).toBeNull()
  })
})

describe('isBurningTooFast', () => {
  const at = (daysSinceIncome: number, spentSinceIncome: number) =>
    computePace({
      daysSinceIncome,
      spentSinceIncome,
      plannedDaily: 100_000,
      available: 3_000_000,
      cadence,
    })

  it('diam di hari-hari pertama, karena satu hari belum jadi pola', () => {
    expect(isBurningTooFast(at(0, 900_000))).toBe(false)
  })

  it('menyala setelah laju bertahan beberapa hari', () => {
    expect(isBurningTooFast(at(4, 1_500_000))).toBe(true)
  })

  it('diam ketika masih di sekitar rencana', () => {
    expect(isBurningTooFast(at(4, 550_000))).toBe(false)
  })
})
