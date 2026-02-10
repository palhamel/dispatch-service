import type { Request, Response, NextFunction } from 'express'
import type { AppsConfig, AppConfig } from '../types.js'
import { buildKeyIndex } from '../config/loader.js'

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

    // Check admin key first
    if (apiKey === adminApiKey) {
      ;(req as any).isAdmin = true
      next()
      return
    }

    // Look up app by API key
    const appEntry = keyIndex.get(apiKey)

    if (!appEntry) {
      res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Invalid API key.',
        timestamp: new Date().toISOString(),
      })
      return
    }

    ;(req as any).appName = appEntry.appName
    ;(req as any).appConfig = appEntry.appConfig
    ;(req as any).isAdmin = false
    next()
  }
}
