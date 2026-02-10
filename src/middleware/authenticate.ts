import { timingSafeEqual } from 'node:crypto'
import type { Request, Response, NextFunction } from 'express'
import type { AppsConfig, AppConfig } from '../types.js'
import { buildKeyIndex } from '../config/loader.js'

/**
 * Timing-safe string comparison to prevent timing attacks on API key validation.
 * Pads shorter string to match length before comparing, ensuring constant-time execution.
 */
const safeCompare = (a: string, b: string): boolean => {
  const maxLen = Math.max(a.length, b.length)
  const bufA = Buffer.alloc(maxLen, 0)
  const bufB = Buffer.alloc(maxLen, 0)
  bufA.write(a)
  bufB.write(b)
  return timingSafeEqual(bufA, bufB) && a.length === b.length
}

export const createAuthMiddleware = (appsConfig: AppsConfig, adminApiKey: string) => {
  const keyIndex = buildKeyIndex(appsConfig)

  return (req: Request, res: Response, next: NextFunction): void => {
    // Only accept API key from header - never from query params (security: prevents key leaking in logs/URLs)
    const apiKey = req.get('x-api-key')

    if (!apiKey) {
      res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Missing API key. Provide X-API-Key header.',
        timestamp: new Date().toISOString(),
      })
      return
    }

    // Check admin key first (timing-safe)
    if (safeCompare(apiKey, adminApiKey)) {
      ;(req as any).isAdmin = true
      next()
      return
    }

    // Look up app by API key (timing-safe comparison for each key)
    let matchedEntry: { appName: string; appConfig: AppConfig } | undefined
    for (const [key, entry] of keyIndex) {
      if (safeCompare(apiKey, key)) {
        matchedEntry = entry
        break
      }
    }

    if (!matchedEntry) {
      res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Invalid API key.',
        timestamp: new Date().toISOString(),
      })
      return
    }

    ;(req as any).appName = matchedEntry.appName
    ;(req as any).appConfig = matchedEntry.appConfig
    ;(req as any).isAdmin = false
    next()
  }
}
