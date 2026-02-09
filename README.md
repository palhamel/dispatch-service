# Dispatch - Notification Microservice

General-purpose notification microservice that routes messages from apps to Discord (and future channels). Multi-app support with per-app API keys, message logging, spam detection, and admin dashboard endpoints.

## Quick Start

```bash
cd backend
npm install

# Configure
cp .env.example .env
cp src/config/apps.example.json src/config/apps.json

# Edit .env with your ADMIN_API_KEY
# Edit src/config/apps.json with your app configs and Discord webhook URLs

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
  -H "X-API-Key: dk_kodfika_your-app-key" \
  -d '{
    "channel": "discord",
    "body": "Hej! Jag undrar om nasta meetup.",
    "subject": "Fraga om meetup",
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
| `channel` | string | Yes | Target channel (`discord`) |
| `body` | string | Yes | Message content (10-2000 chars) |
| `subject` | string | No | Message subject (max 200 chars) |
| `sender.name` | string | No | Sender name (2-100 chars) |
| `sender.email` | string | No | Sender email (validated format) |
| `metadata` | object | No | Extra data (source, URL, etc.) |

## App Configuration

Each app gets its own API key and channel config in `src/config/apps.json`:

```json
{
  "kodfika": {
    "name": "Kodfika Events Platform",
    "apiKey": "dk_kodfika_your-secure-key-here",
    "channels": {
      "discord": {
        "webhookUrl": "https://discord.com/api/webhooks/...",
        "defaultEmbed": {
          "color": 5814783,
          "footer": "Via Kodfika"
        }
      }
    }
  }
}
```

Generate API keys:
```bash
node -e "console.log('dk_appname_' + require('crypto').randomBytes(24).toString('hex'))"
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ADMIN_API_KEY` | Yes | - | Admin API key for logs/status/test endpoints |
| `PORT` | No | `3001` | Server port |
| `NODE_ENV` | No | `development` | Environment mode |
| `DB_PATH` | No | `./data/dispatch.db` | SQLite database path |
| `ALLOWED_ORIGINS` | No | `localhost,kodfika.se` | Comma-separated CORS origins |

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

## Testing

134 tests across 11 test files:

- **Unit tests**: sanitize, spam, validate, authenticate, config loader, Discord adapter, database
- **Integration tests**: Full request pipeline (notify endpoint, admin endpoints, health)

```bash
npm run test:run
```

## Deployment

```bash
npm run build
NODE_ENV=production node dist/server.js
```

Or with PM2:
```bash
pm2 start npm --name dispatch -- start
```

## License

MIT
