/** Format angka untuk ditampilkan ke pengguna. */

export const formatRupiah = (value: number): string => {
  const safe = Number.isFinite(value) ? Math.trunc(value) : 0
  return `Rp ${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(safe)}`
}

export const formatDays = (days: number): string => `${days} hari`
