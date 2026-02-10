/**
 * Dispatch - Server entry point.
 * Loads config, initializes database, creates app, and starts listener.
 */

import path from 'node:path'
import dotenv from 'dotenv'
import { createDatabase } from './db/index.js'
import { loadAppsConfig, loadAppsConfigFromEnv } from './config/loader.js'
import { createApp } from './app.js'

dotenv.config()

const port = parseInt(process.env.PORT ?? '3001', 10)
const dbPath = process.env.DB_PATH ?? './data/dispatch.db'
const adminApiKey = process.env.ADMIN_API_KEY
const nodeEnv = process.env.NODE_ENV ?? 'development'
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',')

if (!adminApiKey) {
  console.error('ADMIN_API_KEY is required. Set it in .env')
  process.exit(1)
}

// Load app config: env vars (production) > file path > default file (local dev)
let appsConfig
try {
  if (process.env.DISPATCH_APPS) {
    appsConfig = loadAppsConfigFromEnv()
    console.log('Apps config loaded from environment variables')
  } else if (process.env.APPS_CONFIG_PATH) {
    appsConfig = loadAppsConfig(path.resolve(process.env.APPS_CONFIG_PATH))
  } else {
    appsConfig = loadAppsConfig(path.resolve('./src/config/apps.json'))
  }
} catch (err) {
  console.error('Failed to load apps config:', (err as Error).message)
  console.error('Set DISPATCH_APPS env var, or copy src/config/apps.example.json to src/config/apps.json')
  process.exit(1)
}

// Initialize database
const db = createDatabase(dbPath)

// Create app
const { app } = createApp({
  db,
  appsConfig,
  adminApiKey,
  allowedOrigins,
  nodeEnv,
})

// Start server
app.listen(port, () => {
  const appCount = Object.keys(appsConfig).filter(k => !k.startsWith('_')).length
  console.log(`\nDispatch v2.0.0 started`)
  console.log(`  URL: http://localhost:${port}`)
  console.log(`  Environment: ${nodeEnv}`)
  console.log(`  Database: ${dbPath}`)
  console.log(`  Apps loaded: ${appCount}`)
  console.log(`  Health: http://localhost:${port}/health\n`)
})

// Graceful shutdown
const shutdown = () => {
  db.close()
  process.exit(0)
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
