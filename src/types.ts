// Dispatch - Core type definitions

export interface AppConfig {
  name: string
  apiKey: string
  rateLimit?: {
    windowMs: number
    maxRequests: number
  }
  channels: {
    discord?: DiscordChannelConfig
  }
}

export interface DiscordChannelConfig {
  webhookUrl: string
  defaultEmbed?: {
    color?: number
    footer?: string
  }
}

export interface NotifyRequest {
  channel: string
  sender?: {
    name?: string
    email?: string
  }
  subject?: string
  body: string
  metadata?: Record<string, unknown>
}

export interface NotifyResponse {
  success: boolean
  messageId?: number
  channel?: string
  error?: string
  message?: string
  timestamp: string
}

export interface MessageRecord {
  id: number
  app: string
  channel: string
  status: 'pending' | 'sent' | 'failed' | 'spam'
  sender_name: string | null
  sender_email: string | null
  subject: string | null
  body: string
  metadata: string | null
  discord_response: string | null
  error: string | null
  ip_address: string | null
  created_at: string
  sent_at: string | null
}

export interface ChannelResult {
  success: boolean
  response?: unknown
  error?: string
}

export interface SpamCheckResult {
  isSpam: boolean
  category?: string
  reason?: string
}

export interface AppsConfig {
  [appName: string]: AppConfig
}
