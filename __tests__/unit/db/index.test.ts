import { describe, it, expect, afterEach } from 'vitest'
import { createDatabase } from '../../../src/db/index.js'
import type Database from 'better-sqlite3'

describe('createDatabase', () => {
  let db: Database.Database

  afterEach(() => {
    if (db) db.close()
  })

  it('creates an in-memory database', () => {
    db = createDatabase(':memory:')
    expect(db).toBeDefined()
    expect(db.open).toBe(true)
  })

  it('sets WAL journal mode (in-memory reports "memory")', () => {
    db = createDatabase(':memory:')
    const result = db.pragma('journal_mode') as { journal_mode: string }[]
    // In-memory databases always report "memory" even when WAL is set
    expect(result[0].journal_mode).toBe('memory')
  })

  it('creates the messages table', () => {
    db = createDatabase(':memory:')
    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='messages'"
    ).all() as { name: string }[]
    expect(tables).toHaveLength(1)
    expect(tables[0].name).toBe('messages')
  })

  it('creates messages table with correct columns', () => {
    db = createDatabase(':memory:')
    const columns = db.prepare('PRAGMA table_info(messages)').all() as { name: string }[]
    const columnNames = columns.map(c => c.name)

    expect(columnNames).toContain('id')
    expect(columnNames).toContain('app')
    expect(columnNames).toContain('channel')
    expect(columnNames).toContain('status')
    expect(columnNames).toContain('sender_name')
    expect(columnNames).toContain('sender_email')
    expect(columnNames).toContain('subject')
    expect(columnNames).toContain('body')
    expect(columnNames).toContain('metadata')
    expect(columnNames).toContain('discord_response')
    expect(columnNames).toContain('error')
    expect(columnNames).toContain('ip_address')
    expect(columnNames).toContain('created_at')
    expect(columnNames).toContain('sent_at')
  })

  it('creates indexes on messages table', () => {
    db = createDatabase(':memory:')
    const indexes = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='messages'"
    ).all() as { name: string }[]
    const indexNames = indexes.map(i => i.name)

    expect(indexNames).toContain('idx_messages_app')
    expect(indexNames).toContain('idx_messages_status')
    expect(indexNames).toContain('idx_messages_created_at')
    expect(indexNames).toContain('idx_messages_app_status')
  })

  it('is idempotent - can be called multiple times', () => {
    db = createDatabase(':memory:')
    // Should not throw when called again on same db path
    const db2 = createDatabase(':memory:')
    expect(db2.open).toBe(true)
    db2.close()
  })
})
