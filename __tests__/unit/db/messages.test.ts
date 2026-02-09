import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createDatabase } from '../../../src/db/index.js'
import { createMessageStore } from '../../../src/db/messages.js'
import type Database from 'better-sqlite3'

describe('MessageStore', () => {
  let db: Database.Database
  let store: ReturnType<typeof createMessageStore>

  beforeEach(() => {
    db = createDatabase(':memory:')
    store = createMessageStore(db)
  })

  afterEach(() => {
    db.close()
  })

  describe('logMessage', () => {
    it('inserts a message with pending status', () => {
      const id = store.logMessage({
        app: 'kodfika',
        channel: 'discord',
        body: 'Hello world',
      })

      expect(id).toBeGreaterThan(0)

      const msg = db.prepare('SELECT * FROM messages WHERE id = ?').get(id) as Record<string, unknown>
      expect(msg.app).toBe('kodfika')
      expect(msg.channel).toBe('discord')
      expect(msg.body).toBe('Hello world')
      expect(msg.status).toBe('pending')
    })

    it('stores sender information', () => {
      const id = store.logMessage({
        app: 'kodfika',
        channel: 'discord',
        body: 'Test message',
        sender_name: 'Anna Svensson',
        sender_email: 'anna@example.com',
      })

      const msg = db.prepare('SELECT * FROM messages WHERE id = ?').get(id) as Record<string, unknown>
      expect(msg.sender_name).toBe('Anna Svensson')
      expect(msg.sender_email).toBe('anna@example.com')
    })

    it('stores subject and metadata', () => {
      const metadata = JSON.stringify({ source: 'contact-form' })
      const id = store.logMessage({
        app: 'kodfika',
        channel: 'discord',
        body: 'Test message',
        subject: 'Fraga om event',
        metadata,
      })

      const msg = db.prepare('SELECT * FROM messages WHERE id = ?').get(id) as Record<string, unknown>
      expect(msg.subject).toBe('Fraga om event')
      expect(msg.metadata).toBe(metadata)
    })

    it('stores IP address', () => {
      const id = store.logMessage({
        app: 'kodfika',
        channel: 'discord',
        body: 'Test message',
        ip_address: '192.168.1.1',
      })

      const msg = db.prepare('SELECT * FROM messages WHERE id = ?').get(id) as Record<string, unknown>
      expect(msg.ip_address).toBe('192.168.1.1')
    })

    it('sets created_at automatically', () => {
      const id = store.logMessage({
        app: 'kodfika',
        channel: 'discord',
        body: 'Test message',
      })

      const msg = db.prepare('SELECT * FROM messages WHERE id = ?').get(id) as Record<string, unknown>
      expect(msg.created_at).toBeDefined()
      expect(typeof msg.created_at).toBe('string')
    })
  })

  describe('updateStatus', () => {
    it('updates status to sent with response', () => {
      const id = store.logMessage({
        app: 'kodfika',
        channel: 'discord',
        body: 'Test message',
      })

      store.updateStatus(id, 'sent', { status: 204 })

      const msg = db.prepare('SELECT * FROM messages WHERE id = ?').get(id) as Record<string, unknown>
      expect(msg.status).toBe('sent')
      expect(msg.sent_at).toBeDefined()
      expect(msg.discord_response).toBe(JSON.stringify({ status: 204 }))
      expect(msg.error).toBeNull()
    })

    it('updates status to failed with error', () => {
      const id = store.logMessage({
        app: 'kodfika',
        channel: 'discord',
        body: 'Test message',
      })

      store.updateStatus(id, 'failed', undefined, 'Discord API returned 429')

      const msg = db.prepare('SELECT * FROM messages WHERE id = ?').get(id) as Record<string, unknown>
      expect(msg.status).toBe('failed')
      expect(msg.error).toBe('Discord API returned 429')
      expect(msg.sent_at).toBeNull()
    })

    it('updates status to spam', () => {
      const id = store.logMessage({
        app: 'kodfika',
        channel: 'discord',
        body: 'Buy cheap viagra now',
      })

      store.updateStatus(id, 'spam', undefined, 'medical spam detected')

      const msg = db.prepare('SELECT * FROM messages WHERE id = ?').get(id) as Record<string, unknown>
      expect(msg.status).toBe('spam')
      expect(msg.error).toBe('medical spam detected')
    })
  })

  describe('getMessages', () => {
    beforeEach(() => {
      // Insert test data
      store.logMessage({ app: 'kodfika', channel: 'discord', body: 'Message 1' })
      store.logMessage({ app: 'kodfika', channel: 'discord', body: 'Message 2' })
      store.logMessage({ app: 'other-app', channel: 'discord', body: 'Message 3' })

      // Mark one as sent, one as failed
      store.updateStatus(1, 'sent', { ok: true })
      store.updateStatus(2, 'failed', undefined, 'error')
    })

    it('returns all messages with default params', () => {
      const result = store.getMessages({})
      expect(result.messages).toHaveLength(3)
      expect(result.total).toBe(3)
    })

    it('filters by app', () => {
      const result = store.getMessages({ app: 'kodfika' })
      expect(result.messages).toHaveLength(2)
      expect(result.total).toBe(2)
      expect(result.messages.every(m => m.app === 'kodfika')).toBe(true)
    })

    it('filters by status', () => {
      const result = store.getMessages({ status: 'sent' })
      expect(result.messages).toHaveLength(1)
      expect(result.messages[0].body).toBe('Message 1')
    })

    it('filters by both app and status', () => {
      const result = store.getMessages({ app: 'kodfika', status: 'failed' })
      expect(result.messages).toHaveLength(1)
      expect(result.messages[0].body).toBe('Message 2')
    })

    it('paginates with limit', () => {
      const result = store.getMessages({ limit: 2 })
      expect(result.messages).toHaveLength(2)
      expect(result.total).toBe(3)
    })

    it('paginates with offset', () => {
      const result = store.getMessages({ limit: 2, offset: 2 })
      expect(result.messages).toHaveLength(1)
      expect(result.total).toBe(3)
    })

    it('returns messages ordered by created_at descending', () => {
      const result = store.getMessages({})
      const ids = result.messages.map(m => m.id)
      expect(ids).toEqual([3, 2, 1])
    })
  })

  describe('getStats', () => {
    beforeEach(() => {
      store.logMessage({ app: 'kodfika', channel: 'discord', body: 'Msg 1' })
      store.logMessage({ app: 'kodfika', channel: 'discord', body: 'Msg 2' })
      store.logMessage({ app: 'kodfika', channel: 'discord', body: 'Msg 3' })
      store.logMessage({ app: 'other-app', channel: 'discord', body: 'Msg 4' })

      store.updateStatus(1, 'sent', { ok: true })
      store.updateStatus(2, 'sent', { ok: true })
      store.updateStatus(3, 'failed', undefined, 'error')
    })

    it('returns per-app statistics', () => {
      const stats = store.getStats()

      expect(stats.totalMessages).toBe(4)
      expect(stats.apps['kodfika']).toBeDefined()
      expect(stats.apps['kodfika'].sent).toBe(2)
      expect(stats.apps['kodfika'].failed).toBe(1)
      expect(stats.apps['kodfika'].totalMessages).toBe(3)
    })

    it('includes stats for all apps', () => {
      const stats = store.getStats()

      expect(stats.apps['other-app']).toBeDefined()
      expect(stats.apps['other-app'].totalMessages).toBe(1)
      expect(stats.apps['other-app'].pending).toBe(1)
    })
  })
})
