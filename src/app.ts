/**
 * Dispatch - Express app factory.
 * Creates and configures the Express application with all middleware and routes.
 * Separated from server.ts so tests can use supertest without starting a listener.
 */

import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import rateLimit from 'express-rate-limit'
import type Database from 'better-sqlite3'
import type { AppsConfig } from './types.js'
import { createAuthMiddleware } from './middleware/authenticate.js'
import { createValidateMiddleware } from './middleware/validate.js'
import { createMessageStore } from './db/messages.js'
import { checkSpam } from './utils/spam.js'
import { sendDiscord } from './channels/discord.js'
import { sendSlack } from './channels/slack.js'

interface AppOptions {
  db: Database.Database
  appsConfig: AppsConfig
  adminApiKey: string
  allowedOrigins?: string[]
  nodeEnv?: string
  rateLimitWindowMs?: number
  rateLimitMaxRequests?: number
}

export const createApp = (options: AppOptions) => {
  const { db, appsConfig, adminApiKey, allowedOrigins, nodeEnv, rateLimitWindowMs, rateLimitMaxRequests } = options

  const app = express()
  const messageStore = createMessageStore(db)
  const authenticate = createAuthMiddleware(appsConfig, adminApiKey)
  const validate = createValidateMiddleware()

  // Security headers
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'none'"],
        styleSrc: ["'none'"],
        imgSrc: ["'none'"],
        connectSrc: ["'self'"],
      },
    },
  }))

  // CORS
  const origins = allowedOrigins ?? ['http://localhost:5173']
  app.use(cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true)
      const isAllowed = origins.some(allowed => {
        if (allowed.includes('*')) {
          const regex = new RegExp(`^${allowed.replace('*', '.*')}$`)
          return regex.test(origin)
        }
        return allowed === origin
      })
      if (isAllowed) {
        callback(null, true)
      } else {
        callback(new Error('Not allowed by CORS'))
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  }))

  // Logging (skip in test)
  if (nodeEnv !== 'test') {
    app.use(morgan(nodeEnv === 'production' ? 'combined' : 'dev'))
  }

  // Body parsing
  app.use(express.json({ limit: '1mb' }))

  // Rate limiting (skip in test to avoid flaky tests)
  if (nodeEnv !== 'test') {
    // Global rate limit
    app.use(rateLimit({
      windowMs: rateLimitWindowMs ?? 900000, // 15 minutes
      max: rateLimitMaxRequests ?? 100,
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        success: false,
        error: 'RATE_LIMITED',
        message: 'Too many requests, please try again later',
        timestamp: new Date().toISOString(),
      },
    }))

    // Stricter rate limit on notify endpoint
    app.use('/api/notify', rateLimit({
      windowMs: 60000, // 1 minute
      max: 20,
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        success: false,
        error: 'RATE_LIMITED',
        message: 'Too many notification requests, please try again later',
        timestamp: new Date().toISOString(),
      },
    }))
  }

  // --- Health check (no auth) ---
  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'dispatch',
      version: '2.0.0',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    })
  })

  // --- POST /api/notify ---
  app.post('/api/notify', authenticate, validate, async (req, res) => {
    const appName = (req as any).appName as string
    const appConfig = (req as any).appConfig

    const { channel, body, subject, sender, metadata } = req.body

    // Spam check
    const spamResult = checkSpam(body)
    if (spamResult.isSpam) {
      // Log as spam before rejecting
      const messageId = messageStore.logMessage({
        app: appName,
        channel,
        body,
        sender_name: sender?.name,
        sender_email: sender?.email,
        subject,
        metadata: metadata ? JSON.stringify(metadata) : undefined,
        ip_address: req.ip,
      })
      messageStore.updateStatus(messageId, 'spam', undefined, spamResult.reason)

      res.status(403).json({
        success: false,
        error: 'SPAM_DETECTED',
        message: 'Message flagged as spam',
        timestamp: new Date().toISOString(),
      })
      return
    }

    // Log message (status: pending)
    const messageId = messageStore.logMessage({
      app: appName,
      channel,
      body,
      sender_name: sender?.name,
      sender_email: sender?.email,
      subject,
      metadata: metadata ? JSON.stringify(metadata) : undefined,
      ip_address: req.ip,
    })

    // Route to channel adapter
    let channelResult
    if (channel === 'discord') {
      channelResult = await sendDiscord(appConfig.channels.discord, req.body, appName)
    } else if (channel === 'slack') {
      channelResult = await sendSlack(appConfig.channels.slack, req.body, appName)
    } else {
      // Should not reach here (validate middleware checks channel existence)
      messageStore.updateStatus(messageId, 'failed', undefined, `Unsupported channel: ${channel}`)
      res.status(400).json({
        success: false,
        error: 'INVALID_CHANNEL',
        message: `Channel '${channel}' is not supported`,
        timestamp: new Date().toISOString(),
      })
      return
    }

    // Update status based on channel result
    if (channelResult.success) {
      messageStore.updateStatus(messageId, 'sent', channelResult.response)
      res.json({
        success: true,
        messageId,
        channel,
        timestamp: new Date().toISOString(),
      })
    } else {
      messageStore.updateStatus(messageId, 'failed', undefined, channelResult.error)
      res.status(502).json({
        success: false,
        error: 'CHANNEL_ERROR',
        message: channelResult.error ?? 'Channel delivery failed',
        timestamp: new Date().toISOString(),
      })
    }
  })

  // --- Admin guard middleware ---
  const requireAdmin = (req: express.Request, res: express.Response, next: express.NextFunction): void => {
    if (!(req as any).isAdmin) {
      res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: 'Admin access required',
        timestamp: new Date().toISOString(),
      })
      return
    }
    next()
  }

  // --- GET /api/logs (admin only) ---
  app.get('/api/logs', authenticate, requireAdmin, (req, res) => {
    const app_filter = req.query.app as string | undefined
    const status = req.query.status as string | undefined
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined
    const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : undefined

    const result = messageStore.getMessages({ app: app_filter, status, limit, offset })

    res.json({
      success: true,
      total: result.total,
      limit: limit ?? 50,
      offset: offset ?? 0,
      messages: result.messages,
    })
  })

  // --- GET /api/status (admin only) ---
  app.get('/api/status', authenticate, requireAdmin, (_req, res) => {
    const stats = messageStore.getStats()

    res.json({
      success: true,
      service: 'dispatch',
      version: '2.0.0',
      uptime: process.uptime(),
      database: {
        totalMessages: stats.totalMessages,
        apps: stats.apps,
      },
      timestamp: new Date().toISOString(),
    })
  })

  // --- POST /api/test/:channel (admin only) ---
  app.post('/api/test/:channel', authenticate, requireAdmin, async (req, res) => {
    const channel = req.params.channel as string
    const targetApp = req.body.app as string | undefined

    if (!targetApp) {
      res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: "Field 'app' is required",
        timestamp: new Date().toISOString(),
      })
      return
    }

    const targetAppConfig = appsConfig[targetApp]
    if (!targetAppConfig || targetApp.startsWith('_')) {
      res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: `App '${targetApp}' not found`,
        timestamp: new Date().toISOString(),
      })
      return
    }

    const channelConfig = targetAppConfig.channels[channel as keyof typeof targetAppConfig.channels]
    if (!channelConfig) {
      res.status(400).json({
        success: false,
        error: 'INVALID_CHANNEL',
        message: `Channel '${channel}' is not configured for app '${targetApp}'`,
        timestamp: new Date().toISOString(),
      })
      return
    }

    const testPayload = {
      channel,
      subject: `Test message from Dispatch`,
      body: `This is a test message sent to ${channel} for app ${targetApp}. If you see this, the channel is working correctly.`,
    }

    let result
    if (channel === 'discord') {
      result = await sendDiscord(channelConfig as any, testPayload, targetApp)
    } else if (channel === 'slack') {
      result = await sendSlack(channelConfig as any, testPayload, targetApp)
    } else {
      res.status(400).json({
        success: false,
        error: 'INVALID_CHANNEL',
        message: `Channel '${channel}' is not supported`,
        timestamp: new Date().toISOString(),
      })
      return
    }

    if (result.success) {
      res.json({
        success: true,
        message: `Test message sent to ${channel} for app ${targetApp}`,
        timestamp: new Date().toISOString(),
      })
    } else {
      res.status(502).json({
        success: false,
        error: 'CHANNEL_ERROR',
        message: result.error ?? 'Test delivery failed',
        timestamp: new Date().toISOString(),
      })
    }
  })

  // --- 404 handler ---
  app.use((_req, res) => {
    res.status(404).json({
      success: false,
      error: 'NOT_FOUND',
      message: 'Endpoint not found',
      timestamp: new Date().toISOString(),
    })
  })

  // --- Global error handler ---
  app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (nodeEnv !== 'production') {
      console.error('Unhandled error:', error)
    }
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: nodeEnv === 'production' ? 'Internal server error' : error.message,
      timestamp: new Date().toISOString(),
    })
  })

  return { app, messageStore }
}
