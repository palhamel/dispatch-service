import type { Request, Response, NextFunction } from 'express'
import { sanitize, sanitizeEmail } from '../utils/sanitize.js'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const validationError = (res: Response, message: string) => {
  res.status(400).json({
    success: false,
    error: 'VALIDATION_ERROR',
    message,
    timestamp: new Date().toISOString(),
  })
}

export const createValidateMiddleware = () => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { channel, body, subject, sender } = req.body

    // Required: channel
    if (!channel || typeof channel !== 'string') {
      validationError(res, "Field 'channel' is required")
      return
    }

    // Required: body
    if (!body || typeof body !== 'string') {
      validationError(res, "Field 'body' is required and must be 10-2000 characters")
      return
    }

    // Sanitize body and subject
    const sanitizedBody = sanitize(body)
    const sanitizedSubject = subject ? sanitize(subject) : undefined

    // Body length (after sanitization)
    if (sanitizedBody.length < 10) {
      validationError(res, "Field 'body' is required and must be 10-2000 characters")
      return
    }

    if (sanitizedBody.length > 2000) {
      validationError(res, "Field 'body' must not exceed 2000 characters")
      return
    }

    // Subject length (after sanitization)
    if (sanitizedSubject && sanitizedSubject.length > 200) {
      validationError(res, "Field 'subject' must not exceed 200 characters")
      return
    }

    // Validate sender fields if provided
    if (sender) {
      if (sender.name !== undefined) {
        const sanitizedName = sanitize(sender.name)
        if (sanitizedName.length < 2) {
          validationError(res, "Field 'sender.name' must be 2-100 characters")
          return
        }
        if (sanitizedName.length > 100) {
          validationError(res, "Field 'sender.name' must be 2-100 characters")
          return
        }
        req.body.sender.name = sanitizedName
      }

      if (sender.email !== undefined) {
        const sanitizedEmailVal = sanitizeEmail(sender.email)
        if (!EMAIL_REGEX.test(sanitizedEmailVal)) {
          validationError(res, "Field 'sender.email' must be a valid email address")
          return
        }
        req.body.sender.email = sanitizedEmailVal
      }
    }

    // Check that channel is configured for this app
    const appConfig = (req as any).appConfig
    if (appConfig && appConfig.channels) {
      if (!appConfig.channels[channel]) {
        res.status(400).json({
          success: false,
          error: 'INVALID_CHANNEL',
          message: `Channel '${sanitize(channel)}' is not configured for this app`,
          timestamp: new Date().toISOString(),
        })
        return
      }
    }

    // Update request body with sanitized values
    req.body.body = sanitizedBody
    if (sanitizedSubject !== undefined) {
      req.body.subject = sanitizedSubject
    }

    next()
  }
}
