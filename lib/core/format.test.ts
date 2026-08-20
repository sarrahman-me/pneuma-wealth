import { describe, expect, it } from 'vitest'
import { formatRupiahInput } from './format'

describe('formatRupiahInput', () => {
  it('kosong saat belum ada digit', () => {
    expect(formatRupiahInput('')).toBe('')
    expect(formatRupiahInput('Rp ')).toBe('')
  })

  it('menyisipkan titik ribuan', () => {
    expect(formatRupiahInput('1500000')).toBe('Rp 1.500.000')
  })

  it('mengabaikan karakter non-digit yang sudah ada', () => {
    expect(formatRupiahInput('Rp 1.500.0007')).toBe('Rp 15.000.007')
  })

  it('membuang nol di depan', () => {
    expect(formatRupiahInput('00025')).toBe('Rp 25')
    expect(formatRupiahInput('0')).toBe('Rp 0')
  })
})
