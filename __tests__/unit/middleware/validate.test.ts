import { describe, it, expect, vi } from 'vitest'
import type { Request, Response, NextFunction } from 'express'
import { createValidateMiddleware } from '../../../src/middleware/validate.js'

const mockRes = () => {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response
  return res
}

const mockReq = (body: Record<string, unknown>, appConfig?: Record<string, unknown>) => {
  const req = {
    body,
    appConfig: appConfig ?? {
      name: 'Test App',
      apiKey: 'dk_test_abc123',
      channels: {
        discord: { webhookUrl: 'https://discord.com/api/webhooks/test/token' },
      },
    },
  } as unknown as Request
  return req
}

const mockNext: NextFunction = vi.fn()

const validate = createValidateMiddleware()

describe('validate middleware', () => {
  it('rejects request without body field', () => {
    const req = mockReq({ channel: 'discord' })
    const res = mockRes()

    validate(req, res, mockNext)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: 'VALIDATION_ERROR',
      })
    )
  })

  it('rejects request without channel field', () => {
    const req = mockReq({ body: 'This is a valid body message' })
    const res = mockRes()

    validate(req, res, mockNext)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: 'VALIDATION_ERROR',
      })
    )
  })

  it('rejects body shorter than 10 characters', () => {
    const req = mockReq({ channel: 'discord', body: 'short' })
    const res = mockRes()

    validate(req, res, mockNext)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: 'VALIDATION_ERROR',
        message: expect.stringContaining('10'),
      })
    )
  })

  it('rejects body longer than 2000 characters', () => {
    const req = mockReq({ channel: 'discord', body: 'x'.repeat(2001) })
    const res = mockRes()

    validate(req, res, mockNext)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: 'VALIDATION_ERROR',
        message: expect.stringContaining('2000'),
      })
    )
  })

  it('rejects subject longer than 200 characters', () => {
    const req = mockReq({
      channel: 'discord',
      body: 'This is a valid body message',
      subject: 'x'.repeat(201),
    })
    const res = mockRes()

    validate(req, res, mockNext)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: 'VALIDATION_ERROR',
        message: expect.stringContaining('200'),
      })
    )
  })

  it('rejects invalid email format in sender.email', () => {
    const req = mockReq({
      channel: 'discord',
      body: 'This is a valid body message',
      sender: { email: 'not-an-email' },
    })
    const res = mockRes()

    validate(req, res, mockNext)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: 'VALIDATION_ERROR',
        message: expect.stringContaining('email'),
      })
    )
  })

  it('rejects sender.name shorter than 2 characters', () => {
    const req = mockReq({
      channel: 'discord',
      body: 'This is a valid body message',
      sender: { name: 'A' },
    })
    const res = mockRes()

    validate(req, res, mockNext)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: 'VALIDATION_ERROR',
      })
    )
  })

  it('rejects sender.name longer than 100 characters', () => {
    const req = mockReq({
      channel: 'discord',
      body: 'This is a valid body message',
      sender: { name: 'x'.repeat(101) },
    })
    const res = mockRes()

    validate(req, res, mockNext)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: 'VALIDATION_ERROR',
      })
    )
  })

  it('rejects channel not configured for app', () => {
    const req = mockReq(
      { channel: 'email', body: 'This is a valid body message' },
      {
        name: 'Test App',
        apiKey: 'dk_test_abc123',
        channels: {
          discord: { webhookUrl: 'https://discord.com/api/webhooks/test/token' },
        },
      }
    )
    const res = mockRes()

    validate(req, res, mockNext)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: 'INVALID_CHANNEL',
      })
    )
  })

  it('accepts valid payload with all optional fields', () => {
    const next = vi.fn()
    const req = mockReq({
      channel: 'discord',
      body: 'This is a valid body message with enough characters',
      subject: 'Test subject',
      sender: { name: 'Anna Svensson', email: 'anna@example.com' },
      metadata: { source: 'contact-form' },
    })
    const res = mockRes()

    validate(req, res, next)

    expect(next).toHaveBeenCalled()
    expect(res.status).not.toHaveBeenCalled()
  })

  it('accepts minimal valid payload (channel + body only)', () => {
    const next = vi.fn()
    const req = mockReq({
      channel: 'discord',
      body: 'This is a valid body message with enough characters',
    })
    const res = mockRes()

    validate(req, res, next)

    expect(next).toHaveBeenCalled()
    expect(res.status).not.toHaveBeenCalled()
  })

  it('sanitizes body and subject before validation', () => {
    const next = vi.fn()
    const req = mockReq({
      channel: 'discord',
      body: '<script>alert("xss")</script>This is a valid body message',
      subject: '<b>Bold subject</b>',
    })
    const res = mockRes()

    validate(req, res, next)

    expect(next).toHaveBeenCalled()
    // Body and subject should be sanitized on the request
    expect(req.body.body).not.toContain('<script>')
    expect(req.body.subject).not.toContain('<b>')
  })

  it('sanitizes sender email', () => {
    const next = vi.fn()
    const req = mockReq({
      channel: 'discord',
      body: 'This is a valid body message with enough characters',
      sender: { name: 'Test User', email: '  Test@Example.COM  ' },
    })
    const res = mockRes()

    validate(req, res, next)

    expect(next).toHaveBeenCalled()
    expect(req.body.sender.email).toBe('test@example.com')
  })
})
