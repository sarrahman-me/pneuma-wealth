/** Format angka untuk ditampilkan ke pengguna. */

export const formatRupiah = (value: number): string => {
  const safe = Number.isFinite(value) ? Math.trunc(value) : 0
  return `Rp ${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(safe)}`
}

export const formatDays = (days: number): string => `${days} hari`

/**
 * Format untuk ditulis di dalam field input: berprefiks "Rp" dan
 * bertitik ribuan, tapi kosong saat pengguna belum mengetik apa pun.
 */
export const formatRupiahInput = (raw: string): string => {
  const digits = raw.replace(/[^\d]/g, '').replace(/^0+(?=\d)/, '')
  if (digits.length === 0) return ''
  return `Rp ${new Intl.NumberFormat('id-ID').format(Number(digits))}`
}
