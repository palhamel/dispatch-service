import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import morgan from 'morgan'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

const app = express()
const port = process.env.PORT || 3001

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://discord.com", "https://discordapp.com"]
    }
  }
}))

// CORS configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
  'http://localhost:5173',
  'http://localhost:5174',
  'https://kodfika.se'
]

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, etc.)
    if (!origin) return callback(null, true)

    // Check if origin matches allowed patterns
    const isAllowed = allowedOrigins.some(allowedOrigin => {
      if (allowedOrigin.includes('*')) {
        // Handle wildcard patterns like https://*.ngrok.app
        const pattern = allowedOrigin.replace('*', '.*')
        const regex = new RegExp(`^${pattern}$`)
        return regex.test(origin)
      }
      return allowedOrigin === origin
    })

    if (isAllowed) {
      callback(null, true)
    } else {
      console.warn(`CORS blocked origin: ${origin}`)
      callback(new Error('Not allowed by CORS'))
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
}))

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
})

app.use(limiter)

// Logging
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'))

// Body parsing
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// API Key validation middleware
const validateApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'] || req.query.apiKey
  const expectedApiKey = process.env.API_KEY

  if (!expectedApiKey) {
    console.warn('⚠️ API_KEY not configured in environment variables')
    return next() // Allow in development if no API key is set
  }

  if (!apiKey || apiKey !== expectedApiKey) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Invalid or missing API key'
    })
  }

  next()
}

// Health check endpoint (no auth required)
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Kodfika Forum Backend',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  })
})

// Discord webhook proxy endpoint
app.post('/api/discord/webhook', validateApiKey, async (req, res) => {
  try {
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL

    if (!webhookUrl) {
      console.error('❌ DISCORD_WEBHOOK_URL not configured')
      return res.status(500).json({
        success: false,
        error: 'Discord webhook URL not configured'
      })
    }

    // Validate request payload
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Invalid request payload'
      })
    }

    console.log('📤 Forwarding Discord notification...', {
      timestamp: new Date().toISOString(),
      ip: req.ip,
      userAgent: req.get('User-Agent')
    })

    // Forward the request to Discord
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Kodfika-Forum-Backend/1.0.0'
      },
      body: JSON.stringify(req.body)
    })

    if (response.ok) {
      console.log('✅ Discord notification sent successfully')
      res.json({
        success: true,
        message: 'Notification sent to Discord',
        timestamp: new Date().toISOString()
      })
    } else {
      const errorText = await response.text()
      console.error('❌ Discord webhook failed:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      })

      res.status(response.status).json({
        success: false,
        error: `Discord API error: ${response.status} ${response.statusText}`,
        details: process.env.NODE_ENV === 'development' ? errorText : undefined
      })
    }

  } catch (error) {
    console.error('❌ Server error while forwarding to Discord:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    })
  }
})

// Test endpoint to verify Discord connection
app.post('/api/discord/test', validateApiKey, async (req, res) => {
  try {
    const testPayload = {
      content: "🧪 Test från Kodfika Forum Backend",
      embeds: [
        {
          title: "✅ Backend Discord-integration fungerar!",
          description: "Serveranslutning bekräftad.",
          color: 5814783, // Discord blue color
          timestamp: new Date().toISOString(),
          footer: {
            text: `Server: ${process.env.NODE_ENV || 'development'}`
          }
        }
      ]
    }

    // Use the main webhook endpoint
    const testResponse = await fetch(`http://localhost:${port}/api/discord/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': process.env.API_KEY
      },
      body: JSON.stringify(testPayload)
    })

    const testResult = await testResponse.json()

    if (testResult.success) {
      res.json({
        success: true,
        message: 'Test notification sent successfully',
        result: testResult
      })
    } else {
      res.status(500).json({
        success: false,
        error: 'Test notification failed',
        details: testResult
      })
    }

  } catch (error) {
    console.error('❌ Test endpoint error:', error)
    res.status(500).json({
      success: false,
      error: 'Test failed',
      message: error.message
    })
  }
})

// API documentation endpoint
app.get('/api/docs', (req, res) => {
  res.json({
    service: 'Kodfika Forum Backend API',
    version: '1.0.0',
    endpoints: {
      'GET /health': 'Health check (no auth required)',
      'POST /api/discord/webhook': 'Send notification to Discord (requires API key)',
      'POST /api/discord/test': 'Test Discord connection (requires API key)',
      'GET /api/docs': 'This documentation'
    },
    authentication: {
      method: 'API Key',
      header: 'X-API-Key',
      alternative: 'Query parameter: ?apiKey=YOUR_KEY'
    },
    rateLimit: {
      window: `${process.env.RATE_LIMIT_WINDOW_MS || 900000}ms`,
      maxRequests: process.env.RATE_LIMIT_MAX_REQUESTS || 100
    }
  })
})

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    message: 'Please check the API documentation at /api/docs'
  })
})

// Global error handler
app.use((error, req, res, next) => {
  console.error('💥 Unhandled server error:', error)

  res.status(error.status || 500).json({
    success: false,
    error: error.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  })
})

// Start server
app.listen(port, () => {
  console.log('\n🚀 Kodfika Forum Backend Server Started')
  console.log('═══════════════════════════════════════')
  console.log(`📍 Server URL: http://localhost:${port}`)
  console.log(`🏥 Health check: http://localhost:${port}/health`)
  console.log(`📚 API docs: http://localhost:${port}/api/docs`)
  console.log(`📡 Discord webhook: http://localhost:${port}/api/discord/webhook`)
  console.log(`🧪 Discord test: http://localhost:${port}/api/discord/test`)
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`)
  console.log(`🔐 API Key required: ${process.env.API_KEY ? 'Yes' : 'No'}`)
  console.log(`📊 Rate limit: ${process.env.RATE_LIMIT_MAX_REQUESTS || 100} requests per ${(parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000) / 60000} minutes`)
  console.log('═══════════════════════════════════════\n')

  if (!process.env.DISCORD_WEBHOOK_URL) {
    console.warn('⚠️ Warning: DISCORD_WEBHOOK_URL not configured in .env file')
  }
})

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully...')
  process.exit(0)
})

process.on('SIGINT', () => {
  console.log('\n🛑 SIGINT received, shutting down gracefully...')
  process.exit(0)
})