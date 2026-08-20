import { describe, expect, it } from 'vitest'
import { coolingDaysFor, pendingTotal, readyDateFor, viewWish, type WishItem } from './wish'

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
      { id: 'a', name: 'a', amount: 100_000, createdOn: '2026-08-01', readyOn: '2026-08-02', status: 'waiting' },
      { id: 'b', name: 'b', amount: 200_000, createdOn: '2026-08-01', readyOn: '2026-08-02', status: 'released' },
      { id: 'c', name: 'c', amount: 300_000, createdOn: '2026-08-01', readyOn: '2026-08-02', status: 'bought' },
    ]
    expect(pendingTotal(items)).toBe(100_000)
  })
})
