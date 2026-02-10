import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import request from 'supertest'
import { createDatabase } from '../../src/db/index.js'
import { createApp } from '../../src/app.js'
import type { AppsConfig } from '../../src/types.js'
import type Database from 'better-sqlite3'

const mockFetch = vi.fn()
global.fetch = mockFetch

const TEST_ADMIN_KEY = 'dk_admin_testkey123'
const TEST_APP_KEY = 'dk_test_abc123secret'

const testAppsConfig: AppsConfig = {
  'test-app': {
    name: 'Test Application',
    apiKey: TEST_APP_KEY,
    channels: {
      discord: {
        webhookUrl: 'https://discord.com/api/webhooks/test/token',
        defaultEmbed: {
          color: 5814783,
          footer: 'Via Test App',
        },
      },
      slack: {
        webhookUrl: 'https://hooks.slack.com/services/T00/B00/test',
        defaultFormat: {
          color: '#36a64f',
          footer: 'Via Test App',
        },
      },
    },
  },
}

let db: Database.Database
let app: ReturnType<typeof createApp>['app']
let messageStore: ReturnType<typeof createApp>['messageStore']

beforeEach(() => {
  mockFetch.mockReset()
  db = createDatabase(':memory:')
  const result = createApp({
    db,
    appsConfig: testAppsConfig,
    adminApiKey: TEST_ADMIN_KEY,
    nodeEnv: 'test',
  })
  app = result.app
  messageStore = result.messageStore
})

afterEach(() => {
  db.close()
})

// Helper: seed messages into the database
const seedMessages = () => {
  messageStore.logMessage({ app: 'test-app', channel: 'discord', body: 'Message 1' })
  messageStore.logMessage({ app: 'test-app', channel: 'discord', body: 'Message 2' })
  messageStore.logMessage({ app: 'test-app', channel: 'discord', body: 'Message 3' })
  // Update statuses
  messageStore.updateStatus(1, 'sent')
  messageStore.updateStatus(2, 'failed', undefined, 'Webhook error')
  messageStore.updateStatus(3, 'spam', undefined, 'Medical spam')
}

// ─── GET /api/logs ───

describe('GET /api/logs', () => {
  it('returns 401 with app key (requires admin key)', async () => {
    const res = await request(app)
      .get('/api/logs')
      .set('X-API-Key', TEST_APP_KEY)

    expect(res.status).toBe(403)
    expect(res.body.success).toBe(false)
  })

  it('returns 401 without any key', async () => {
    const res = await request(app).get('/api/logs')

    expect(res.status).toBe(401)
    expect(res.body.error).toBe('UNAUTHORIZED')
  })

  it('returns paginated message list with admin key', async () => {
    seedMessages()

    const res = await request(app)
      .get('/api/logs')
      .set('X-API-Key', TEST_ADMIN_KEY)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.total).toBe(3)
    expect(res.body.messages).toHaveLength(3)
    expect(res.body.limit).toBeDefined()
    expect(res.body.offset).toBeDefined()
  })

  it('filters by app parameter', async () => {
    seedMessages()
    // Add a message from a different app directly
    messageStore.logMessage({ app: 'other-app', channel: 'discord', body: 'Other message' })

    const res = await request(app)
      .get('/api/logs?app=test-app')
      .set('X-API-Key', TEST_ADMIN_KEY)

    expect(res.status).toBe(200)
    expect(res.body.total).toBe(3)
    expect(res.body.messages.every((m: any) => m.app === 'test-app')).toBe(true)
  })

  it('filters by status parameter', async () => {
    seedMessages()

    const res = await request(app)
      .get('/api/logs?status=sent')
      .set('X-API-Key', TEST_ADMIN_KEY)

    expect(res.status).toBe(200)
    expect(res.body.total).toBe(1)
    expect(res.body.messages[0].status).toBe('sent')
  })

  it('respects limit and offset parameters', async () => {
    seedMessages()

    const res = await request(app)
      .get('/api/logs?limit=2&offset=1')
      .set('X-API-Key', TEST_ADMIN_KEY)

    expect(res.status).toBe(200)
    expect(res.body.total).toBe(3) // total count unaffected
    expect(res.body.messages).toHaveLength(2)
    expect(res.body.limit).toBe(2)
    expect(res.body.offset).toBe(1)
  })

  it('returns empty list when no messages', async () => {
    const res = await request(app)
      .get('/api/logs')
      .set('X-API-Key', TEST_ADMIN_KEY)

    expect(res.status).toBe(200)
    expect(res.body.total).toBe(0)
    expect(res.body.messages).toHaveLength(0)
  })
})

// ─── GET /api/status ───

describe('GET /api/status', () => {
  it('returns 401 with app key (requires admin key)', async () => {
    const res = await request(app)
      .get('/api/status')
      .set('X-API-Key', TEST_APP_KEY)

    expect(res.status).toBe(403)
    expect(res.body.success).toBe(false)
  })

  it('returns service info and per-app statistics', async () => {
    seedMessages()

    const res = await request(app)
      .get('/api/status')
      .set('X-API-Key', TEST_ADMIN_KEY)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.service).toBe('dispatch')
    expect(res.body.version).toBe('2.0.0')
    expect(res.body.uptime).toBeDefined()
    expect(res.body.database.totalMessages).toBe(3)
  })

  it('includes correct message counts per app', async () => {
    seedMessages()

    const res = await request(app)
      .get('/api/status')
      .set('X-API-Key', TEST_ADMIN_KEY)

    const appStats = res.body.database.apps['test-app']
    expect(appStats).toBeDefined()
    expect(appStats.totalMessages).toBe(3)
    expect(appStats.sent).toBe(1)
    expect(appStats.failed).toBe(1)
    expect(appStats.spam).toBe(1)
  })

  it('returns empty stats when no messages', async () => {
    const res = await request(app)
      .get('/api/status')
      .set('X-API-Key', TEST_ADMIN_KEY)

    expect(res.status).toBe(200)
    expect(res.body.database.totalMessages).toBe(0)
  })
})

// ─── POST /api/test/:channel ───

describe('POST /api/test/:channel', () => {
  it('returns 401 with app key (requires admin key)', async () => {
    const res = await request(app)
      .post('/api/test/discord')
      .set('X-API-Key', TEST_APP_KEY)
      .send({ app: 'test-app' })

    expect(res.status).toBe(403)
    expect(res.body.success).toBe(false)
  })

  it('sends test message to configured Discord webhook', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 204 })

    const res = await request(app)
      .post('/api/test/discord')
      .set('X-API-Key', TEST_ADMIN_KEY)
      .send({ app: 'test-app' })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.message).toContain('test-app')
    expect(res.body.message).toContain('discord')
    expect(mockFetch).toHaveBeenCalledOnce()
  })

  it('returns error for unknown app', async () => {
    const res = await request(app)
      .post('/api/test/discord')
      .set('X-API-Key', TEST_ADMIN_KEY)
      .send({ app: 'nonexistent-app' })

    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
  })

  it('returns error for unconfigured channel', async () => {
    const res = await request(app)
      .post('/api/test/email')
      .set('X-API-Key', TEST_ADMIN_KEY)
      .send({ app: 'test-app' })

    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
  })

  it('returns error when Discord webhook fails', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'Server error',
    })

    const res = await request(app)
      .post('/api/test/discord')
      .set('X-API-Key', TEST_ADMIN_KEY)
      .send({ app: 'test-app' })

    expect(res.status).toBe(502)
    expect(res.body.success).toBe(false)
  })

  it('requires app field in body', async () => {
    const res = await request(app)
      .post('/api/test/discord')
      .set('X-API-Key', TEST_ADMIN_KEY)
      .send({})

    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
  })

  it('sends test message to configured Slack webhook', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200, text: async () => 'ok' })

    const res = await request(app)
      .post('/api/test/slack')
      .set('X-API-Key', TEST_ADMIN_KEY)
      .send({ app: 'test-app' })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.message).toContain('test-app')
    expect(res.body.message).toContain('slack')
    expect(mockFetch).toHaveBeenCalledOnce()
  })
})
