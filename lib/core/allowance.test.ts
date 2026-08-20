import { describe, expect, it } from 'vitest'
import {
  computeBaseAllowance,
  computeCarry,
  computeDailyAllowance,
  createAnchor,
  needsReanchor,
} from './allowance'
import { computeFunds } from './funds'
import { DEFAULT_SETTINGS, type Funds, type Settings } from './types'

const settings = (overrides: Partial<Settings> = {}): Settings => ({
  ...DEFAULT_SETTINGS,
  dailyLivingCost: 100_000,
  bufferDays: 30,
  allowanceHorizonDays: 30,
  allowanceMin: 0,
  allowanceMax: 500_000,
  ...overrides,
})

const fundsWith = (liquidBalance: number, config = settings()): Funds =>
  computeFunds({ liquidBalance, scheduledObligations: 0, settings: config })

describe('computeBaseAllowance', () => {
  it('membagi dana fleksibel sepanjang horizon dan membulatkan ke bawah', () => {
    // fleksibel 3jt / 30 hari = 100rb
    expect(computeBaseAllowance(fundsWith(6_000_000), settings())).toBe(100_000)
  })

  it('nol ketika penyangga belum penuh', () => {
    expect(computeBaseAllowance(fundsWith(2_000_000), settings())).toBe(0)
  })

  it('mengabaikan allowanceMin selama penyangga belum penuh', () => {
    const config = settings({ allowanceMin: 50_000 })
    expect(computeBaseAllowance(fundsWith(2_000_000, config), config)).toBe(0)
  })

  it('menerapkan allowanceMin setelah penyangga penuh', () => {
    const config = settings({ allowanceMin: 50_000 })
    // fleksibel 300rb / 30 = 10rb, dinaikkan ke 50rb
    expect(computeBaseAllowance(fundsWith(3_300_000, config), config)).toBe(50_000)
  })

  it('menahan lonjakan dengan allowanceMax', () => {
    const config = settings({ allowanceMax: 200_000 })
    expect(computeBaseAllowance(fundsWith(100_000_000, config), config)).toBe(200_000)
  })
})

describe('needsReanchor', () => {
  const funds = fundsWith(6_000_000)
  const anchor = createAnchor('2026-08-03', funds, settings())

  it('butuh anchor saat belum ada', () => {
    expect(needsReanchor(null, '2026-08-03', funds)).toBe(true)
  })

  it('stabil di dalam minggu yang sama', () => {
    expect(needsReanchor(anchor, '2026-08-08', funds)).toBe(false)
  })

  it('memperbarui setelah tujuh hari', () => {
    expect(needsReanchor(anchor, '2026-08-10', funds)).toBe(true)
  })

  it('memperbarui saat dana fleksibel melonjak', () => {
    expect(needsReanchor(anchor, '2026-08-05', fundsWith(20_000_000))).toBe(true)
  })

  it('mengabaikan perubahan kecil', () => {
    // fleksibel 3jt -> 3,15jt (5%)
    expect(needsReanchor(anchor, '2026-08-05', fundsWith(6_150_000))).toBe(false)
  })

  it('memperbarui saat dana fleksibel muncul dari nol', () => {
    const empty = createAnchor('2026-08-03', fundsWith(1_000_000), settings())
    expect(needsReanchor(empty, '2026-08-05', fundsWith(6_000_000))).toBe(true)
  })

  it('memperbarui saat anchor bertanggal masa depan', () => {
    expect(needsReanchor(anchor, '2026-08-01', funds)).toBe(true)
  })
})

describe('computeCarry', () => {
  it('membawa sisa kemarin', () => {
    expect(computeCarry(100_000, 60_000)).toBe(40_000)
  })

  it('membatasi sisa maksimal satu kali jatah', () => {
    expect(computeCarry(100_000, 0)).toBe(100_000)
  })

  it('memotong kelebihan kemarin', () => {
    expect(computeCarry(100_000, 130_000)).toBe(-30_000)
  })

  it('membatasi potongan di setengah jatah', () => {
    expect(computeCarry(100_000, 400_000)).toBe(-50_000)
  })

  it('nol ketika kemarin belum punya jatah', () => {
    expect(computeCarry(0, 50_000)).toBe(0)
  })
})

describe('computeDailyAllowance', () => {
  const anchor = createAnchor('2026-08-20', fundsWith(6_000_000), settings())

  it('menjumlahkan jatah dasar dengan carry', () => {
    const day = computeDailyAllowance(anchor, 40_000, 20_000)
    expect(day.allowed).toBe(140_000)
    expect(day.remaining).toBe(120_000)
    expect(day.overspent).toBe(false)
  })

  it('tidak pernah memberi jatah negatif', () => {
    const day = computeDailyAllowance({ ...anchor, baseAllowance: 30_000 }, -50_000, 0)
    expect(day.allowed).toBe(0)
  })

  it('menandai kelebihan belanja', () => {
    const day = computeDailyAllowance(anchor, 0, 150_000)
    expect(day.overspent).toBe(true)
    expect(day.remaining).toBe(-50_000)
  })

  it('jatah tidak bergerak selama anchor sama', () => {
    const senin = computeDailyAllowance(anchor, 0, 0)
    const rabu = computeDailyAllowance(anchor, 0, 80_000)
    expect(rabu.base).toBe(senin.base)
  })
})
