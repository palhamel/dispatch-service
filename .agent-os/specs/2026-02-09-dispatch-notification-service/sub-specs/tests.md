# Tests Specification

This is the tests coverage details for the spec detailed in @backend/.agent-os/specs/2026-02-09-dispatch-notification-service/spec.md

> Created: 2026-02-09
> Version: 1.0.0

## Test Framework

- **Runner**: Vitest (consistent with frontend)
- **HTTP testing**: Supertest for API endpoint testing
- **Dependencies**: `vitest`, `supertest`

## Test Coverage

### Unit Tests

**channels/discord.js**
- Formats message with subject as embed title
- Formats message without subject (uses truncated body)
- Includes sender fields in embed when provided
- Includes metadata as embed fields
- Uses app-specific embed color and footer from config
- Returns success:true on successful webhook response
- Returns success:false with error details on webhook failure
- Handles network timeout gracefully

**middleware/authenticate.js**
- Returns 401 when no API key provided
- Returns 401 when invalid API key provided
- Resolves app config from valid API key
- Sets req.app with resolved app configuration
- Admin key gets admin access flag

**middleware/validate.js**
- Rejects request without body field
- Rejects request without channel field
- Rejects body shorter than 10 characters
- Rejects body longer than 2000 characters
- Rejects subject longer than 200 characters
- Rejects invalid email format in sender.email
- Accepts valid payload with all optional fields
- Accepts minimal valid payload (channel + body only)

**utils/spam.js**
- Detects medical spam keywords (viagra, cialis, pharmacy)
- Detects gambling/crypto patterns
- Detects adult content patterns
- Detects marketing spam
- Detects URLs in body text
- Detects HTML tags in body
- Returns clean for normal Swedish text
- Returns clean for normal English text
- Returns spam category in result

**utils/sanitize.js**
- Strips HTML tags from input
- Trims whitespace
- Limits string to max length
- Handles null/undefined input
- Preserves Swedish characters

**db/messages.js**
- logMessage inserts record with pending status
- updateStatus changes status and sets sent_at on success
- updateStatus stores error on failure
- getMessages returns paginated results
- getMessages filters by app
- getMessages filters by status
- getStats returns correct counts per app

### Integration Tests

**POST /api/notify**
- Returns 200 and messageId on successful Discord delivery
- Returns 401 with invalid API key
- Returns 400 with missing required fields
- Returns 400 with channel not configured for app
- Returns 403 when spam detected
- Returns 429 when rate limit exceeded
- Returns 502 when Discord webhook fails
- Logs message to database regardless of delivery status
- Records correct status (sent/failed/spam) in database

**GET /api/logs**
- Returns 401 with app key (requires admin key)
- Returns paginated message list
- Filters by app parameter
- Filters by status parameter
- Respects limit and offset parameters

**GET /api/status**
- Returns 401 with app key (requires admin key)
- Returns service info and per-app statistics
- Includes correct message counts

**GET /health**
- Returns 200 without authentication
- Returns service name and version

**POST /api/test/:channel**
- Sends test message to configured Discord webhook
- Returns 401 with app key (requires admin key)
- Returns error for unconfigured app

### Mocking Requirements

- **Discord webhook**: Mock `fetch()` to simulate Discord API responses
  - Success: `{ status: 204 }` (Discord returns 204 No Content on success)
  - Failure: `{ status: 429, body: "rate limited" }`
  - Network error: `throw new Error("ECONNREFUSED")`

- **SQLite**: Use in-memory database for tests (`:memory:` path)
  - Creates same schema as production
  - Isolated per test file
  - No cleanup needed

- **Config**: Test fixture `apps.json` with known test apps and keys
  ```json
  {
    "test-app": {
      "name": "Test App",
      "apiKey": "dk_test_abc123",
      "channels": {
        "discord": {
          "webhookUrl": "https://discord.com/api/webhooks/test/token"
        }
      }
    }
  }
  ```

## Test File Structure

```
backend/
├── __tests__/
│   ├── unit/
│   │   ├── channels/discord.test.ts
│   │   ├── middleware/authenticate.test.ts
│   │   ├── middleware/validate.test.ts
│   │   ├── utils/spam.test.ts
│   │   ├── utils/sanitize.test.ts
│   │   └── db/messages.test.ts
│   ├── integration/
│   │   ├── notify.test.ts
│   │   ├── logs.test.ts
│   │   ├── status.test.ts
│   │   └── health.test.ts
│   └── fixtures/
│       └── apps.json
```
