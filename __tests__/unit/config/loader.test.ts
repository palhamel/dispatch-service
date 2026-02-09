import { describe, it, expect } from 'vitest'
import { loadAppsConfig, validateAppsConfig } from '../../../src/config/loader.js'
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
