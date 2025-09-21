# Kodfika Forum Backend

Secure Node.js/Express backend service for handling Slack webhook notifications from the Kodfika Forum.

## Features

- ✅ **Secure Slack Webhook Proxy** - Bypasses CORS restrictions for browser-based requests
- ✅ **API Key Authentication** - Protects endpoints from unauthorized access
- ✅ **Rate Limiting** - Prevents abuse with configurable request limits
- ✅ **CORS Protection** - Configurable allowed origins including wildcard support
- ✅ **Security Headers** - Helmet.js for security hardening
- ✅ **Request Logging** - Morgan for HTTP request logging
- ✅ **Environment Configuration** - Flexible .env based configuration
- ✅ **Health Monitoring** - Health check and API documentation endpoints
- ✅ **Error Handling** - Comprehensive error handling and logging

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

# Slack Configuration
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR_WORKSPACE/YOUR_CHANNEL/YOUR_TOKEN

# CORS Configuration (comma-separated, supports wildcards)
ALLOWED_ORIGINS=http://localhost:5173,https://*.ngrok.app,https://kodfika.se

# Security Configuration
API_KEY=your-secure-api-key-here

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000    # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100    # Max requests per window

# PocketBase Integration (optional)
POCKETBASE_URL=http://127.0.0.1:8090
POCKETBASE_APP_KEY=your-pocketbase-app-key
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
- `POST /api/slack/webhook` - Send notification to Slack
- `POST /api/slack/test` - Test Slack connection

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

Update your frontend Slack service to use the backend proxy:

```javascript
// Replace direct Slack webhook calls with backend proxy
const BACKEND_URL = 'http://localhost:3001' // or your deployed URL
const API_KEY = 'your-api-key-here'

const response = await fetch(`${BACKEND_URL}/api/slack/webhook`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': API_KEY
  },
  body: JSON.stringify(slackPayload)
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
4. Start with PM2: `pm2 start server.js --name kodfika-forum-backend`

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
| `SLACK_WEBHOOK_URL` | Yes | - | Your Slack webhook URL |
| `ALLOWED_ORIGINS` | No | localhost origins | Comma-separated CORS origins |
| `API_KEY` | Recommended | - | API key for authentication |
| `RATE_LIMIT_WINDOW_MS` | No | `900000` | Rate limit window (15 min) |
| `RATE_LIMIT_MAX_REQUESTS` | No | `100` | Max requests per window |

## Logging

The server logs:
- HTTP requests (via Morgan)
- Slack webhook forwards
- Security events (blocked CORS, rate limits)
- Errors and warnings

In production, consider using a structured logging solution like Winston.

## Testing

### Test Slack Connection
```bash
curl -X POST http://localhost:3001/api/slack/test \
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

**Slack Errors:**
- Verify `SLACK_WEBHOOK_URL` is correct
- Check Slack webhook status in Slack admin

## Monitoring

For production, consider adding:
- Application monitoring (New Relic, DataDog)
- Error tracking (Sentry)
- Uptime monitoring
- Log aggregation

## License

MIT License - see LICENSE file for details.