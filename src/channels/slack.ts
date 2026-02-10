/**
 * Slack channel adapter for Dispatch notification service.
 * Formats messages as Slack Block Kit and forwards to webhook URL.
 */

import type { SlackChannelConfig, NotifyRequest, ChannelResult } from '../types.js'

const DEFAULT_COLOR = '#58B9FF'
const TITLE_MAX_LENGTH = 50

/**
 * Send a notification to Slack via incoming webhook using Block Kit.
 */
export const sendSlack = async (
  channelConfig: SlackChannelConfig,
  payload: NotifyRequest,
  appName: string
): Promise<ChannelResult> => {
  const { subject, body, sender, metadata } = payload
  const { webhookUrl, defaultFormat } = channelConfig

  // Build title: use subject, or truncate body
  const title = subject
    ? subject
    : body.length > TITLE_MAX_LENGTH
      ? body.slice(0, TITLE_MAX_LENGTH) + '...'
      : body

  const color = defaultFormat?.color ?? DEFAULT_COLOR
  const footerText = defaultFormat?.footer
    ? `${defaultFormat.footer} | Dispatch`
    : `${appName} | Dispatch`

  // Build Block Kit blocks
  const blocks: Array<Record<string, unknown>> = []

  // Header block
  blocks.push({
    type: 'header',
    text: { type: 'plain_text', text: title, emoji: true },
  })

  // Body section
  blocks.push({
    type: 'section',
    text: { type: 'mrkdwn', text: body },
  })

  // Sender + metadata fields
  const fields: Array<{ type: string; text: string }> = []

  if (sender?.name) {
    fields.push({ type: 'mrkdwn', text: `*From:*\n${sender.name}` })
  }

  if (sender?.email) {
    fields.push({ type: 'mrkdwn', text: `*Email:*\n${sender.email}` })
  }

  if (metadata) {
    for (const [key, value] of Object.entries(metadata)) {
      if (value !== null && value !== undefined) {
        fields.push({ type: 'mrkdwn', text: `*${key}:*\n${String(value)}` })
      }
    }
  }

  if (fields.length > 0) {
    blocks.push({ type: 'section', fields })
  }

  // Divider
  blocks.push({ type: 'divider' })

  // Context block (footer + timestamp)
  blocks.push({
    type: 'context',
    elements: [
      { type: 'mrkdwn', text: `${footerText} | ${new Date().toISOString()}` },
    ],
  })

  // Wrap in attachments for color sidebar
  const slackPayload = {
    attachments: [
      {
        color,
        blocks,
      },
    ],
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(slackPayload),
    })

    if (response.ok) {
      return { success: true }
    }

    const errorText = await response.text()
    return {
      success: false,
      error: `Slack webhook returned ${response.status}: ${errorText}`,
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
