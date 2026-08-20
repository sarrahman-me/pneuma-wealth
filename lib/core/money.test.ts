import { describe, expect, it } from 'vitest'
import { addDays, daysBetween, floorToThousand } from './money'

describe('floorToThousand', () => {
  it('membulatkan ke bawah', () => {
    expect(floorToThousand(123_999)).toBe(123_000)
  })

  it('nol untuk nilai non-positif', () => {
    expect(floorToThousand(0)).toBe(0)
    expect(floorToThousand(-5_000)).toBe(0)
  })
})

describe('tanggal', () => {
  it('menghitung selisih hari', () => {
    expect(daysBetween('2026-08-01', '2026-08-08')).toBe(7)
    expect(daysBetween('2026-08-08', '2026-08-01')).toBe(-7)
  })

  it('melewati batas bulan', () => {
    expect(addDays('2026-08-30', 3)).toBe('2026-09-02')
  })

  it('menolak format tidak valid', () => {
    expect(() => daysBetween('20-08-2026', '2026-08-01')).toThrow()
  })
})
