import { readFileSync } from 'fs'
import type { AppsConfig, AppConfig } from '../types.js'

export const loadAppsConfig = (configPath: string): AppsConfig => {
  const raw = readFileSync(configPath, 'utf-8')
  const config = JSON.parse(raw) as AppsConfig
  validateAppsConfig(config)
  return config
}

export const loadAppsConfigFromEnv = (env: Record<string, string | undefined> = process.env): AppsConfig => {
  const appsStr = env.DISPATCH_APPS
  if (!appsStr) {
    throw new Error('DISPATCH_APPS environment variable is required (comma-separated app names)')
  }

  const appNames = appsStr.split(',').map(s => s.trim()).filter(Boolean)
  if (appNames.length === 0) {
    throw new Error('DISPATCH_APPS must contain at least one app name')
  }

  const config: AppsConfig = {}

  for (const appName of appNames) {
    const prefix = `DISPATCH_${appName.toUpperCase()}`

    const apiKey = env[`${prefix}_API_KEY`]
    const name = env[`${prefix}_NAME`] ?? appName
    const discordWebhook = env[`${prefix}_DISCORD_WEBHOOK`]
    const discordColor = env[`${prefix}_DISCORD_COLOR`]
    const discordFooter = env[`${prefix}_DISCORD_FOOTER`]
    const slackWebhook = env[`${prefix}_SLACK_WEBHOOK`]
    const slackColor = env[`${prefix}_SLACK_COLOR`]
    const slackFooter = env[`${prefix}_SLACK_FOOTER`]

    if (!apiKey) {
      throw new Error(`${prefix}_API_KEY is required for app "${appName}"`)
    }

    const channels: AppConfig['channels'] = {}

    if (discordWebhook) {
      channels.discord = {
        webhookUrl: discordWebhook,
        ...(discordColor || discordFooter ? {
          defaultEmbed: {
            ...(discordColor ? { color: parseInt(discordColor, 10) } : {}),
            ...(discordFooter ? { footer: discordFooter } : {}),
          },
        } : {}),
      }
    }

    if (slackWebhook) {
      channels.slack = {
        webhookUrl: slackWebhook,
        ...(slackColor || slackFooter ? {
          defaultFormat: {
            ...(slackColor ? { color: slackColor } : {}),
            ...(slackFooter ? { footer: slackFooter } : {}),
          },
        } : {}),
      }
    }

    if (Object.keys(channels).length === 0) {
      throw new Error(`App "${appName}" must have at least one channel configured (e.g., ${prefix}_DISCORD_WEBHOOK or ${prefix}_SLACK_WEBHOOK)`)
    }

    config[appName] = { name, apiKey, channels }
  }

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

    if (app.apiKey.length < 20) {
      throw new Error(`App "${appName}": apiKey must be at least 20 characters`)
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

    // Validate slack channel if present
    if (app.channels.slack) {
      if (!app.channels.slack.webhookUrl || typeof app.channels.slack.webhookUrl !== 'string') {
        throw new Error(`App "${appName}": slack channel missing "webhookUrl"`)
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
