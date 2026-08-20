import { describe, expect, it } from 'vitest'
import { analyzeIncome, percentile } from './cadence'

describe('percentile', () => {
  it('membulatkan ke atas supaya sarannya konservatif', () => {
    expect(percentile([10, 20, 30, 40], 0.8)).toBe(40)
    expect(percentile([10, 20, 30, 40, 50], 0.8)).toBe(40)
  })

  it('null untuk daftar kosong', () => {
    expect(percentile([], 0.5)).toBeNull()
  })
})

describe('analyzeIncome', () => {
  const events = [
    { dateLocal: '2026-05-01', amount: 5_000_000 },
    { dateLocal: '2026-05-25', amount: 4_000_000 },
    { dateLocal: '2026-06-20', amount: 6_000_000 },
    { dateLocal: '2026-08-01', amount: 3_000_000 },
  ]

  it('membaca jeda antar hari pemasukan', () => {
    const cadence = analyzeIncome(events, '2026-08-20')
    expect(cadence.count).toBe(4)
    expect(cadence.gaps).toEqual([24, 26, 42])
    expect(cadence.longestGap).toBe(42)
    expect(cadence.daysSinceLast).toBe(19)
  })

  it('menggabungkan pemasukan di tanggal yang sama', () => {
    const cadence = analyzeIncome(
      [
        { dateLocal: '2026-05-01', amount: 1_000_000 },
        { dateLocal: '2026-05-01', amount: 2_000_000 },
        { dateLocal: '2026-06-01', amount: 3_000_000 },
      ],
      '2026-06-05',
    )
    // Tanpa penggabungan, ini terbaca sebagai jeda nol hari yang menyesatkan.
    expect(cadence.count).toBe(2)
    expect(cadence.gaps).toEqual([31])
    expect(cadence.medianAmount).toBe(3_000_000)
  })

  it('menyarankan penyangga dari jeda tipikal, bukan dari tebakan', () => {
    const cadence = analyzeIncome(events, '2026-08-20')
    expect(cadence.confident).toBe(true)
    expect(cadence.suggestedBufferDays).toBe(42)
  })

  it('menahan saran selama jedanya belum cukup banyak', () => {
    const cadence = analyzeIncome(events.slice(0, 3), '2026-06-25')
    expect(cadence.confident).toBe(false)
    expect(cadence.suggestedBufferDays).toBeNull()
  })

  it('tidak menyarankan di bawah batas bawah yang masuk akal', () => {
    const weekly = [
      { dateLocal: '2026-08-01', amount: 500_000 },
      { dateLocal: '2026-08-08', amount: 500_000 },
      { dateLocal: '2026-08-15', amount: 500_000 },
      { dateLocal: '2026-08-22', amount: 500_000 },
    ]
    expect(analyzeIncome(weekly, '2026-08-23').suggestedBufferDays).toBe(14)
  })

  it('kosong ketika belum ada pemasukan sama sekali', () => {
    const cadence = analyzeIncome([], '2026-08-20')
    expect(cadence.count).toBe(0)
    expect(cadence.lastDate).toBeNull()
    expect(cadence.daysSinceLast).toBeNull()
    expect(cadence.typicalGap).toBeNull()
  })
})
