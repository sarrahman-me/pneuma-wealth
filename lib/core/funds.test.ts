import { describe, expect, it } from 'vitest'
import { computeFunds } from './funds'
import { DEFAULT_SETTINGS, type Settings } from './types'

const settings = (overrides: Partial<Settings> = {}): Settings => ({
  ...DEFAULT_SETTINGS,
  dailyLivingCost: 100_000,
  bufferDays: 30,
  allowanceHorizonDays: 30,
  allowanceMax: 500_000,
  ...overrides,
})

describe('computeFunds', () => {
  it('memotong kewajiban terjadwal di depan', () => {
    const funds = computeFunds({
      liquidBalance: 10_000_000,
      scheduledObligations: 2_000_000,
      settings: settings(),
    })
    expect(funds.available).toBe(8_000_000)
  })

  it('tidak menghitung dana fleksibel sebelum penyangga penuh', () => {
    const funds = computeFunds({
      liquidBalance: 2_000_000,
      scheduledObligations: 0,
      settings: settings(),
    })
    expect(funds.bufferTarget).toBe(3_000_000)
    expect(funds.bufferFilled).toBe(false)
    expect(funds.flexible).toBe(0)
  })

  it('menyisakan dana fleksibel setelah penyangga penuh', () => {
    const funds = computeFunds({
      liquidBalance: 5_000_000,
      scheduledObligations: 0,
      settings: settings(),
    })
    expect(funds.bufferFilled).toBe(true)
    expect(funds.flexible).toBe(2_000_000)
    expect(funds.mode).toBe('calm')
  })

  it('runway memperhitungkan kewajiban yang belum dibayar', () => {
    const funds = computeFunds({
      liquidBalance: 5_000_000,
      scheduledObligations: 2_000_000,
      settings: settings(),
    })
    // (5jt - 2jt) / 100rb
    expect(funds.runwayDays).toBe(30)
  })

  it('mode tight ketika penyangga di bawah setengah target', () => {
    const funds = computeFunds({
      liquidBalance: 1_000_000,
      scheduledObligations: 0,
      settings: settings(),
    })
    expect(funds.bufferRatio).toBeCloseTo(1 / 3)
    expect(funds.mode).toBe('tight')
  })

  it('mode watchful ketika penyangga terisi sebagian besar', () => {
    const funds = computeFunds({
      liquidBalance: 2_500_000,
      scheduledObligations: 0,
      settings: settings(),
    })
    expect(funds.mode).toBe('watchful')
  })

  it('menangani saldo negatif tanpa runway negatif', () => {
    const funds = computeFunds({
      liquidBalance: 500_000,
      scheduledObligations: 2_000_000,
      settings: settings(),
    })
    expect(funds.available).toBe(-1_500_000)
    expect(funds.flexible).toBe(0)
    expect(funds.bufferBalance).toBe(0)
    expect(funds.runwayDays).toBe(0)
    expect(funds.mode).toBe('tight')
  })

  it('tidak memaksa runway ketika biaya hidup belum diisi', () => {
    const funds = computeFunds({
      liquidBalance: 5_000_000,
      scheduledObligations: 0,
      settings: settings({ dailyLivingCost: 0 }),
    })
    expect(funds.runwayDays).toBeNull()
    expect(funds.bufferRatio).toBeNull()
    expect(funds.mode).toBe('watchful')
  })
})
