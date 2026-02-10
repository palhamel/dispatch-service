import type Database from 'better-sqlite3'
import type { MessageRecord } from '../types.js'

export interface LogMessageData {
  app: string
  channel: string
  body: string
  sender_name?: string
  sender_email?: string
  subject?: string
  metadata?: string
  ip_address?: string
}

export interface GetMessagesParams {
  app?: string
  status?: string
  limit?: number
  offset?: number
}

export interface GetMessagesResult {
  messages: MessageRecord[]
  total: number
}

export interface AppStats {
  totalMessages: number
  pending: number
  sent: number
  failed: number
  spam: number
  lastMessage: string | null
}

export interface StatsResult {
  totalMessages: number
  apps: Record<string, AppStats>
}

export const createMessageStore = (db: Database.Database) => {
  const insertStmt = db.prepare(`
    INSERT INTO messages (app, channel, body, sender_name, sender_email, subject, metadata, ip_address)
    VALUES (@app, @channel, @body, @sender_name, @sender_email, @subject, @metadata, @ip_address)
  `)

  const updateSentStmt = db.prepare(`
    UPDATE messages
    SET status = @status, discord_response = @discord_response, error = @error, sent_at = datetime('now')
    WHERE id = @id
  `)

  const updateFailedStmt = db.prepare(`
    UPDATE messages
    SET status = @status, discord_response = @discord_response, error = @error
    WHERE id = @id
  `)

  const logMessage = (data: LogMessageData): number => {
    const result = insertStmt.run({
      app: data.app,
      channel: data.channel,
      body: data.body,
      sender_name: data.sender_name ?? null,
      sender_email: data.sender_email ?? null,
      subject: data.subject ?? null,
      metadata: data.metadata ?? null,
      ip_address: data.ip_address ?? null,
    })
    return Number(result.lastInsertRowid)
  }

  const updateStatus = (
    id: number,
    status: 'sent' | 'failed' | 'spam',
    response?: unknown,
    error?: string
  ): void => {
    const params = {
      id,
      status,
      discord_response: response ? JSON.stringify(response) : null,
      error: error ?? null,
    }

    if (status === 'sent') {
      updateSentStmt.run(params)
    } else {
      updateFailedStmt.run(params)
    }
  }

  const getMessages = (params: GetMessagesParams): GetMessagesResult => {
    const conditions: string[] = []
    const values: Record<string, unknown> = {}

    if (params.app) {
      conditions.push('app = @app')
      values.app = params.app
    }
    if (params.status) {
      conditions.push('status = @status')
      values.status = params.status
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const limit = Math.min(params.limit ?? 50, 200)
    const offset = params.offset ?? 0

    const countResult = db.prepare(`SELECT COUNT(*) as count FROM messages ${where}`).get(values) as { count: number }
    const messages = db.prepare(
      `SELECT * FROM messages ${where} ORDER BY created_at DESC LIMIT @limit OFFSET @offset`
    ).all({ ...values, limit, offset }) as MessageRecord[]

    return {
      messages,
      total: countResult.count,
    }
  }

  const getStats = (): StatsResult => {
    const totalResult = db.prepare('SELECT COUNT(*) as count FROM messages').get() as { count: number }

    const appStats = db.prepare(`
      SELECT
        app,
        COUNT(*) as totalMessages,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN status = 'spam' THEN 1 ELSE 0 END) as spam,
        MAX(created_at) as lastMessage
      FROM messages
      GROUP BY app
    `).all() as Array<{
      app: string
      totalMessages: number
      pending: number
      sent: number
      failed: number
      spam: number
      lastMessage: string | null
    }>

    const apps: Record<string, AppStats> = {}
    for (const row of appStats) {
      apps[row.app] = {
        totalMessages: row.totalMessages,
        pending: row.pending,
        sent: row.sent,
        failed: row.failed,
        spam: row.spam,
        lastMessage: row.lastMessage,
      }
    }

    return {
      totalMessages: totalResult.count,
      apps,
    }
  }

  return { logMessage, updateStatus, getMessages, getStats }
}
