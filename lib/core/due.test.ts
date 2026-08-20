import { describe, expect, it } from 'vitest'
import { daysUntilDue, nextMonthlyDue } from './due'
import { todayIn, hourIn } from './timezone'

describe('nextMonthlyDue', () => {
  it('memakai bulan ini bila belum lewat', () => {
    expect(nextMonthlyDue('2026-08-10', 25)).toBe('2026-08-25')
  })

  it('tepat pada hari jatuh tempo tetap hari ini', () => {
    expect(nextMonthlyDue('2026-08-25', 25)).toBe('2026-08-25')
  })

  it('pindah ke bulan depan bila sudah lewat', () => {
    expect(nextMonthlyDue('2026-08-26', 25)).toBe('2026-09-25')
  })

  it('menyeberang tahun', () => {
    expect(nextMonthlyDue('2026-12-30', 5)).toBe('2027-01-05')
  })

  it('tanggal 31 jatuh di hari terakhir bulan pendek', () => {
    expect(nextMonthlyDue('2026-02-15', 31)).toBe('2026-02-28')
  })

  it('menghitung sisa hari', () => {
    expect(daysUntilDue('2026-08-20', 25)).toBe(5)
  })
})

describe('zona waktu', () => {
  it('memakai zona waktu pengguna, bukan server', () => {
    // 2026-08-20T18:30Z masih 20 Agustus di UTC, tapi sudah 21 di Jakarta.
    const instant = new Date('2026-08-20T18:30:00Z')
    expect(todayIn('UTC', instant)).toBe('2026-08-20')
    expect(todayIn('Asia/Jakarta', instant)).toBe('2026-08-21')
  })

  it('membaca jam lokal pengguna', () => {
    const instant = new Date('2026-08-20T18:30:00Z')
    expect(hourIn('Asia/Jakarta', instant)).toBe(1)
  })
})
