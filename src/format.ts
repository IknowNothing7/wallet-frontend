// The backend stores amounts as integers in the currency's minor unit (cents for USD, none for JPY).

function fractionDigits(currency: string): number {
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2
  } catch {
    return 2
  }
}

export function formatMoney(minorUnits: number, currency: string): string {
  const major = minorUnits / 10 ** fractionDigits(currency)
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(major)
  } catch {
    return `${major.toFixed(2)} ${currency}`
  }
}

/** Parses a user-entered amount like "12.50" into minor units; null if it isn't a valid positive amount. */
export function toMinorUnits(input: string, currency: string): number | null {
  const digits = fractionDigits(currency)
  const normalized = input.trim().replace(',', '.')
  const pattern = digits > 0 ? new RegExp(`^\\d+(\\.\\d{1,${digits}})?$`) : /^\d+$/
  if (!pattern.test(normalized)) return null
  const [whole, fraction = ''] = normalized.split('.')
  const minor = Number(whole) * 10 ** digits + Number(fraction.padEnd(digits, '0') || 0)
  return minor > 0 && Number.isSafeInteger(minor) ? minor : null
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}
