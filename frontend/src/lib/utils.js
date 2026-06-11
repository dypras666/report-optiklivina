/**
 * Utility untuk menggabungkan className (clsx alternative)
 */
export function cn(...classes) {
  return classes.filter(Boolean).join(' ')
}

/**
 * Format currency ke format Rupiah Indonesia
 */
export function formatCurrency(amount) {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount

  if (isNaN(num)) return 'Rp 0'

  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num)
}

/**
 * Format angka dengan pemisah ribuan
 */
export function formatNumber(num) {
  const number = typeof num === 'string' ? parseFloat(num) : num

  if (isNaN(number)) return '0'

  return new Intl.NumberFormat('id-ID').format(number)
}

/**
 * Parse string currency ke number
 */
export function parseCurrency(str) {
  if (!str) return 0

  // Remove Rp, spaces, and dots (thousand separators)
  const cleaned = str.toString()
    .replace(/[Rp\s\.]/g, '')
    .replace(',', '.') // Replace comma with dot for decimal

  const parsed = parseFloat(cleaned)
  return isNaN(parsed) ? 0 : parsed
}

/**
 * Format timestamp ke Date String lokal
 */
export function formatDate(s) {
  if (!s) return ''
  try {
    return new Date(s).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return String(s)
  }
}