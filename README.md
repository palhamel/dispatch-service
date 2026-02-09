# Kodfika Backend - Discord Webhook Proxy

> **Status: PAUSED (February 2026)**
> This backend is currently not in use. It was built to forward forum notifications to Discord,
> but the forum feature was disabled in January 2026 due to low usage.
> The server can be safely shut down until the forum is re-enabled or the backend is repurposed.

Secure Node.js/Express backend service for handling Discord webhook notifications from the Kodfika Events Platform.

## Current Status

- **Forum feature**: Disabled January 2026 (code preserved in frontend)
- **This backend**: Only used by the forum's Discord notifications
- **Contact forms**: Use Airtable API directly from frontend (not this backend)
- **Recommendation**: Keep paused until forum is re-enabled or backend is repurposed

### Future Reuse Potential

This backend has solid security infrastructure (rate limiting, CORS, API key auth, Helmet.js) that could be repurposed as a general-purpose form/notification proxy for multiple sites - handling contact forms, webhooks, and other server-side tasks that shouldn't expose API keys in the browser.

## Features

- **Discord Webhook Proxy** - Bypasses CORS restrictions for browser-based requests
- **API Key Authentication** - Protects endpoints from unauthorized access
- **Rate Limiting** - Prevents abuse with configurable request limits
- **CORS Protection** - Configurable allowed origins including wildcard support
- **Security Headers** - Helmet.js for security hardening
- **Request Logging** - Morgan for HTTP request logging
- **Environment Configuration** - Flexible .env based configuration
- **Health Monitoring** - Health check and API documentation endpoints
- **Error Handling** - Comprehensive error handling and logging

## Installation

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit environment variables
nano .env
```

## Configuration

Update `.env` with your specific configuration:

```env
# Server Configuration
NODE_ENV=development
PORT=3001

# Discord Configuration
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/YOUR_WEBHOOK_ID/YOUR_WEBHOOK_TOKEN

# CORS Configuration (comma-separated, supports wildcards)
ALLOWED_ORIGINS=http://localhost:5173,https://*.ngrok.app,https://kodfika.se

# Security Configuration
API_KEY=your-secure-api-key-here

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000    # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100    # Max requests per window
```

## Usage

### Development
```bash
npm run dev
```

### Production
```bash
npm start
```

The server will start on `http://localhost:3001` (or your configured PORT).

## API Endpoints

### Public Endpoints
- `GET /health` - Health check (no authentication required)
- `GET /api/docs` - API documentation

### Protected Endpoints (require X-API-Key header)
- `POST /api/discord/webhook` - Send notification to Discord
- `POST /api/discord/test` - Test Discord connection

## Authentication

All protected endpoints require an API key:

**Header method (recommended):**
```
X-API-Key: your-api-key-here
```

**Query parameter method:**
```
?apiKey=your-api-key-here
```

## Frontend Integration

The frontend's `discordService.js` uses this backend as a proxy:

```javascript
const BACKEND_URL = 'http://localhost:3001' // or your deployed URL
const API_KEY = 'your-api-key-here'

const response = await fetch(`${BACKEND_URL}/api/discord/webhook`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': API_KEY
  },
  body: JSON.stringify(discordPayload)
})
```

## Security Features

### Rate Limiting
- Default: 100 requests per 15 minutes per IP
- Returns `429 Too Many Requests` when exceeded
- Configurable via environment variables

### CORS Protection
- Configurable allowed origins
- Supports wildcard patterns (e.g., `https://*.ngrok.app`)
- Blocks unauthorized cross-origin requests

### Security Headers
- Content Security Policy
- X-Frame-Options
- X-Content-Type-Options
- And more via Helmet.js

### Input Validation
- Request payload validation
- Content-Type verification
- Size limits on request bodies

## Deployment

### Option 1: Traditional Hosting
1. Copy the `backend/` folder to your server
2. Install dependencies: `npm install`
3. Configure environment variables
4. Start with PM2: `pm2 start server.js --name kodfika-backend`

### Option 2: Docker Deployment
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3001
CMD ["npm", "start"]
```

### Option 3: Serverless Deployment
The server can be adapted for Vercel, Netlify Functions, or AWS Lambda.

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NODE_ENV` | No | `development` | Environment mode |
| `PORT` | No | `3001` | Server port |
| `DISCORD_WEBHOOK_URL` | Yes | - | Your Discord webhook URL |
| `ALLOWED_ORIGINS` | No | localhost origins | Comma-separated CORS origins |
| `API_KEY` | Recommended | - | API key for authentication |
| `RATE_LIMIT_WINDOW_MS` | No | `900000` | Rate limit window (15 min) |
| `RATE_LIMIT_MAX_REQUESTS` | No | `100` | Max requests per window |

## Logging

The server logs:
- HTTP requests (via Morgan)
- Discord webhook forwards
- Security events (blocked CORS, rate limits)
- Errors and warnings

In production, consider using a structured logging solution like Winston.

## Testing

### Test Discord Connection
```bash
curl -X POST http://localhost:3001/api/discord/test \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key-here"
```

### Health Check
```bash
curl http://localhost:3001/health
```

## Troubleshooting

### Common Issues

**CORS Errors:**
- Verify your frontend domain is in `ALLOWED_ORIGINS`
- Check for wildcards syntax (`*.domain.com`)

**401 Unauthorized:**
- Verify API key is set in environment and request headers
- Check header name: `X-API-Key`

**Rate Limiting:**
- Check request frequency
- Adjust `RATE_LIMIT_*` variables if needed

**Discord Errors:**
- Verify `DISCORD_WEBHOOK_URL` is correct
- Check Discord webhook status in Discord server settings

## Monitoring

For production, consider adding:
- Application monitoring (New Relic, DataDog)
- Error tracking (Sentry)
- Uptime monitoring
- Log aggregation

## License

MIT License - see LICENSE file for details.