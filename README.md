# Dispatch - Notification Microservice

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-22%2B-green.svg)](https://nodejs.org/)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?logo=typescript&logoColor=white)
[![CI](https://github.com/palhamel/dispatch-service/actions/workflows/pr-checks.yml/badge.svg)](https://github.com/palhamel/dispatch-service/actions/workflows/pr-checks.yml)
[![Tests](https://img.shields.io/badge/Tests-164%20passing-brightgreen.svg)]()

General-purpose notification microservice that routes messages from apps to Discord and Slack. Multi-app support with per-app API keys, message logging, spam detection, and admin dashboard endpoints.

## Quick Start

```bash
npm install

# Configure
cp .env.example .env
cp src/config/apps.example.json src/config/apps.json

# Edit .env with your ADMIN_API_KEY
# Edit src/config/apps.json with your app configs and webhook URLs

# Run
npm run dev
```

## Architecture

```
src/
  server.ts              # Entry point (config loading, DB init, listener)
  app.ts                 # Express app factory (middleware wiring, routes)
  types.ts               # Core TypeScript interfaces
  config/
    loader.ts            # App config loading and validation
    apps.json            # Per-app configuration (gitignored - contains API keys)
    apps.example.json    # Template for apps.json
  channels/
    discord.ts           # Discord webhook adapter (rich embeds)
    slack.ts             # Slack webhook adapter (Block Kit)
  middleware/
    authenticate.ts      # API key validation (header only, no query params)
    validate.ts          # Request payload validation and sanitization
  db/
    index.ts             # SQLite connection with auto-schema (WAL mode)
    messages.ts          # Message CRUD operations
  utils/
    sanitize.ts          # HTML stripping, XSS prevention
    spam.ts              # Spam pattern detection (23 patterns, 8 categories)
```

## API Endpoints

### Public
| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check with service info |

### App Endpoints (require app API key)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/notify` | Send a notification through a configured channel |

### Admin Endpoints (require admin API key)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/logs` | Query message history with filters |
| GET | `/api/status` | Service status with per-app statistics |
| POST | `/api/test/:channel` | Send test message to verify channel config |

## Authentication

All protected endpoints require an API key via header:

```
X-API-Key: dk_appname_your-key-here
```

Query parameter authentication is explicitly rejected for security (prevents key leaking in server logs and URLs).

## Sending a Notification

```bash
curl -X POST http://localhost:3001/api/notify \
  -H "Content-Type: application/json" \
  -H "X-API-Key: dk_myapp_your-app-key" \
  -d '{
    "channel": "discord",
    "body": "Hello! A new contact form submission.",
    "subject": "New message",
    "sender": {
      "name": "Anna Svensson",
      "email": "anna@example.com"
    },
    "metadata": {
      "source": "contact-form"
    }
  }'
```

**Request fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `channel` | string | Yes | Target channel (`discord`, `slack`) |
| `body` | string | Yes | Message content (10-2000 chars) |
| `subject` | string | No | Message subject (max 200 chars) |
| `sender.name` | string | No | Sender name (2-100 chars) |
| `sender.email` | string | No | Sender email (validated format) |
| `metadata` | object | No | Extra data (source, URL, etc.) |

## Channel Setup

### Discord

1. Open your Discord server and go to **Server Settings > Integrations > Webhooks**
2. Click **New Webhook**, choose a channel, and copy the webhook URL
3. Add the URL to your app config as `DISPATCH_<APP>_DISCORD_WEBHOOK` (env) or `channels.discord.webhookUrl` (JSON)

Optional settings:
- **Color**: Integer color value for the embed sidebar (e.g. `5814783` for blue)
- **Footer**: Custom text shown at the bottom of each embed

### Slack

1. Go to [api.slack.com/apps](https://api.slack.com/apps) and create a new app (or use an existing one)
2. Enable **Incoming Webhooks** under Features
3. Click **Add New Webhook to Workspace**, select a channel, and copy the webhook URL
4. Add the URL to your app config as `DISPATCH_<APP>_SLACK_WEBHOOK` (env) or `channels.slack.webhookUrl` (JSON)

Optional settings:
- **Color**: Hex color string for the attachment sidebar (e.g. `#36a64f` for green)
- **Footer**: Custom text shown in the context block at the bottom

Each app can have one or both channels configured. The `channel` field in the `/api/notify` request determines where the message is sent.

## App Configuration

### Option 1: Environment Variables (recommended for production)

```bash
DISPATCH_APPS=myapp
DISPATCH_MYAPP_API_KEY=dk_myapp_your-secure-key-here
DISPATCH_MYAPP_NAME=My Application

# Discord
DISPATCH_MYAPP_DISCORD_WEBHOOK=https://discord.com/api/webhooks/...
DISPATCH_MYAPP_DISCORD_COLOR=5814783
DISPATCH_MYAPP_DISCORD_FOOTER=Via My App

# Slack
DISPATCH_MYAPP_SLACK_WEBHOOK=https://hooks.slack.com/services/T00/B00/xxxx
DISPATCH_MYAPP_SLACK_COLOR=#36a64f
DISPATCH_MYAPP_SLACK_FOOTER=Via My App
```

Multiple apps: `DISPATCH_APPS=myapp,support` with separate env vars per app.

### Option 2: JSON Config File (local development)

Create `src/config/apps.json` from the example:

```json
{
  "myapp": {
    "name": "My Application",
    "apiKey": "dk_myapp_your-secure-key-here",
    "channels": {
      "discord": {
        "webhookUrl": "https://discord.com/api/webhooks/...",
        "defaultEmbed": {
          "color": 5814783,
          "footer": "Via My App"
        }
      },
      "slack": {
        "webhookUrl": "https://hooks.slack.com/services/...",
        "defaultFormat": {
          "color": "#58B9FF",
          "footer": "Via My App"
        }
      }
    }
  }
}
```

**Config priority:** env vars > `APPS_CONFIG_PATH` file > `src/config/apps.json`

Generate API keys:
```bash
node -e "console.log('dk_appname_' + require('crypto').randomBytes(24).toString('hex'))"
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ADMIN_API_KEY` | Yes | - | Admin API key for logs/status/test endpoints |
| `DISPATCH_APPS` | No | - | Comma-separated app names (enables env-based config) |
| `DISPATCH_<APP>_API_KEY` | Per app | - | App API key (required per app when using env config) |
| `DISPATCH_<APP>_DISCORD_WEBHOOK` | Per app | - | Discord webhook URL |
| `DISPATCH_<APP>_DISCORD_COLOR` | Per app | - | Embed color (integer) |
| `DISPATCH_<APP>_DISCORD_FOOTER` | Per app | - | Embed footer text |
| `DISPATCH_<APP>_SLACK_WEBHOOK` | Per app | - | Slack incoming webhook URL |
| `DISPATCH_<APP>_SLACK_COLOR` | Per app | - | Sidebar color (hex string, e.g. `#36a64f`) |
| `DISPATCH_<APP>_SLACK_FOOTER` | Per app | - | Context footer text |
| `PORT` | No | `3001` | Server port |
| `NODE_ENV` | No | `development` | Environment mode |
| `DB_PATH` | No | `./data/dispatch.db` | SQLite database path |
| `ALLOWED_ORIGINS` | No | `localhost` | Comma-separated CORS origins |

## Security

- **Header-only auth**: API keys accepted only via `X-API-Key` header (never query params)
- **Input sanitization**: HTML stripping, XSS prevention, Swedish character preservation
- **Spam detection**: 23 patterns across 8 categories (medical, gambling, crypto, adult, marketing, financial, security, contact apps)
- **Helmet.js**: Strict CSP headers for API service
- **CORS**: Configurable allowed origins with wildcard support
- **Message logging**: All messages logged to SQLite (including spam and failures)
- **Admin separation**: Admin endpoints require separate admin key, app keys cannot access logs/status

## Development

```bash
npm run dev          # Start with hot reload (tsx watch)
npm run test         # Run tests in watch mode
npm run test:run     # Run tests once
npm run typecheck    # TypeScript type checking
npm run build        # Compile TypeScript to dist/
```

Import `docs/dispatch.postman_collection.json` into Postman to test all endpoints.

## Testing

163 tests across 12 test files:

- **Unit tests**: sanitize, spam, validate, authenticate, config loader (file + env), Discord adapter, Slack adapter, database
- **Integration tests**: Full request pipeline (notify endpoint, admin endpoints, health)

```bash
npm run test:run
```

## Deployment

```bash
npm run build
NODE_ENV=production node dist/server.js
```

Or with Docker:
```dockerfile
FROM node:22-slim
# See Dockerfile in repo
```

Or with PM2:
```bash
pm2 start npm --name dispatch -- start
```

## License

MIT
