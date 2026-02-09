# Technical Specification

This is the technical specification for the spec detailed in @backend/.agent-os/specs/2026-02-09-dispatch-notification-service/spec.md

> Created: 2026-02-09
> Version: 1.0.0

## Technical Requirements

### Architecture

Dispatch is a single Express.js server with modular architecture:

```
backend/
├── server.js                 # Express app setup, middleware, routes
├── config/
│   ├── apps.json             # Per-app configuration (API keys, channels)
│   └── apps.example.json     # Template for apps.json
├── channels/
│   └── discord.js            # Discord channel adapter
├── middleware/
│   ├── authenticate.js       # API key validation + app resolution
│   ├── rateLimit.js          # Per-app rate limiting
│   └── validate.js           # Request payload validation
├── db/
│   ├── index.js              # SQLite connection and setup
│   └── messages.js           # Message CRUD operations
├── utils/
│   ├── spam.js               # Spam detection filters
│   └── sanitize.js           # Input sanitization
├── package.json
├── .env                      # Server-level config (port, admin key, db path)
├── .env.example
└── data/
    └── dispatch.db           # SQLite database file (gitignored)
```

### App Configuration Format

File: `config/apps.json`

```json
{
  "kodfika": {
    "name": "Kodfika Events Platform",
    "apiKey": "dk_kodfika_abc123...",
    "rateLimit": {
      "windowMs": 900000,
      "maxRequests": 50
    },
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

Key design decisions:
- API key prefix convention: `dk_` + app name + `_` + random string (makes keys identifiable in logs)
- Each app defines which channels it can use and provides channel-specific config
- Rate limits are per-app, overriding the global rate limit

### Request/Response Flow

```
Client Request
    ↓
Express Middleware (Helmet, CORS, JSON parsing)
    ↓
authenticate.js (resolve API key → app config)
    ↓
rateLimit.js (check per-app rate limit)
    ↓
validate.js (validate payload structure)
    ↓
spam.js (check for spam patterns)
    ↓
Route Handler (POST /api/notify)
    ↓
Log message to SQLite (status: "pending")
    ↓
Channel Adapter (discord.js)
    ↓
Update SQLite (status: "sent" or "failed")
    ↓
Response to Client
```

### Environment Variables (.env)

```env
# Server
NODE_ENV=development
PORT=3001

# Admin
ADMIN_API_KEY=dk_admin_...

# Database
DB_PATH=./data/dispatch.db

# CORS
ALLOWED_ORIGINS=http://localhost:5173,https://kodfika.se

# Global rate limit fallback
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### Security

- **Helmet.js**: Security headers (existing, keep as-is)
- **CORS**: Configurable origins (existing, keep as-is)
- **API key in header**: `X-API-Key` header only (remove query parameter support - it leaks keys in logs)
- **Input validation**: Validate payload structure, max message length, required fields
- **Spam detection**: Reuse patterns from Kodfika's `useSendContactForm.js` (medical spam, gambling, adult content, etc.)
- **Input sanitization**: Strip HTML tags, limit string lengths
- **Admin endpoints**: Separate admin API key, not app keys

## Approach Options

### Channel Adapter Pattern

**Option A: Simple function modules** (Selected)
- Each channel is a module exporting `send(appConfig, payload)` → `{ success, response }`
- Simple, easy to add new channels later
- No abstraction overhead
- Pros: Minimal code, easy to understand, easy to test
- Cons: No interface enforcement (but unnecessary at this scale)

**Option B: Class-based adapter pattern**
- Abstract base class `Channel` with `send()`, `validate()`, `format()` methods
- Each channel extends the base class
- Pros: Formal interface, OOP pattern
- Cons: Overengineered for 1-2 channels, more boilerplate

**Rationale:** With only Discord now (and email later), simple function modules are sufficient. Adding a new channel means creating a new file in `channels/` with an exported `send()` function. No need for abstractions until there are 4+ channels.

### Rate Limiting Strategy

**Option A: In-memory per-app** (Selected)
- Use `express-rate-limit` with a custom key generator that uses the app name
- Simple, works perfectly for a single-instance server
- Pros: No dependencies beyond what exists, memory efficient
- Cons: Resets on server restart (acceptable for this use case)

**Option B: SQLite-based rate limiting**
- Store request counts in SQLite
- Pros: Persists across restarts
- Cons: Database overhead on every request, unnecessary complexity

**Rationale:** In-memory rate limiting is standard and sufficient. A microservice restart naturally resets counters, which is fine.

## External Dependencies

### New Dependencies

- **better-sqlite3** - Synchronous SQLite3 driver for Node.js
  - Justification: Fastest SQLite driver for Node.js, synchronous API simplifies code, no async overhead for simple queries
  - Version: Latest stable
  - Alternative considered: `sqlite3` (async, callback-based, more complex)

### Existing Dependencies (keep)

- `express` - Web framework
- `cors` - CORS middleware
- `helmet` - Security headers
- `express-rate-limit` - Rate limiting
- `morgan` - HTTP logging
- `dotenv` - Environment config

### Dependencies to Remove

- None - all existing dependencies remain useful

## Performance Criteria

- Response time: < 200ms for `POST /api/notify` (excluding Discord API latency)
- SQLite writes: < 5ms per message log entry
- Memory footprint: < 50MB RSS for the service
- Concurrent requests: Handle 50 concurrent requests without issues
