import { describe, expect, it } from 'vitest'
import { computeBaseAllowance } from './allowance'
import { computeFunds } from './funds'
import { DEFAULT_SETTINGS, type Settings } from './types'
import {
  coolingDaysFor,
  pendingTotal,
  planWishPurchase,
  readyDateAfterEdit,
  readyDateFor,
  viewWish,
  type WishItem,
} from './wish'

describe('coolingDaysFor', () => {
  it('menahan lebih lama untuk keinginan yang lebih besar', () => {
    expect(coolingDaysFor(50_000, 100_000)).toBe(1)
    expect(coolingDaysFor(150_000, 100_000)).toBe(1)
    expect(coolingDaysFor(400_000, 100_000)).toBe(3)
    expect(coolingDaysFor(900_000, 100_000)).toBe(7)
  })

  it('ukurannya relatif terhadap jatah, bukan angka absolut', () => {
    // Rp 500rb berarti hal berbeda bagi jatah 50rb dan 250rb per hari.
    expect(coolingDaysFor(500_000, 50_000)).toBe(7)
    expect(coolingDaysFor(500_000, 250_000)).toBe(1)
  })

  it('tetap menahan sehari ketika jatah belum bermakna', () => {
    expect(coolingDaysFor(500_000, 0)).toBe(1)
  })
})

describe('readyDateFor', () => {
  it('membekukan tanggal keputusan sejak keinginan dicatat', () => {
    expect(readyDateFor('2026-08-20', 900_000, 100_000)).toBe('2026-08-27')
  })
})

describe('viewWish', () => {
  const wish: WishItem = {
    id: 'a',
    name: 'Sepatu',
    amount: 600_000,
    note: null,
    createdOn: '2026-08-20',
    readyOn: '2026-08-23',
    status: 'waiting',
  }

  it('menerjemahkan harga jadi hari hidup dan kelipatan jatah', () => {
    const view = viewWish(wish, '2026-08-21', 100_000, 120_000)
    expect(view.daysLeft).toBe(2)
    expect(view.ready).toBe(false)
    expect(view.costInDays).toBe(6)
    expect(view.costInAllowances).toBe(5)
  })

  it('siap diputuskan tepat pada tanggalnya', () => {
    expect(viewWish(wish, '2026-08-23', 100_000, 120_000).ready).toBe(true)
  })

  it('tidak pernah menghitung mundur negatif setelah lewat', () => {
    const view = viewWish(wish, '2026-09-01', 100_000, 120_000)
    expect(view.daysLeft).toBe(0)
    expect(view.ready).toBe(true)
  })

  it('diam soal harga ketika biaya hidup belum diisi', () => {
    expect(viewWish(wish, '2026-08-21', 0, 0).costInDays).toBeNull()
    expect(viewWish(wish, '2026-08-21', 0, 0).costInAllowances).toBeNull()
  })
})

describe('pendingTotal', () => {
  it('hanya menjumlah yang masih ditahan', () => {
    const items: WishItem[] = [
      { id: 'a', name: 'a', amount: 100_000, note: null, createdOn: '2026-08-01', readyOn: '2026-08-02', status: 'waiting' },
      { id: 'b', name: 'b', amount: 200_000, note: null, createdOn: '2026-08-01', readyOn: '2026-08-02', status: 'released' },
      { id: 'c', name: 'c', amount: 300_000, note: null, createdOn: '2026-08-01', readyOn: '2026-08-02', status: 'bought' },
    ]
    expect(pendingTotal(items)).toBe(100_000)
  })
})

describe('readyDateAfterEdit', () => {
  const wish = { createdOn: '2026-03-01', readyOn: '2026-03-04' }

  it('memperpanjang tunggu saat harga dinaikkan', () => {
    // 700rb pada jatah 100rb = 7× jatah, tingkat tunggu tertinggi.
    expect(readyDateAfterEdit(wish, 700_000, 100_000)).toBe('2026-03-08')
  })

  it('tidak memperpendek tunggu saat harga diturunkan', () => {
    expect(readyDateAfterEdit(wish, 10_000, 100_000)).toBe('2026-03-04')
  })

  it('menghitung ulang dari tanggal pencatatan, bukan dari hari ini', () => {
    // Tetap 2026-03-08 walau disunting berhari-hari kemudian.
    expect(readyDateAfterEdit({ createdOn: '2026-03-01', readyOn: '2026-03-02' }, 700_000, 100_000)).toBe(
      '2026-03-08',
    )
  })
})

describe('planWishPurchase', () => {
  const settings = (overrides: Partial<Settings> = {}): Settings => ({
    ...DEFAULT_SETTINGS,
    dailyLivingCost: 100_000,
    bufferDays: 10,
    bufferFillPercent: 20,
    allowanceHorizonDays: 20,
    allowanceMin: 20_000,
    allowanceMax: 500_000,
    ...overrides,
  })

  const fundsWith = (liquidBalance: number, config = settings()) =>
    computeFunds({ liquidBalance, scheduledObligations: 490_000, settings: config })

  it('menyebut aman selama harganya tertutup uang yang boleh dibelanjakan', () => {
    const config = settings()
    const impact = planWishPurchase(200_000, fundsWith(1_650_500, config), config, computeBaseAllowance)

    expect(impact.verdict).toBe('aman')
    expect(impact.fromBuffer).toBe(0)
    expect(impact.shortfall).toBe(0)
    // Harganya tetap terasa: jatah harian turun, cadangan ikut menipis.
    expect(impact.dailyAfter).toBeLessThan(impact.dailyBefore)
    expect(impact.bufferAfter).toBeLessThan(impact.bufferBefore)
  })

  it('menandai bagian harga yang menggerogoti dana cadangan', () => {
    const config = settings()
    const funds = fundsWith(1_650_500, config)
    // Boleh dibelanjakan Rp 928.400; Rp 71.600 sisanya dari dana cadangan.
    const impact = planWishPurchase(1_000_000, funds, config, computeBaseAllowance)

    expect(funds.flexible).toBe(928_400)
    expect(impact.verdict).toBe('ketat')
    expect(impact.fromBuffer).toBe(71_600)
    expect(impact.fromObligations).toBe(0)
  })

  it('menandai harga yang menembus uang milik tagihan', () => {
    const config = settings()
    const funds = fundsWith(1_650_500, config)
    // Uang tersedia Rp 1.160.500 — di atas itu yang dipakai uang tagihan.
    const impact = planWishPurchase(1_400_000, funds, config, computeBaseAllowance)

    expect(impact.verdict).toBe('belum')
    expect(impact.fromObligations).toBe(239_500)
    expect(impact.shortfall).toBe(471_600)
  })

  it('tidak pernah melaporkan jatah harian naik setelah uang keluar', () => {
    const config = settings()
    const funds = fundsWith(1_650_500, config)

    for (let amount = 0; amount <= 1_500_000; amount += 50_000) {
      const impact = planWishPurchase(amount, funds, config, computeBaseAllowance)
      expect(impact.dailyAfter).toBeLessThanOrEqual(impact.dailyBefore)
      expect(impact.dailyDrop).toBeGreaterThanOrEqual(0)
    }
  })

  it('mengabaikan harga negatif', () => {
    const config = settings()
    const funds = fundsWith(1_650_500, config)
    const impact = planWishPurchase(-5_000, funds, config, computeBaseAllowance)

    expect(impact.verdict).toBe('aman')
    expect(impact.dailyDrop).toBe(0)
  })
})
