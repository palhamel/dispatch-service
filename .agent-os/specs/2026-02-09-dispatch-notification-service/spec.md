# Spec Requirements Document

> Spec: Dispatch Notification Service
> Created: 2026-02-09
> Status: Planning

## Overview

Transform the existing Express.js Discord webhook proxy into "Dispatch" - a general-purpose notification microservice that accepts messages from multiple apps via a unified API and routes them to configured channels (Discord initially, with email and other channels as future expansion). The service will log all messages to SQLite and support per-app configuration with manual API keys.

## User Stories

### App Developer Sends Contact Form to Discord

As an app developer, I want to send contact form submissions to a Discord channel via a simple API call, so that I don't need to expose webhook URLs or third-party API keys in my frontend code.

A developer configures their app in Dispatch's config file with an API key and Discord webhook URL. When a user submits a contact form, the frontend sends a POST request to `POST /api/notify` with the app's API key, the channel ("discord"), and the message payload. Dispatch validates the request, checks spam filters, logs the message to SQLite, formats it as a Discord embed, and forwards it to the configured webhook. The developer never touches Discord API details.

### Platform Owner Monitors Messages

As the platform owner, I want to see a log of all messages sent through Dispatch, so that I can monitor usage across apps and troubleshoot delivery failures.

The owner queries `GET /api/logs` with the admin API key to see recent messages with status (sent/failed), timestamps, app name, and channel. Failed messages show error details for debugging.

### Multi-App Isolation

As a developer running multiple sites, I want each app to have its own API key and channel configuration, so that messages from different apps are isolated and routed to the correct Discord channels.

Each app is defined in a config file with its own API key, rate limit, and channel settings. App "kodfika" sends contact form messages to one Discord channel, while app "portfolio" sends to another. Rate limits are enforced per app independently.

## Spec Scope

1. **Generic notification endpoint** - `POST /api/notify` that accepts app identifier, channel, and message payload with validation
2. **Discord channel adapter** - Generalize existing Discord webhook forwarding to support per-app webhook URLs and message formatting
3. **Multi-app configuration** - JSON config file (`config/apps.json`) with per-app API keys, allowed channels, rate limits, and channel settings
4. **SQLite message logging** - Log all incoming messages with delivery status, timestamps, and error details using better-sqlite3
5. **Admin endpoints** - `GET /api/logs` and `GET /api/status` for monitoring message history and service health

## Out of Scope

- Email channel (planned for future expansion, not this spec)
- App self-registration API (API keys are managed manually in config file)
- Message retry/queue system (failed messages are logged but not retried)
- Frontend UI for admin/monitoring (use API endpoints or SQLite directly)
- Webhook signature verification for incoming webhooks from external services
- Migration of Kodfika contact form (separate spec - Dispatch must be built first)

## Expected Deliverable

1. A working `POST /api/notify` endpoint that accepts messages from any configured app and delivers them to Discord, verifiable with curl commands
2. SQLite database logging all messages with status, queryable via `GET /api/logs` admin endpoint
3. Multi-app support where two different API keys route to two different Discord webhooks, verifiable by sending test messages from different "apps"

## Spec Documentation

- Tasks: @backend/.agent-os/specs/2026-02-09-dispatch-notification-service/tasks.md
- Technical Specification: @backend/.agent-os/specs/2026-02-09-dispatch-notification-service/sub-specs/technical-spec.md
- API Specification: @backend/.agent-os/specs/2026-02-09-dispatch-notification-service/sub-specs/api-spec.md
- Database Schema: @backend/.agent-os/specs/2026-02-09-dispatch-notification-service/sub-specs/database-schema.md
- Tests Specification: @backend/.agent-os/specs/2026-02-09-dispatch-notification-service/sub-specs/tests.md
