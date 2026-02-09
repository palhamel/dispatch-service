import { readFileSync } from 'fs'
import type { AppsConfig, AppConfig } from '../types.js'

export const loadAppsConfig = (configPath: string): AppsConfig => {
  const raw = readFileSync(configPath, 'utf-8')
  const config = JSON.parse(raw) as AppsConfig
  validateAppsConfig(config)
  return config
}

export const validateAppsConfig = (config: AppsConfig): void => {
  const seenKeys = new Set<string>()

  for (const [appName, appConfig] of Object.entries(config)) {
    // Skip documentation fields (keys starting with _)
    if (appName.startsWith('_')) continue

    const app = appConfig as AppConfig

    if (!app.name || typeof app.name !== 'string') {
      throw new Error(`App "${appName}": missing or invalid "name" field`)
    }

    if (!app.apiKey || typeof app.apiKey !== 'string') {
      throw new Error(`App "${appName}": missing or invalid "apiKey" field`)
    }

    if (seenKeys.has(app.apiKey)) {
      throw new Error(`Duplicate API key found across apps. Each app must have a unique apiKey.`)
    }
    seenKeys.add(app.apiKey)

    if (!app.channels || typeof app.channels !== 'object') {
      throw new Error(`App "${appName}": missing or invalid "channels" field`)
    }

    // Validate discord channel if present
    if (app.channels.discord) {
      if (!app.channels.discord.webhookUrl || typeof app.channels.discord.webhookUrl !== 'string') {
        throw new Error(`App "${appName}": discord channel missing "webhookUrl"`)
      }
    }
  }
}

export const buildKeyIndex = (config: AppsConfig): Map<string, { appName: string; appConfig: AppConfig }> => {
  const index = new Map<string, { appName: string; appConfig: AppConfig }>()

  for (const [appName, appConfig] of Object.entries(config)) {
    if (appName.startsWith('_')) continue
    index.set(appConfig.apiKey, { appName, appConfig })
  }

  return index
}
