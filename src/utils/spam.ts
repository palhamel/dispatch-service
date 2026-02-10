/**
 * Spam detection for Dispatch notification service.
 * Common spam detection patterns for contact form submissions.
 */

import type { SpamCheckResult } from '../types.js'

interface SpamPattern {
  pattern: RegExp
  category: string
  reason: string
}

const SPAM_PATTERNS: SpamPattern[] = [
  // URL markup (BBCode style)
  { pattern: /\[url=/i, category: 'marketing', reason: 'Contains URL markup' },

  // Medical spam
  { pattern: /\b(viagra|cialis|pharmacy)\b/i, category: 'medical', reason: 'Contains prohibited medical content' },

  // Gambling
  { pattern: /\b(casino|gambling|betting|poker)\b/i, category: 'gambling', reason: 'Contains gambling content' },

  // Crypto
  { pattern: /\b(crypto|bitcoin|ethereum|nft)\b/i, category: 'crypto', reason: 'Contains cryptocurrency content' },

  // Dollar amounts
  { pattern: /\$\d+/, category: 'marketing', reason: 'Contains dollar amounts' },

  // Adult content
  { pattern: /\b(porn|xxx)\b/i, category: 'adult', reason: 'Contains adult content' },
  { pattern: /\badult\b/i, category: 'adult', reason: 'Contains adult content' },

  // Marketing spam phrases
  { pattern: /buy now/i, category: 'marketing', reason: 'Contains promotional content' },
  { pattern: /\bdiscount\b/i, category: 'marketing', reason: 'Contains promotional content' },
  { pattern: /free offer/i, category: 'marketing', reason: 'Contains promotional content' },
  { pattern: /limited time/i, category: 'marketing', reason: 'Contains promotional content' },
  { pattern: /best price/i, category: 'marketing', reason: 'Contains promotional content' },

  // Financial spam
  { pattern: /\b(earn|make).{0,20}money\b/i, category: 'financial', reason: 'Contains financial spam' },
  { pattern: /\binvestment\b/i, category: 'financial', reason: 'Contains financial content' },
  { pattern: /\bprofit\b/i, category: 'financial', reason: 'Contains financial content' },
  { pattern: /\bincome\b/i, category: 'financial', reason: 'Contains financial content' },
  { pattern: /\brich\b/i, category: 'financial', reason: 'Contains financial content' },

  // Repetitive characters (5+ identical characters in a row)
  { pattern: /(.)\1{4,}/, category: 'spam', reason: 'Contains repetitive characters' },

  // Non-Latin character blocks (Arabic script 5+ chars)
  { pattern: /[\u0600-\u06FF]{5,}/, category: 'spam', reason: 'Contains blocks of non-Latin characters' },

  // Security threats
  { pattern: /<script/i, category: 'security', reason: 'Contains script injection' },
  { pattern: /javascript:/i, category: 'security', reason: 'Contains javascript protocol' },
  { pattern: /data:/i, category: 'security', reason: 'Contains data protocol' },

  // External contact methods
  { pattern: /\b(whatsapp|telegram|viber)\b/i, category: 'spam', reason: 'Contains external contact methods' },
]

/**
 * Check a message body for spam patterns.
 * Returns { isSpam: false } for clean messages, or { isSpam: true, category, reason } for spam.
 */
export const checkSpam = (input: unknown): SpamCheckResult => {
  if (input === null || input === undefined || input === '') {
    return { isSpam: false }
  }

  const text = typeof input === 'string' ? input : String(input)

  for (const { pattern, category, reason } of SPAM_PATTERNS) {
    if (pattern.test(text)) {
      return { isSpam: true, category, reason }
    }
  }

  return { isSpam: false }
}
