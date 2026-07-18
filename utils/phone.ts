/**
 * Normalizes a raw phone number input into standard international E.164 format for Nigeria (+234XXXXXXXXXX).
 * Returns the normalized phone number, or the original if it cannot be normalized.
 */
export function normalizePhoneNumber(rawPhone: string): string {
  let cleaned = rawPhone.trim().replace(/[\s\-()]/g, '')

  // Handle +234 prefix
  if (cleaned.startsWith('+234')) {
    // Keep it as is
    return cleaned
  }

  // Handle 234 prefix without +
  if (cleaned.startsWith('234')) {
    return `+${cleaned}`
  }

  // Handle leading zero (070... -> +23470...)
  if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1)
  }

  // If we have a 10-digit subscriber number, prepend +234
  if (cleaned.length === 10 && /^\d+$/.test(cleaned)) {
    return `+234${cleaned}`
  }

  // Fallback: if it's already a full international number or other format, prepend + if it looks like one, or return cleaned
  if (cleaned.startsWith('+')) {
    return cleaned
  }
  
  return `+${cleaned}`
}
