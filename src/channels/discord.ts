/**
 * Discord channel adapter for Dispatch notification service.
 * Formats messages as Discord embeds and forwards to webhook URL.
 */

import type { DiscordChannelConfig, NotifyRequest, ChannelResult } from '../types.js'

const DEFAULT_COLOR = 5814783 // #58B9FF
const TITLE_MAX_LENGTH = 50

/**
 * Send a notification to Discord as a rich embed via webhook.
 */
export const sendDiscord = async (
  channelConfig: DiscordChannelConfig,
  payload: NotifyRequest,
  appName: string
): Promise<ChannelResult> => {
  const { subject, body, sender, metadata } = payload
  const { webhookUrl, defaultEmbed } = channelConfig

  // Build embed title: use subject, or truncate body
  const title = subject
    ? subject
    : body.length > TITLE_MAX_LENGTH
      ? body.slice(0, TITLE_MAX_LENGTH) + '...'
      : body

  // Build embed fields
  const fields: Array<{ name: string; value: string; inline: boolean }> = []

  if (sender?.name) {
    fields.push({ name: 'Från', value: sender.name, inline: true })
  }

  if (sender?.email) {
    fields.push({ name: 'Email', value: sender.email, inline: true })
  }

  if (metadata) {
    for (const [key, value] of Object.entries(metadata)) {
      if (value !== null && value !== undefined) {
        fields.push({ name: key, value: String(value), inline: true })
      }
    }
  }

  const color = defaultEmbed?.color ?? DEFAULT_COLOR
  const footerText = defaultEmbed?.footer
    ? `${defaultEmbed.footer} | Dispatch`
    : `${appName} | Dispatch`

  const embed = {
    title,
    description: body,
    color,
    fields: fields.length > 0 ? fields : undefined,
    footer: { text: footerText },
    timestamp: new Date().toISOString(),
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] }),
    })

    if (response.ok) {
      return { success: true }
    }

    const errorText = await response.text()
    return {
      success: false,
      error: `Discord webhook returned ${response.status}: ${errorText}`,
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
