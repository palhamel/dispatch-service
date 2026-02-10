/**
 * Input sanitization utilities for Dispatch notification service.
 * Strips HTML, XSS vectors, and normalizes input for safe storage and forwarding.
 */

/**
 * Sanitize a string by removing HTML tags, XSS vectors, and normalizing whitespace.
 * Preserves Swedish characters (å, ä, ö) and standard punctuation.
 */
export const sanitize = (input: unknown): string => {
  if (input === null || input === undefined) return ''

  let str = typeof input === 'string' ? input : String(input)

  // Strip HTML tags (including nested/malformed)
  // Loop until no more tags remain to handle nested cases like <<script>>
  let previous = ''
  while (previous !== str) {
    previous = str
    str = str.replace(/<[^>]*>/g, '')
  }
  // Clean remaining angle brackets from malformed HTML
  str = str.replace(/</g, '').replace(/>/g, '')

  // Remove javascript: protocol (case insensitive)
  str = str.replace(/javascript\s*:/gi, '')

  // Remove on* event handlers (e.g., onerror=alert(1), onclick=steal())
  str = str.replace(/\bon\w+\s*=\s*[^\s]*/gi, '')

  // Collapse multiple spaces into one (but preserve newlines)
  str = str.replace(/[^\S\n]+/g, ' ')

  // Trim leading/trailing whitespace
  str = str.trim()

  return str
}

/**
 * Sanitize an email address: trim whitespace and lowercase.
 */
export const sanitizeEmail = (input: unknown): string => {
  if (input === null || input === undefined) return ''

  const str = typeof input === 'string' ? input : String(input)
  return str.trim().toLowerCase()
}

/**
 * Truncate a string to a maximum length.
 */
export const truncate = (input: string, maxLength: number): string => {
  if (!input) return ''
  return input.slice(0, maxLength)
}
