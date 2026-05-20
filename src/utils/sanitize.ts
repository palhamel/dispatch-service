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

  // Strip HTML tags: keep only characters that are outside < ... > pairs
  let stripped = ''
  let insideTag = false
  for (const ch of str) {
    if (ch === '<') { insideTag = true }
    else if (ch === '>') { insideTag = false }
    else if (!insideTag) { stripped += ch }
  }
  str = stripped

  // Remove javascript: protocol (case insensitive)
  str = str.replace(/javascript\s*:/gi, '')

  // Remove on* event handlers — loop until stable to handle nested patterns like ononclick=...
  let prevOnHandler
  do {
    prevOnHandler = str
    str = str.replace(/\bon\w+\s*=\s*\S*/gi, '')
  } while (prevOnHandler !== str)

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
