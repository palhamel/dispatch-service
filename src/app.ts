/**
 * Dispatch - Express app factory.
 * Creates and configures the Express application with all middleware and routes.
 * Separated from server.ts so tests can use supertest without starting a listener.
 */

import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import type Database from 'better-sqlite3'
import type { AppsConfig } from './types.js'
import { createAuthMiddleware } from './middleware/authenticate.js'
import { createValidateMiddleware } from './middleware/validate.js'
import { createMessageStore } from './db/messages.js'
import { checkSpam } from './utils/spam.js'
import { sendDiscord } from './channels/discord.js'

interface AppOptions {
  db: Database.Database
  appsConfig: AppsConfig
  adminApiKey: string
  allowedOrigins?: string[]
  nodeEnv?: string
}

export const createApp = (options: AppOptions) => {
  const { db, appsConfig, adminApiKey, allowedOrigins, nodeEnv } = options

  const app = express()
  const messageStore = createMessageStore(db)
  const authenticate = createAuthMiddleware(appsConfig, adminApiKey)
  const validate = createValidateMiddleware()

  // Security headers
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", 'https://discord.com', 'https://discordapp.com'],
      },
    },
  }))

  // CORS
  const origins = allowedOrigins ?? ['http://localhost:5173', 'https://kodfika.se']
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

  // --- 404 handler ---
  app.use('*', (_req, res) => {
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
