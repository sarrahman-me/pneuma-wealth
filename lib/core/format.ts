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

/**
 * Rupiah diterjemahkan jadi hari hidup. Angka rupiah itu abstrak — "5 hari"
 * jauh lebih terasa saat sedang menimbang satu pembelian.
 */
export const formatDaysOfLife = (
  amount: number,
  dailyLivingCost: number,
): string | null => {
  if (dailyLivingCost <= 0 || amount <= 0) return null
  const days = Math.floor(amount / dailyLivingCost)
  if (days < 1) return 'kurang dari sehari hidup'
  return `${days} hari hidup`
}

/** Kelipatan, mis. "2,3×". Dipakai untuk laju pembakaran. */
export const formatMultiplier = (ratio: number): string =>
  `${new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(ratio)}×`

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
]

/** `YYYY-MM-DD` jadi "5 Agu" — dibaca sebagai teks, bukan sebagai tanggal mesin. */
export const formatShortDate = (date: string): string => {
  const [, month, day] = date.split('-')
  const index = Number(month) - 1
  if (!MONTHS[index]) return date
  return `${Number(day)} ${MONTHS[index]}`
}
