export const formatRupiah = (value: number) => {
  const safeValue = Number.isFinite(value) ? value : 0
  const formatted = new Intl.NumberFormat('id-ID', {
    maximumFractionDigits: 0,
  }).format(safeValue)
  return `Rp ${formatted}`
}
