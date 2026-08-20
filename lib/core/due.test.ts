import { describe, expect, it } from 'vitest'
import {
  daysUntilDue,
  describeSchedule,
  isoWeekKey,
  nextDue,
  nextMonthlyDue,
  occurrencesWithin,
  periodKeyFor,
  type DueSchedule,
} from './due'
import { todayIn, hourIn } from './timezone'

const schedule = (partial: Partial<DueSchedule>): DueSchedule => ({
  recurrence: 'monthly',
  dueDay: 1,
  dueMonth: 1,
  ...partial,
})

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
    expect(daysUntilDue('2026-08-20', schedule({ dueDay: 25 }))).toBe(5)
  })
})

describe('nextDue per siklus', () => {
  it('harian selalu jatuh tempo hari ini', () => {
    expect(nextDue('2026-08-20', schedule({ recurrence: 'daily' }))).toBe('2026-08-20')
  })

  it('mingguan maju ke hari yang diminta', () => {
    // 2026-08-20 adalah Kamis (hari ke-4).
    expect(nextDue('2026-08-20', schedule({ recurrence: 'weekly', dueDay: 1 }))).toBe(
      '2026-08-24',
    )
    expect(nextDue('2026-08-20', schedule({ recurrence: 'weekly', dueDay: 7 }))).toBe(
      '2026-08-23',
    )
  })

  it('mingguan tepat pada harinya tetap hari ini', () => {
    expect(nextDue('2026-08-20', schedule({ recurrence: 'weekly', dueDay: 4 }))).toBe(
      '2026-08-20',
    )
  })

  it('tahunan memakai tahun ini bila belum lewat', () => {
    expect(
      nextDue('2026-08-20', schedule({ recurrence: 'yearly', dueDay: 5, dueMonth: 11 })),
    ).toBe('2026-11-05')
  })

  it('tahunan pindah ke tahun depan bila sudah lewat', () => {
    expect(
      nextDue('2026-08-20', schedule({ recurrence: 'yearly', dueDay: 5, dueMonth: 3 })),
    ).toBe('2027-03-05')
  })

  it('29 Februari tahunan jatuh di 28 pada tahun biasa', () => {
    expect(
      nextDue('2026-01-10', schedule({ recurrence: 'yearly', dueDay: 29, dueMonth: 2 })),
    ).toBe('2026-02-28')
  })
})

describe('occurrencesWithin', () => {
  it('harian muncul sekali per hari termasuk hari ini', () => {
    const dues = occurrencesWithin('2026-08-20', schedule({ recurrence: 'daily' }), 6)
    expect(dues).toHaveLength(7)
    expect(dues[0]).toBe('2026-08-20')
    expect(dues[6]).toBe('2026-08-26')
  })

  it('mingguan muncul tiap tujuh hari', () => {
    const dues = occurrencesWithin(
      '2026-08-20',
      schedule({ recurrence: 'weekly', dueDay: 1 }),
      30,
    )
    expect(dues).toEqual(['2026-08-24', '2026-08-31', '2026-09-07', '2026-09-14'])
  })

  it('bulanan hanya sekali dalam horizon 30 hari', () => {
    const dues = occurrencesWithin('2026-08-20', schedule({ dueDay: 25 }), 30)
    expect(dues).toEqual(['2026-08-25'])
  })

  it('bulanan bisa dua kali bila jatuh temponya persis hari ini', () => {
    // 20 Agustus dan 20 September berjarak 31 hari, jadi hanya horizon yang
    // lebih panjang dari sebulan yang menangkap keduanya.
    const dues = occurrencesWithin('2026-08-20', schedule({ dueDay: 20 }), 31)
    expect(dues).toEqual(['2026-08-20', '2026-09-20'])
  })

  it('tahunan tidak muncul sama sekali bila masih jauh', () => {
    const dues = occurrencesWithin(
      '2026-08-20',
      schedule({ recurrence: 'yearly', dueDay: 5, dueMonth: 11 }),
      30,
    )
    expect(dues).toEqual([])
  })

  it('bulanan tidak terseret pembulatan bulan pendek', () => {
    // Setelah 28 Februari, kejadian berikutnya kembali ke tanggal 31.
    const dues = occurrencesWithin('2026-02-01', schedule({ dueDay: 31 }), 60)
    expect(dues).toEqual(['2026-02-28', '2026-03-31'])
  })

  it('horizon negatif tidak menghasilkan apa-apa', () => {
    expect(occurrencesWithin('2026-08-20', schedule({ recurrence: 'daily' }), -1)).toEqual([])
  })
})

describe('periodKeyFor', () => {
  it('memberi satu kunci per kejadian', () => {
    expect(periodKeyFor('daily', '2026-08-20')).toBe('2026-08-20')
    expect(periodKeyFor('monthly', '2026-08-20')).toBe('2026-08')
    expect(periodKeyFor('yearly', '2026-08-20')).toBe('2026')
    expect(periodKeyFor('weekly', '2026-08-20')).toBe('2026-W34')
  })

  it('bentuk bulanan tetap sama seperti sebelumnya', () => {
    // Pembayaran lama tersimpan sebagai `YYYY-MM`; kalau ini berubah, tagihan
    // yang sudah lunas akan tampak belum lunas.
    expect(periodKeyFor('monthly', '2026-12-31')).toBe('2026-12')
  })

  it('pekan ISO menyeberang tahun dengan benar', () => {
    // 1 Januari 2027 adalah Jumat, masih pekan ke-53 tahun 2026.
    expect(isoWeekKey('2027-01-01')).toBe('2026-W53')
    expect(isoWeekKey('2027-01-04')).toBe('2027-W01')
  })

  it('semua hari dalam satu pekan berbagi kunci yang sama', () => {
    const keys = ['2026-08-17', '2026-08-20', '2026-08-23'].map(isoWeekKey)
    expect(new Set(keys).size).toBe(1)
  })
})

describe('describeSchedule', () => {
  it('menjelaskan siklus dalam bahasa manusia', () => {
    expect(describeSchedule(schedule({ recurrence: 'daily' }))).toBe('Setiap hari')
    expect(describeSchedule(schedule({ recurrence: 'weekly', dueDay: 1 }))).toBe('Setiap Senin')
    expect(describeSchedule(schedule({ dueDay: 25 }))).toBe('Tanggal 25 tiap bulan')
    expect(
      describeSchedule(schedule({ recurrence: 'yearly', dueDay: 5, dueMonth: 11 })),
    ).toBe('Tiap 5 November')
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
