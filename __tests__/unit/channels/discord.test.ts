import { describe, it, expect, vi, beforeEach } from 'vitest'
import { sendDiscord } from '../../../src/channels/discord.js'
import type { DiscordChannelConfig, NotifyRequest } from '../../../src/types.js'

const mockFetch = vi.fn()
global.fetch = mockFetch

const channelConfig: DiscordChannelConfig = {
  webhookUrl: 'https://discord.com/api/webhooks/123/abc',
  defaultEmbed: {
    color: 5814783,
    footer: 'Via My App',
  },
}

const minimalConfig: DiscordChannelConfig = {
  webhookUrl: 'https://discord.com/api/webhooks/456/def',
}

beforeEach(() => {
  mockFetch.mockReset()
})

describe('sendDiscord', () => {
  it('formats message with subject as embed title', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 204 })

    const payload: NotifyRequest = {
      channel: 'discord',
      subject: 'Question about next meetup',
      body: 'Hi! I am wondering about the next event in Malmö.',
    }

    await sendDiscord(channelConfig, payload, 'myapp')

    const call = mockFetch.mock.calls[0]
    const body = JSON.parse(call[1].body)

    expect(body.embeds[0].title).toBe('Question about next meetup')
    expect(body.embeds[0].description).toBe('Hi! I am wondering about the next event in Malmö.')
  })

  it('formats message without subject (uses truncated body as title)', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 204 })

    const longBody = 'This is a longer message body that should be truncated when used as the embed title since no subject was provided'
    const payload: NotifyRequest = {
      channel: 'discord',
      body: longBody,
    }

    await sendDiscord(channelConfig, payload, 'myapp')

    const call = mockFetch.mock.calls[0]
    const body = JSON.parse(call[1].body)

    expect(body.embeds[0].title.length).toBeLessThanOrEqual(53) // 50 chars + '...'
    expect(body.embeds[0].title).toContain('...')
    expect(body.embeds[0].description).toBe(longBody)
  })

  it('includes sender fields in embed when provided', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 204 })

    const payload: NotifyRequest = {
      channel: 'discord',
      body: 'Test message body here',
      sender: {
        name: 'Anna Svensson',
        email: 'anna@example.com',
      },
    }

    await sendDiscord(channelConfig, payload, 'myapp')

    const call = mockFetch.mock.calls[0]
    const body = JSON.parse(call[1].body)
    const fields = body.embeds[0].fields

    const nameField = fields.find((f: any) => f.value === 'Anna Svensson')
    const emailField = fields.find((f: any) => f.value === 'anna@example.com')

    expect(nameField).toBeDefined()
    expect(nameField.inline).toBe(true)
    expect(emailField).toBeDefined()
    expect(emailField.inline).toBe(true)
  })

  it('includes metadata as embed fields', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 204 })

    const payload: NotifyRequest = {
      channel: 'discord',
      body: 'Test message body here',
      metadata: {
        source: 'contact-form',
        url: 'https://myapp.se/about',
      },
    }

    await sendDiscord(channelConfig, payload, 'myapp')

    const call = mockFetch.mock.calls[0]
    const body = JSON.parse(call[1].body)
    const fields = body.embeds[0].fields

    const sourceField = fields.find((f: any) => f.value === 'contact-form')
    const urlField = fields.find((f: any) => f.value === 'https://myapp.se/about')

    expect(sourceField).toBeDefined()
    expect(urlField).toBeDefined()
  })

  it('uses app-specific embed color and footer from config', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 204 })

    const payload: NotifyRequest = {
      channel: 'discord',
      body: 'Test message body here',
    }

    await sendDiscord(channelConfig, payload, 'myapp')

    const call = mockFetch.mock.calls[0]
    const body = JSON.parse(call[1].body)

    expect(body.embeds[0].color).toBe(5814783)
    expect(body.embeds[0].footer.text).toContain('Via My App')
  })

  it('uses default color and footer when config has no defaults', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 204 })

    const payload: NotifyRequest = {
      channel: 'discord',
      body: 'Test message body here',
    }

    await sendDiscord(minimalConfig, payload, 'test-app')

    const call = mockFetch.mock.calls[0]
    const body = JSON.parse(call[1].body)

    expect(body.embeds[0].color).toBeDefined()
    expect(body.embeds[0].footer.text).toContain('Dispatch')
  })

  it('sends POST to correct webhook URL with proper headers', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 204 })

    const payload: NotifyRequest = {
      channel: 'discord',
      body: 'Test message body here',
    }

    await sendDiscord(channelConfig, payload, 'myapp')

    const call = mockFetch.mock.calls[0]

    expect(call[0]).toBe('https://discord.com/api/webhooks/123/abc')
    expect(call[1].method).toBe('POST')
    expect(call[1].headers['Content-Type']).toBe('application/json')
  })

  it('includes timestamp in embed', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 204 })

    const payload: NotifyRequest = {
      channel: 'discord',
      body: 'Test message body here',
    }

    await sendDiscord(channelConfig, payload, 'myapp')

    const call = mockFetch.mock.calls[0]
    const body = JSON.parse(call[1].body)

    expect(body.embeds[0].timestamp).toBeDefined()
  })

  it('returns success:true on successful webhook response', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 204 })

    const payload: NotifyRequest = {
      channel: 'discord',
      body: 'Test message body here',
    }

    const result = await sendDiscord(channelConfig, payload, 'myapp')

    expect(result.success).toBe(true)
  })

  it('returns success:false with error details on webhook failure', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => 'Rate limited',
    })

    const payload: NotifyRequest = {
      channel: 'discord',
      body: 'Test message body here',
    }

    const result = await sendDiscord(channelConfig, payload, 'myapp')

    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
    expect(result.error).toContain('429')
  })

  it('handles network timeout gracefully', async () => {
    mockFetch.mockRejectedValue(new Error('ECONNREFUSED'))

    const payload: NotifyRequest = {
      channel: 'discord',
      body: 'Test message body here',
    }

    const result = await sendDiscord(channelConfig, payload, 'myapp')

    expect(result.success).toBe(false)
    expect(result.error).toContain('ECONNREFUSED')
  })

  it('does not include sender fields when sender is not provided', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 204 })

    const payload: NotifyRequest = {
      channel: 'discord',
      body: 'Test message with no sender information',
    }

    await sendDiscord(channelConfig, payload, 'myapp')

    const call = mockFetch.mock.calls[0]
    const body = JSON.parse(call[1].body)
    const fields = body.embeds[0].fields || []

    const nameField = fields.find((f: any) => f.name === 'Från')
    const emailField = fields.find((f: any) => f.name === 'Email')

    expect(nameField).toBeUndefined()
    expect(emailField).toBeUndefined()
  })
})
