/**
 * Format a phone number string as (XXX)XXX-XXXX
 * Strips non-digits and applies formatting progressively as user types.
 * @param {string} value - Raw phone input
 * @returns {string} Formatted phone string
 */
export function formatPhoneNumber(value) {
  if (!value) return ''
  const digits = value.replace(/\D/g, '').slice(0, 10)
  if (digits.length <= 3) return `(${digits}`
  if (digits.length <= 6) return `(${digits.slice(0, 3)})${digits.slice(3)}`
  return `(${digits.slice(0, 3)})${digits.slice(3, 6)}-${digits.slice(6)}`
}

/**
 * Format a stored phone number for display.
 * If already formatted or contains non-digit chars, returns as-is.
 * @param {string} value - Phone number to display
 * @returns {string} Formatted phone string
 */
export function displayPhone(value) {
  if (!value) return ''
  const digits = value.replace(/\D/g, '')
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)})${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  return value
}
