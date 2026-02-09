import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Request, Response, NextFunction } from 'express'
import { createAuthMiddleware } from '../../../src/middleware/authenticate.js'
import type { AppsConfig } from '../../../src/types.js'

const testApps: AppsConfig = {
  'test-app': {
    name: 'Test Application',
    apiKey: 'dk_test_abc123secret',
    channels: {
      discord: {
        webhookUrl: 'https://discord.com/api/webhooks/test/token',
      },
    },
  },
  'other-app': {
    name: 'Other Application',
    apiKey: 'dk_other_def456secret',
    channels: {
      discord: {
        webhookUrl: 'https://discord.com/api/webhooks/other/token',
      },
    },
  },
}

const ADMIN_KEY = 'dk_admin_supersecretadminkey'

const createMockReq = (headers: Record<string, string> = {}, query: Record<string, string> = {}): Request => ({
  headers,
  query,
  get: (name: string) => headers[name.toLowerCase()],
} as unknown as Request)

const createMockRes = () => {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response
  return res
}

describe('authenticate middleware', () => {
  let authenticate: ReturnType<typeof createAuthMiddleware>
  let next: NextFunction

  beforeEach(() => {
    authenticate = createAuthMiddleware(testApps, ADMIN_KEY)
    next = vi.fn()
  })

  it('returns 401 when no API key is provided', () => {
    const req = createMockReq()
    const res = createMockRes()

    authenticate(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: 'UNAUTHORIZED',
      })
    )
    expect(next).not.toHaveBeenCalled()
  })

  it('returns 401 when invalid API key is provided', () => {
    const req = createMockReq({ 'x-api-key': 'dk_invalid_wrongkey' })
    const res = createMockRes()

    authenticate(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: 'UNAUTHORIZED',
      })
    )
    expect(next).not.toHaveBeenCalled()
  })

  it('resolves app config from valid API key', () => {
    const req = createMockReq({ 'x-api-key': 'dk_test_abc123secret' })
    const res = createMockRes()

    authenticate(req, res, next)

    expect(next).toHaveBeenCalled()
    expect((req as any).appName).toBe('test-app')
    expect((req as any).appConfig).toBeDefined()
    expect((req as any).appConfig.name).toBe('Test Application')
    expect((req as any).isAdmin).toBe(false)
  })

  it('resolves different apps by their keys', () => {
    const req = createMockReq({ 'x-api-key': 'dk_other_def456secret' })
    const res = createMockRes()

    authenticate(req, res, next)

    expect(next).toHaveBeenCalled()
    expect((req as any).appName).toBe('other-app')
    expect((req as any).appConfig.name).toBe('Other Application')
  })

  it('grants admin access with admin API key', () => {
    const req = createMockReq({ 'x-api-key': ADMIN_KEY })
    const res = createMockRes()

    authenticate(req, res, next)

    expect(next).toHaveBeenCalled()
    expect((req as any).isAdmin).toBe(true)
    expect((req as any).appName).toBeUndefined()
  })

  it('rejects API key passed as query parameter', () => {
    const req = createMockReq({}, { apiKey: 'dk_test_abc123secret' })
    const res = createMockRes()

    authenticate(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })

  it('does not leak key details in error response', () => {
    const req = createMockReq({ 'x-api-key': 'dk_invalid_wrongkey' })
    const res = createMockRes()

    authenticate(req, res, next)

    const responseBody = (res.json as any).mock.calls[0][0]
    expect(JSON.stringify(responseBody)).not.toContain('dk_invalid_wrongkey')
    expect(JSON.stringify(responseBody)).not.toContain('dk_test_abc123secret')
    expect(JSON.stringify(responseBody)).not.toContain(ADMIN_KEY)
  })

  it('reads key case-insensitively from header', () => {
    const req = createMockReq({ 'X-API-Key': 'dk_test_abc123secret' })
    // Express lowercases headers, simulate with get()
    req.get = (name: string) => {
      const headers: Record<string, string> = { 'x-api-key': 'dk_test_abc123secret' }
      return headers[name.toLowerCase()]
    }
    const res = createMockRes()

    authenticate(req, res, next)

    expect(next).toHaveBeenCalled()
    expect((req as any).appName).toBe('test-app')
  })
})
