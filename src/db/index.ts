import Database from 'better-sqlite3'
import { mkdirSync } from 'fs'
import { dirname } from 'path'

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    app TEXT NOT NULL,
    channel TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    sender_name TEXT,
    sender_email TEXT,
    subject TEXT,
    body TEXT NOT NULL,
    metadata TEXT,
    discord_response TEXT,
    error TEXT,
    ip_address TEXT,
    created_at DATETIME DEFAULT (datetime('now')),
    sent_at DATETIME
  );

  CREATE INDEX IF NOT EXISTS idx_messages_app ON messages(app);
  CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status);
  CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
  CREATE INDEX IF NOT EXISTS idx_messages_app_status ON messages(app, status);
`

export const createDatabase = (dbPath: string): Database.Database => {
  // Ensure data directory exists for file-based databases
  if (dbPath !== ':memory:') {
    mkdirSync(dirname(dbPath), { recursive: true })
  }

  const db = new Database(dbPath)

  // Enable WAL mode for better concurrent read performance
  db.pragma('journal_mode = WAL')

  // Create tables and indexes
  db.exec(SCHEMA)

  return db
}
