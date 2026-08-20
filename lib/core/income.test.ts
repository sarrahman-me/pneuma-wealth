import { describe, expect, it } from 'vitest'
import { computeBaseAllowance } from './allowance'
import { computeFunds } from './funds'
import { planIncome } from './income'
import { DEFAULT_SETTINGS, type Settings } from './types'

const settings = (overrides: Partial<Settings> = {}): Settings => ({
  ...DEFAULT_SETTINGS,
  dailyLivingCost: 100_000,
  bufferDays: 30,
  bufferFillPercent: 55,
  allowanceHorizonDays: 30,
  allowanceMax: 500_000,
  ...overrides,
})

const fundsAt = (liquidBalance: number, obligations: number, config = settings()) =>
  computeFunds({ liquidBalance, scheduledObligations: obligations, settings: config })

describe('planIncome', () => {
  it('membagi habis pemasukan tanpa sisa yang tidak dijelaskan', () => {
    const config = settings()
    const plan = planIncome(
      5_000_000,
      fundsAt(500_000, 0, config),
      config,
      computeBaseAllowance,
    )
    expect(plan.toObligations + plan.toBuffer + plan.toFlexible).toBe(5_000_000)
  })

  it('menutup tagihan lebih dulu ketika uang tersedia masih minus', () => {
    const config = settings()
    const before = fundsAt(500_000, 2_000_000, config)
    expect(before.available).toBe(-1_500_000)

    const plan = planIncome(2_000_000, before, config, computeBaseAllowance)
    expect(plan.toObligations).toBe(1_500_000)
    expect(plan.toBuffer + plan.toFlexible).toBe(500_000)
  })

  it('menaikkan jatah harian tapi tidak melewati batas atas', () => {
    const config = settings({ allowanceMax: 200_000 })
    const plan = planIncome(
      50_000_000,
      fundsAt(1_000_000, 0, config),
      config,
      computeBaseAllowance,
    )
    expect(plan.dailyAfter).toBe(200_000)
    expect(plan.dailyAfter).toBeGreaterThan(plan.dailyBefore)
  })

  it('menerjemahkan pemasukan jadi hari hidup', () => {
    const config = settings()
    const plan = planIncome(
      3_500_000,
      fundsAt(0, 0, config),
      config,
      computeBaseAllowance,
    )
    expect(plan.coversDays).toBe(35)
  })

  it('diam soal hari hidup ketika biaya hidup belum diisi', () => {
    const config = settings({ dailyLivingCost: 0 })
    const plan = planIncome(
      1_000_000,
      fundsAt(0, 0, config),
      config,
      computeBaseAllowance,
    )
    expect(plan.coversDays).toBeNull()
  })
})
