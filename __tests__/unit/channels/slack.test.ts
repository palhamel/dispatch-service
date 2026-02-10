import { describe, it, expect, vi, beforeEach } from 'vitest'
import { sendSlack } from '../../../src/channels/slack.js'
import type { SlackChannelConfig, NotifyRequest } from '../../../src/types.js'

const mockFetch = vi.fn()
global.fetch = mockFetch

const channelConfig: SlackChannelConfig = {
  webhookUrl: 'https://hooks.slack.com/services/T00/B00/xxxx',
  defaultFormat: {
    color: '#36a64f',
    footer: 'Via My App',
  },
}

const minimalConfig: SlackChannelConfig = {
  webhookUrl: 'https://hooks.slack.com/services/T00/B00/yyyy',
}

beforeEach(() => {
  mockFetch.mockReset()
})

describe('sendSlack', () => {
  it('formats message with subject as header block', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200, text: async () => 'ok' })

    const payload: NotifyRequest = {
      channel: 'slack',
      subject: 'Question about next meetup',
      body: 'Hi! I am wondering about the next event in Malmö.',
    }

    await sendSlack(channelConfig, payload, 'myapp')

    const call = mockFetch.mock.calls[0]
    const body = JSON.parse(call[1].body)
    const blocks = body.attachments[0].blocks

    const header = blocks.find((b: any) => b.type === 'header')
    expect(header.text.text).toBe('Question about next meetup')
  })

  it('formats message without subject (uses truncated body as header)', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200, text: async () => 'ok' })

    const longBody = 'This is a longer message body that should be truncated when used as the header title since no subject was provided'
    const payload: NotifyRequest = {
      channel: 'slack',
      body: longBody,
    }

    await sendSlack(channelConfig, payload, 'myapp')

    const call = mockFetch.mock.calls[0]
    const body = JSON.parse(call[1].body)
    const blocks = body.attachments[0].blocks

    const header = blocks.find((b: any) => b.type === 'header')
    expect(header.text.text.length).toBeLessThanOrEqual(53) // 50 chars + '...'
    expect(header.text.text).toContain('...')
  })

  it('includes body as section block', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200, text: async () => 'ok' })

    const payload: NotifyRequest = {
      channel: 'slack',
      body: 'Test message body here',
    }

    await sendSlack(channelConfig, payload, 'myapp')

    const call = mockFetch.mock.calls[0]
    const body = JSON.parse(call[1].body)
    const blocks = body.attachments[0].blocks

    const section = blocks.find((b: any) => b.type === 'section' && b.text)
    expect(section.text.text).toBe('Test message body here')
  })

  it('includes sender fields when provided', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200, text: async () => 'ok' })

    const payload: NotifyRequest = {
      channel: 'slack',
      body: 'Test message body here',
      sender: {
        name: 'Anna Svensson',
        email: 'anna@example.com',
      },
    }

    await sendSlack(channelConfig, payload, 'myapp')

    const call = mockFetch.mock.calls[0]
    const body = JSON.parse(call[1].body)
    const blocks = body.attachments[0].blocks

    const fieldsSection = blocks.find((b: any) => b.type === 'section' && b.fields)
    expect(fieldsSection).toBeDefined()

    const texts = fieldsSection.fields.map((f: any) => f.text)
    expect(texts.some((t: string) => t.includes('Anna Svensson'))).toBe(true)
    expect(texts.some((t: string) => t.includes('anna@example.com'))).toBe(true)
  })

  it('includes metadata as fields', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200, text: async () => 'ok' })

    const payload: NotifyRequest = {
      channel: 'slack',
      body: 'Test message body here',
      metadata: {
        source: 'contact-form',
        url: 'https://myapp.se/about',
      },
    }

    await sendSlack(channelConfig, payload, 'myapp')

    const call = mockFetch.mock.calls[0]
    const body = JSON.parse(call[1].body)
    const blocks = body.attachments[0].blocks

    const fieldsSection = blocks.find((b: any) => b.type === 'section' && b.fields)
    const texts = fieldsSection.fields.map((f: any) => f.text)
    expect(texts.some((t: string) => t.includes('contact-form'))).toBe(true)
    expect(texts.some((t: string) => t.includes('https://myapp.se/about'))).toBe(true)
  })

  it('uses app-specific color and footer from config', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200, text: async () => 'ok' })

    const payload: NotifyRequest = {
      channel: 'slack',
      body: 'Test message body here',
    }

    await sendSlack(channelConfig, payload, 'myapp')

    const call = mockFetch.mock.calls[0]
    const body = JSON.parse(call[1].body)

    expect(body.attachments[0].color).toBe('#36a64f')

    const context = body.attachments[0].blocks.find((b: any) => b.type === 'context')
    expect(context.elements[0].text).toContain('Via My App')
  })

  it('uses default color and footer when config has no defaults', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200, text: async () => 'ok' })

    const payload: NotifyRequest = {
      channel: 'slack',
      body: 'Test message body here',
    }

    await sendSlack(minimalConfig, payload, 'test-app')

    const call = mockFetch.mock.calls[0]
    const body = JSON.parse(call[1].body)

    expect(body.attachments[0].color).toBeDefined()

    const context = body.attachments[0].blocks.find((b: any) => b.type === 'context')
    expect(context.elements[0].text).toContain('Dispatch')
  })

  it('sends POST to correct webhook URL with proper headers', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200, text: async () => 'ok' })

    const payload: NotifyRequest = {
      channel: 'slack',
      body: 'Test message body here',
    }

    await sendSlack(channelConfig, payload, 'myapp')

    const call = mockFetch.mock.calls[0]

    expect(call[0]).toBe('https://hooks.slack.com/services/T00/B00/xxxx')
    expect(call[1].method).toBe('POST')
    expect(call[1].headers['Content-Type']).toBe('application/json')
  })

  it('includes context block with timestamp', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200, text: async () => 'ok' })

    const payload: NotifyRequest = {
      channel: 'slack',
      body: 'Test message body here',
    }

    await sendSlack(channelConfig, payload, 'myapp')

    const call = mockFetch.mock.calls[0]
    const body = JSON.parse(call[1].body)
    const blocks = body.attachments[0].blocks

    const context = blocks.find((b: any) => b.type === 'context')
    expect(context).toBeDefined()
    // Context should include an ISO timestamp
    expect(context.elements[0].text).toMatch(/\d{4}-\d{2}-\d{2}T/)
  })

  it('returns success:true on successful webhook response', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200, text: async () => 'ok' })

    const payload: NotifyRequest = {
      channel: 'slack',
      body: 'Test message body here',
    }

    const result = await sendSlack(channelConfig, payload, 'myapp')

    expect(result.success).toBe(true)
  })

  it('returns success:false with error details on webhook failure', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => 'invalid_token',
    })

    const payload: NotifyRequest = {
      channel: 'slack',
      body: 'Test message body here',
    }

    const result = await sendSlack(channelConfig, payload, 'myapp')

    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
    expect(result.error).toContain('403')
  })

  it('handles network timeout gracefully', async () => {
    mockFetch.mockRejectedValue(new Error('ECONNREFUSED'))

    const payload: NotifyRequest = {
      channel: 'slack',
      body: 'Test message body here',
    }

    const result = await sendSlack(channelConfig, payload, 'myapp')

    expect(result.success).toBe(false)
    expect(result.error).toContain('ECONNREFUSED')
  })

  it('does not include fields section when no sender or metadata', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200, text: async () => 'ok' })

    const payload: NotifyRequest = {
      channel: 'slack',
      body: 'Test message with no sender information',
    }

    await sendSlack(channelConfig, payload, 'myapp')

    const call = mockFetch.mock.calls[0]
    const body = JSON.parse(call[1].body)
    const blocks = body.attachments[0].blocks

    const fieldsSection = blocks.find((b: any) => b.type === 'section' && b.fields)
    expect(fieldsSection).toBeUndefined()
  })
})
