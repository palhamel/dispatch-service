# API Specification

This is the API specification for the spec detailed in @backend/.agent-os/specs/2026-02-09-dispatch-notification-service/spec.md

> Created: 2026-02-09
> Version: 1.0.0

## Authentication

All protected endpoints require an API key via header:

```
X-API-Key: dk_kodfika_abc123...
```

Two types of keys:
- **App keys**: Access to `POST /api/notify` only, scoped to app's own channels
- **Admin key**: Access to all endpoints including logs and status

## Endpoints

### GET /health

**Purpose:** Health check for uptime monitoring
**Authentication:** None
**Response:**
```json
{
  "status": "ok",
  "service": "dispatch",
  "version": "2.0.0",
  "uptime": 3600,
  "timestamp": "2026-02-09T12:00:00.000Z"
}
```

---

### POST /api/notify

**Purpose:** Send a notification message through a configured channel
**Authentication:** App API key (X-API-Key header)

**Request Body:**
```json
{
  "channel": "discord",
  "sender": {
    "name": "Anna Svensson",
    "email": "anna@example.com"
  },
  "subject": "Fraga om nasta meetup",
  "body": "Hej! Jag undrar om nasta event...",
  "metadata": {
    "source": "contact-form",
    "url": "https://kodfika.se/about"
  }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `channel` | string | Yes | Target channel ("discord") |
| `sender.name` | string | No | Sender's display name (2-100 chars) |
| `sender.email` | string | No | Sender's email (validated format) |
| `subject` | string | No | Message subject (max 200 chars) |
| `body` | string | Yes | Message content (10-2000 chars) |
| `metadata` | object | No | Extra data (source URL, form type, etc.) |

**Success Response (200):**
```json
{
  "success": true,
  "messageId": 42,
  "channel": "discord",
  "timestamp": "2026-02-09T12:00:00.000Z"
}
```

**Error Responses:**

| Status | Error | Description |
|--------|-------|-------------|
| 400 | `VALIDATION_ERROR` | Invalid payload (missing fields, too long, etc.) |
| 400 | `INVALID_CHANNEL` | Channel not configured for this app |
| 401 | `UNAUTHORIZED` | Missing or invalid API key |
| 403 | `SPAM_DETECTED` | Message flagged as spam |
| 429 | `RATE_LIMITED` | Too many requests from this app |
| 502 | `CHANNEL_ERROR` | Discord API returned an error |
| 500 | `INTERNAL_ERROR` | Unexpected server error |

**Error Response Format:**
```json
{
  "success": false,
  "error": "VALIDATION_ERROR",
  "message": "Field 'body' is required and must be 10-2000 characters",
  "timestamp": "2026-02-09T12:00:00.000Z"
}
```

---

### GET /api/logs

**Purpose:** Query message history with filters
**Authentication:** Admin API key

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `app` | string | all | Filter by app name |
| `status` | string | all | Filter by status (sent/failed/spam) |
| `limit` | number | 50 | Results per page (max 200) |
| `offset` | number | 0 | Pagination offset |

**Response (200):**
```json
{
  "success": true,
  "total": 156,
  "limit": 50,
  "offset": 0,
  "messages": [
    {
      "id": 42,
      "app": "kodfika",
      "channel": "discord",
      "status": "sent",
      "sender_name": "Anna Svensson",
      "sender_email": "anna@example.com",
      "subject": "Fraga om nasta meetup",
      "body": "Hej! Jag undrar...",
      "created_at": "2026-02-09T12:00:00.000Z",
      "sent_at": "2026-02-09T12:00:01.000Z"
    }
  ]
}
```

---

### GET /api/status

**Purpose:** Service status with per-app statistics
**Authentication:** Admin API key

**Response (200):**
```json
{
  "success": true,
  "service": "dispatch",
  "version": "2.0.0",
  "uptime": 3600,
  "database": {
    "totalMessages": 156,
    "last24h": 12
  },
  "apps": {
    "kodfika": {
      "totalMessages": 100,
      "sent": 95,
      "failed": 3,
      "spam": 2,
      "lastMessage": "2026-02-09T12:00:00.000Z"
    }
  }
}
```

---

### POST /api/test/:channel

**Purpose:** Send a test message to verify channel configuration
**Authentication:** Admin API key

**Request Body:**
```json
{
  "app": "kodfika"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Test message sent to discord for app kodfika",
  "timestamp": "2026-02-09T12:00:00.000Z"
}
```

## Discord Message Formatting

When Dispatch receives a message for the Discord channel, it formats it as a Discord embed:

```json
{
  "embeds": [
    {
      "title": "Fraga om nasta meetup",
      "description": "Hej! Jag undrar om nasta event...",
      "color": 5814783,
      "fields": [
        { "name": "Fran", "value": "Anna Svensson", "inline": true },
        { "name": "Email", "value": "anna@example.com", "inline": true },
        { "name": "Kalla", "value": "contact-form", "inline": true }
      ],
      "footer": { "text": "Via Kodfika | Dispatch" },
      "timestamp": "2026-02-09T12:00:00.000Z"
    }
  ]
}
```

- If no subject is provided, the embed uses the first 50 chars of body as title
- The footer and color come from the app's Discord config in `apps.json`
- Metadata fields are added as embed fields when present
