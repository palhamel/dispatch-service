# Database Schema

This is the database schema implementation for the spec detailed in @backend/.agent-os/specs/2026-02-09-dispatch-notification-service/spec.md

> Created: 2026-02-09
> Version: 1.0.0

## Database Engine

- **Engine**: SQLite via better-sqlite3
- **File location**: `data/dispatch.db` (gitignored)
- **Created automatically** on first server start via `db/index.js`

## Tables

### messages

Primary table for logging all notification messages.

```sql
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
```

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER PK | Auto-incrementing message ID |
| `app` | TEXT NOT NULL | App identifier (e.g., "kodfika") |
| `channel` | TEXT NOT NULL | Delivery channel (e.g., "discord") |
| `status` | TEXT NOT NULL | "pending", "sent", "failed", "spam" |
| `sender_name` | TEXT | Name of the person who sent the message (optional) |
| `sender_email` | TEXT | Email of the sender (optional) |
| `subject` | TEXT | Message subject/title (optional) |
| `body` | TEXT NOT NULL | Message body/content |
| `metadata` | TEXT | JSON string with extra data (source URL, form type, etc.) |
| `discord_response` | TEXT | JSON response from Discord API on success |
| `error` | TEXT | Error message on failure |
| `ip_address` | TEXT | Sender's IP for rate limit tracking |
| `created_at` | DATETIME | When the message was received |
| `sent_at` | DATETIME | When the message was successfully delivered |

### Indexes

```sql
CREATE INDEX IF NOT EXISTS idx_messages_app ON messages(app);
CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_messages_app_status ON messages(app, status);
```

### Rationale

- **app + status index**: Fast filtering of failed messages per app
- **created_at index**: Efficient log pagination and date-range queries
- **Separate sender fields** (instead of JSON blob): Enables SQL queries like "all messages from email X"
- **metadata as JSON**: Flexible storage for app-specific data without schema changes

## Data Lifecycle

- Messages are **never automatically deleted** - they serve as an audit log
- A future maintenance task can be added to clean messages older than X days
- The `data/` directory must be in `.gitignore`

## Database Initialization

`src/db/index.ts` runs table creation on import:

```typescript
import Database from 'better-sqlite3'

const db = new Database(process.env.DB_PATH || './data/dispatch.db')

// Enable WAL mode for better concurrent performance
db.pragma('journal_mode = WAL')

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS messages (...)
  CREATE INDEX IF NOT EXISTS idx_messages_app ON messages(app);
  ...
`)

export default db
```

## Message CRUD Operations

`src/db/messages.ts` provides:

- `logMessage(data)` - Insert new message with status "pending"
- `updateStatus(id, status, response)` - Update after delivery attempt
- `getMessages({ app, status, limit, offset })` - Query with filters
- `getStats()` - Aggregate counts by app and status
