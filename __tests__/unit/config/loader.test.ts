import { describe, it, expect } from 'vitest'
import { loadAppsConfig, loadAppsConfigFromEnv, validateAppsConfig } from '../../../src/config/loader.js'
import { resolve } from 'path'
import type { AppsConfig } from '../../../src/types.js'

const FIXTURES_PATH = resolve(__dirname, '../../fixtures/apps.json')

describe('loadAppsConfig', () => {
  it('loads apps config from file', () => {
    const config = loadAppsConfig(FIXTURES_PATH)
    expect(config).toBeDefined()
    expect(config['test-app']).toBeDefined()
    expect(config['test-app'].name).toBe('Test Application')
  })

  it('throws on missing file', () => {
    expect(() => loadAppsConfig('/nonexistent/path.json')).toThrow()
  })
})

describe('validateAppsConfig', () => {
  it('accepts valid config', () => {
    const config: AppsConfig = {
      myapp: {
        name: 'My App',
        apiKey: 'dk_myapp_validkey123',
        channels: {
          discord: {
            webhookUrl: 'https://discord.com/api/webhooks/123/abc',
          },
        },
      },
    }
    expect(() => validateAppsConfig(config)).not.toThrow()
  })

  it('rejects app without name', () => {
    const config = {
      myapp: {
        apiKey: 'dk_myapp_validkey123',
        channels: { discord: { webhookUrl: 'https://discord.com/api/webhooks/123/abc' } },
      },
    } as unknown as AppsConfig
    expect(() => validateAppsConfig(config)).toThrow(/name/)
  })

  it('rejects app without apiKey', () => {
    const config = {
      myapp: {
        name: 'My App',
        channels: { discord: { webhookUrl: 'https://discord.com/api/webhooks/123/abc' } },
      },
    } as unknown as AppsConfig
    expect(() => validateAppsConfig(config)).toThrow(/apiKey/)
  })

  it('rejects app without channels', () => {
    const config = {
      myapp: {
        name: 'My App',
        apiKey: 'dk_myapp_validkey123',
      },
    } as unknown as AppsConfig
    expect(() => validateAppsConfig(config)).toThrow(/channels/)
  })

  it('rejects app with apiKey shorter than 20 characters', () => {
    const config: AppsConfig = {
      myapp: {
        name: 'My App',
        apiKey: 'dk_short_123',
        channels: {
          discord: { webhookUrl: 'https://discord.com/api/webhooks/123/abc' },
        },
      },
    }
    expect(() => validateAppsConfig(config)).toThrow(/at least 20 characters/)
  })

  it('rejects duplicate API keys across apps', () => {
    const config: AppsConfig = {
      app1: {
        name: 'App 1',
        apiKey: 'dk_shared_samekey123',
        channels: { discord: { webhookUrl: 'https://discord.com/api/webhooks/1/a' } },
      },
      app2: {
        name: 'App 2',
        apiKey: 'dk_shared_samekey123',
        channels: { discord: { webhookUrl: 'https://discord.com/api/webhooks/2/b' } },
      },
    }
    expect(() => validateAppsConfig(config)).toThrow(/duplicate/i)
  })

  it('rejects discord channel without webhookUrl', () => {
    const config = {
      myapp: {
        name: 'My App',
        apiKey: 'dk_myapp_validkey123',
        channels: { discord: {} },
      },
    } as unknown as AppsConfig
    expect(() => validateAppsConfig(config)).toThrow(/webhookUrl/)
  })

  it('accepts valid config with slack channel', () => {
    const config: AppsConfig = {
      myapp: {
        name: 'My App',
        apiKey: 'dk_myapp_validkey123',
        channels: {
          slack: {
            webhookUrl: 'https://hooks.slack.com/services/T00/B00/xxxx',
          },
        },
      },
    }
    expect(() => validateAppsConfig(config)).not.toThrow()
  })

  it('rejects slack channel without webhookUrl', () => {
    const config = {
      myapp: {
        name: 'My App',
        apiKey: 'dk_myapp_validkey123',
        channels: { slack: {} },
      },
    } as unknown as AppsConfig
    expect(() => validateAppsConfig(config)).toThrow(/webhookUrl/)
  })

  it('skips keys starting with underscore (documentation fields)', () => {
    const config = {
      _docs: 'This is documentation',
      _key_format: 'dk_appname_...',
      myapp: {
        name: 'My App',
        apiKey: 'dk_myapp_validkey123',
        channels: { discord: { webhookUrl: 'https://discord.com/api/webhooks/123/abc' } },
      },
    } as unknown as AppsConfig
    expect(() => validateAppsConfig(config)).not.toThrow()
  })
})

describe('loadAppsConfigFromEnv', () => {
  it('loads single app from env vars', () => {
    const env = {
      DISPATCH_APPS: 'myapp',
      DISPATCH_MYAPP_API_KEY: 'dk_myapp_testkey123abcdef',
      DISPATCH_MYAPP_NAME: 'My App',
      DISPATCH_MYAPP_DISCORD_WEBHOOK: 'https://discord.com/api/webhooks/123/abc',
    }
    const config = loadAppsConfigFromEnv(env)
    expect(config.myapp).toBeDefined()
    expect(config.myapp.name).toBe('My App')
    expect(config.myapp.apiKey).toBe('dk_myapp_testkey123abcdef')
    expect(config.myapp.channels.discord?.webhookUrl).toBe('https://discord.com/api/webhooks/123/abc')
  })

  it('loads multiple apps from env vars', () => {
    const env = {
      DISPATCH_APPS: 'myapp,portfolio',
      DISPATCH_MYAPP_API_KEY: 'dk_myapp_key1abcdef789',
      DISPATCH_MYAPP_NAME: 'My App',
      DISPATCH_MYAPP_DISCORD_WEBHOOK: 'https://discord.com/api/webhooks/1/a',
      DISPATCH_PORTFOLIO_API_KEY: 'dk_portfolio_key2abcdef',
      DISPATCH_PORTFOLIO_NAME: 'Portfolio',
      DISPATCH_PORTFOLIO_DISCORD_WEBHOOK: 'https://discord.com/api/webhooks/2/b',
    }
    const config = loadAppsConfigFromEnv(env)
    expect(Object.keys(config)).toHaveLength(2)
    expect(config.myapp).toBeDefined()
    expect(config.portfolio).toBeDefined()
  })

  it('includes discord embed color and footer when set', () => {
    const env = {
      DISPATCH_APPS: 'myapp',
      DISPATCH_MYAPP_API_KEY: 'dk_myapp_key1abcdef78923abcdef456',
      DISPATCH_MYAPP_DISCORD_WEBHOOK: 'https://discord.com/api/webhooks/1/a',
      DISPATCH_MYAPP_DISCORD_COLOR: '5814783',
      DISPATCH_MYAPP_DISCORD_FOOTER: 'Via MyApp',
    }
    const config = loadAppsConfigFromEnv(env)
    expect(config.myapp.channels.discord?.defaultEmbed?.color).toBe(5814783)
    expect(config.myapp.channels.discord?.defaultEmbed?.footer).toBe('Via MyApp')
  })

  it('defaults name to app key when NAME not set', () => {
    const env = {
      DISPATCH_APPS: 'myapp',
      DISPATCH_MYAPP_API_KEY: 'dk_myapp_key1abcdef78923abcdef456',
      DISPATCH_MYAPP_DISCORD_WEBHOOK: 'https://discord.com/api/webhooks/1/a',
    }
    const config = loadAppsConfigFromEnv(env)
    expect(config.myapp.name).toBe('myapp')
  })

  it('throws when DISPATCH_APPS is missing', () => {
    expect(() => loadAppsConfigFromEnv({})).toThrow(/DISPATCH_APPS/)
  })

  it('throws when API key is missing for an app', () => {
    const env = {
      DISPATCH_APPS: 'myapp',
      DISPATCH_MYAPP_DISCORD_WEBHOOK: 'https://discord.com/api/webhooks/1/a',
    }
    expect(() => loadAppsConfigFromEnv(env)).toThrow(/DISPATCH_MYAPP_API_KEY/)
  })

  it('loads slack channel from env vars', () => {
    const env = {
      DISPATCH_APPS: 'myapp',
      DISPATCH_MYAPP_API_KEY: 'dk_myapp_key1abcdef78923abcdef456',
      DISPATCH_MYAPP_SLACK_WEBHOOK: 'https://hooks.slack.com/services/T00/B00/xxxx',
    }
    const config = loadAppsConfigFromEnv(env)
    expect(config.myapp.channels.slack?.webhookUrl).toBe('https://hooks.slack.com/services/T00/B00/xxxx')
  })

  it('includes slack format color and footer when set', () => {
    const env = {
      DISPATCH_APPS: 'myapp',
      DISPATCH_MYAPP_API_KEY: 'dk_myapp_key1abcdef78923abcdef456',
      DISPATCH_MYAPP_SLACK_WEBHOOK: 'https://hooks.slack.com/services/T00/B00/xxxx',
      DISPATCH_MYAPP_SLACK_COLOR: '#36a64f',
      DISPATCH_MYAPP_SLACK_FOOTER: 'Via MyApp',
    }
    const config = loadAppsConfigFromEnv(env)
    expect(config.myapp.channels.slack?.defaultFormat?.color).toBe('#36a64f')
    expect(config.myapp.channels.slack?.defaultFormat?.footer).toBe('Via MyApp')
  })

  it('loads app with only slack channel (no discord)', () => {
    const env = {
      DISPATCH_APPS: 'myapp',
      DISPATCH_MYAPP_API_KEY: 'dk_myapp_key1abcdef78923abcdef456',
      DISPATCH_MYAPP_SLACK_WEBHOOK: 'https://hooks.slack.com/services/T00/B00/xxxx',
    }
    const config = loadAppsConfigFromEnv(env)
    expect(config.myapp.channels.slack).toBeDefined()
    expect(config.myapp.channels.discord).toBeUndefined()
  })

  it('throws when no channel is configured for an app', () => {
    const env = {
      DISPATCH_APPS: 'myapp',
      DISPATCH_MYAPP_API_KEY: 'dk_myapp_key1abcdef78923abcdef456',
    }
    expect(() => loadAppsConfigFromEnv(env)).toThrow(/channel/)
  })

  it('trims whitespace in app names', () => {
    const env = {
      DISPATCH_APPS: ' myapp , portfolio ',
      DISPATCH_MYAPP_API_KEY: 'dk_myapp_key1abcdef789',
      DISPATCH_MYAPP_DISCORD_WEBHOOK: 'https://discord.com/api/webhooks/1/a',
      DISPATCH_PORTFOLIO_API_KEY: 'dk_portfolio_key2abcdef',
      DISPATCH_PORTFOLIO_DISCORD_WEBHOOK: 'https://discord.com/api/webhooks/2/b',
    }
    const config = loadAppsConfigFromEnv(env)
    expect(config.myapp).toBeDefined()
    expect(config.portfolio).toBeDefined()
  })
})
