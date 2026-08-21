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

  it('tetap menyisakan dana fleksibel selama penyangga diisi bertahap', () => {
    const funds = computeFunds({
      liquidBalance: 2_000_000,
      scheduledObligations: 0,
      settings: settings({ bufferFillPercent: 55 }),
    })
    expect(funds.bufferTarget).toBe(3_000_000)
    expect(funds.bufferFilled).toBe(false)
    // Inilah yang dulu nol dan membuat jatah harian mustahil dipakai.
    expect(funds.flexible).toBe(900_000)
    expect(funds.reserved).toBe(1_100_000)
  })

  it('porsi pengisian menentukan seberapa ketat hari-harinya', () => {
    const ketat = computeFunds({
      liquidBalance: 2_000_000,
      scheduledObligations: 0,
      settings: settings({ bufferFillPercent: 80 }),
    })
    const longgar = computeFunds({
      liquidBalance: 2_000_000,
      scheduledObligations: 0,
      settings: settings({ bufferFillPercent: 20 }),
    })
    expect(ketat.flexible).toBe(400_000)
    expect(longgar.flexible).toBe(1_600_000)
  })

  it('penyangga dan dana fleksibel tidak pernah mengklaim rupiah yang sama', () => {
    const funds = computeFunds({
      liquidBalance: 2_400_000,
      scheduledObligations: 400_000,
      settings: settings(),
    })
    expect(funds.reserved + funds.flexible).toBe(funds.available)
  })

  it('menyisakan dana fleksibel setelah penyangga penuh', () => {
    const funds = computeFunds({
      liquidBalance: 10_000_000,
      scheduledObligations: 0,
      settings: settings(),
    })
    expect(funds.bufferFilled).toBe(true)
    // Penahanan berhenti di target, tidak ikut naik terus.
    expect(funds.reserved).toBe(3_000_000)
    expect(funds.flexible).toBe(7_000_000)
    expect(funds.mode).toBe('calm')
  })

  it('tidak pernah menjatuhkan dana fleksibel saat uang bertambah', () => {
    // Dulu ada jurang tepat di target penyangga: satu rupiah tambahan membuat
    // seluruh target langsung ditahan dan jatah harian anjlok ke nol.
    const config = settings({ dailyLivingCost: 100_000, bufferDays: 10, bufferFillPercent: 20 })
    let previous = -1
    for (let liquidBalance = 0; liquidBalance <= 6_000_000; liquidBalance += 1_000) {
      const funds = computeFunds({ liquidBalance, scheduledObligations: 0, settings: config })
      expect(funds.flexible).toBeGreaterThanOrEqual(previous)
      expect(funds.reserved).toBeLessThanOrEqual(funds.bufferTarget)
      previous = funds.flexible
    }
  })

  it('menahan sesuai porsi meski uang tersedia sudah melewati target', () => {
    const funds = computeFunds({
      liquidBalance: 1_650_500,
      scheduledObligations: 490_000,
      settings: settings({ dailyLivingCost: 100_000, bufferDays: 10, bufferFillPercent: 20 }),
    })
    expect(funds.available).toBe(1_160_500)
    expect(funds.bufferTarget).toBe(1_000_000)
    expect(funds.reserved).toBe(232_100)
    expect(funds.flexible).toBe(928_400)
    expect(funds.bufferFilled).toBe(false)
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
    expect(funds.bufferRatio).toBeCloseTo(0.55 / 3)
    expect(funds.mode).toBe('tight')
  })

  it('mode watchful ketika penyangga terisi sebagian besar', () => {
    const funds = computeFunds({
      liquidBalance: 3_000_000,
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
    expect(funds.reserved).toBe(0)
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
