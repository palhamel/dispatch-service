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

const validPayload = {
  channel: 'discord',
  body: 'Hej! Jag undrar om nästa meetup i Malmö.',
  subject: 'Fråga om meetup',
  sender: {
    name: 'Anna Svensson',
    email: 'anna@example.com',
  },
  metadata: {
    source: 'contact-form',
  },
}

describe('POST /api/notify', () => {
  it('returns 200 and messageId on successful Discord delivery', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 204 })

    const res = await request(app)
      .post('/api/notify')
      .set('X-API-Key', TEST_APP_KEY)
      .send(validPayload)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.messageId).toBeDefined()
    expect(res.body.channel).toBe('discord')
    expect(res.body.timestamp).toBeDefined()
  })

  it('returns 401 with missing API key', async () => {
    const res = await request(app)
      .post('/api/notify')
      .send(validPayload)

    expect(res.status).toBe(401)
    expect(res.body.success).toBe(false)
    expect(res.body.error).toBe('UNAUTHORIZED')
  })

  it('returns 401 with invalid API key', async () => {
    const res = await request(app)
      .post('/api/notify')
      .set('X-API-Key', 'dk_fake_invalidkey')
      .send(validPayload)

    expect(res.status).toBe(401)
    expect(res.body.success).toBe(false)
    expect(res.body.error).toBe('UNAUTHORIZED')
  })

  it('returns 400 with missing required fields', async () => {
    const res = await request(app)
      .post('/api/notify')
      .set('X-API-Key', TEST_APP_KEY)
      .send({ channel: 'discord' }) // missing body

    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
    expect(res.body.error).toBe('VALIDATION_ERROR')
  })

  it('returns 400 with channel not configured for app', async () => {
    const res = await request(app)
      .post('/api/notify')
      .set('X-API-Key', TEST_APP_KEY)
      .send({
        channel: 'email',
        body: 'This is a valid body message with enough characters',
      })

    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
    expect(res.body.error).toBe('INVALID_CHANNEL')
  })

  it('returns 403 when spam detected', async () => {
    const res = await request(app)
      .post('/api/notify')
      .set('X-API-Key', TEST_APP_KEY)
      .send({
        channel: 'discord',
        body: 'Buy cheap viagra online now and save money',
      })

    expect(res.status).toBe(403)
    expect(res.body.success).toBe(false)
    expect(res.body.error).toBe('SPAM_DETECTED')
  })

  it('returns 502 when Discord webhook fails', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => 'Rate limited',
    })

    const res = await request(app)
      .post('/api/notify')
      .set('X-API-Key', TEST_APP_KEY)
      .send(validPayload)

    expect(res.status).toBe(502)
    expect(res.body.success).toBe(false)
    expect(res.body.error).toBe('CHANNEL_ERROR')
  })

  it('logs message to database regardless of delivery status', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'Internal error',
    })

    await request(app)
      .post('/api/notify')
      .set('X-API-Key', TEST_APP_KEY)
      .send(validPayload)

    const { messages } = messageStore.getMessages({})
    expect(messages.length).toBe(1)
    expect(messages[0].app).toBe('test-app')
    expect(messages[0].status).toBe('failed')
  })

  it('records sent status on successful delivery', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 204 })

    await request(app)
      .post('/api/notify')
      .set('X-API-Key', TEST_APP_KEY)
      .send(validPayload)

    const { messages } = messageStore.getMessages({})
    expect(messages[0].status).toBe('sent')
    expect(messages[0].sent_at).toBeDefined()
  })

  it('records spam status when spam is detected', async () => {
    await request(app)
      .post('/api/notify')
      .set('X-API-Key', TEST_APP_KEY)
      .send({
        channel: 'discord',
        body: 'Visit our casino gambling website now',
      })

    const { messages } = messageStore.getMessages({})
    expect(messages[0].status).toBe('spam')
  })

  it('sends correct Discord embed with all fields', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 204 })

    await request(app)
      .post('/api/notify')
      .set('X-API-Key', TEST_APP_KEY)
      .send(validPayload)

    expect(mockFetch).toHaveBeenCalledOnce()
    const [url, options] = mockFetch.mock.calls[0]

    expect(url).toBe('https://discord.com/api/webhooks/test/token')
    expect(options.method).toBe('POST')

    const body = JSON.parse(options.body)
    expect(body.embeds[0].title).toBe('Fråga om meetup')
    expect(body.embeds[0].description).toContain('Hej!')
  })

  it('stores sanitized data in database', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 204 })

    await request(app)
      .post('/api/notify')
      .set('X-API-Key', TEST_APP_KEY)
      .send({
        channel: 'discord',
        body: '<b>This is a valid body</b> with enough characters',
        sender: { name: 'Test User', email: '  Test@Example.COM  ' },
      })

    const { messages } = messageStore.getMessages({})
    expect(messages[0].body).not.toContain('<b>')
    expect(messages[0].sender_email).toBe('test@example.com')
  })

  it('handles network error to Discord gracefully', async () => {
    mockFetch.mockRejectedValue(new Error('ECONNREFUSED'))

    const res = await request(app)
      .post('/api/notify')
      .set('X-API-Key', TEST_APP_KEY)
      .send(validPayload)

    expect(res.status).toBe(502)
    expect(res.body.error).toBe('CHANNEL_ERROR')
    expect(res.body.message).toContain('ECONNREFUSED')

    const { messages } = messageStore.getMessages({})
    expect(messages[0].status).toBe('failed')
    expect(messages[0].error).toContain('ECONNREFUSED')
  })

  it('returns 200 and messageId on successful Slack delivery', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200, text: async () => 'ok' })

    const res = await request(app)
      .post('/api/notify')
      .set('X-API-Key', TEST_APP_KEY)
      .send({
        channel: 'slack',
        body: 'Hej! Jag undrar om nästa meetup i Malmö.',
        subject: 'Fråga om meetup',
        sender: { name: 'Anna Svensson', email: 'anna@example.com' },
      })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.messageId).toBeDefined()
    expect(res.body.channel).toBe('slack')
  })

  it('returns 502 when Slack webhook fails', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => 'invalid_token',
    })

    const res = await request(app)
      .post('/api/notify')
      .set('X-API-Key', TEST_APP_KEY)
      .send({
        channel: 'slack',
        body: 'Hej! Jag undrar om nästa meetup i Malmö.',
        subject: 'Fråga om meetup',
      })

    expect(res.status).toBe(502)
    expect(res.body.success).toBe(false)
    expect(res.body.error).toBe('CHANNEL_ERROR')
  })
})

describe('GET /health', () => {
  it('returns 200 without authentication', async () => {
    const res = await request(app).get('/health')

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ok')
    expect(res.body.service).toBe('dispatch')
    expect(res.body.version).toBe('2.1.0')
  })
})

describe('404 handling', () => {
  it('returns 404 for unknown endpoints', async () => {
    const res = await request(app).get('/api/nonexistent')

    expect(res.status).toBe(404)
    expect(res.body.error).toBe('NOT_FOUND')
  })
})
