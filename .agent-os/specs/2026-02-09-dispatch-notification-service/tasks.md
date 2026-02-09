# Spec Tasks

These are the tasks to be completed for the spec detailed in @backend/.agent-os/specs/2026-02-09-dispatch-notification-service/spec.md

> Created: 2026-02-09
> Status: Ready for Implementation

## Tasks

- [x] 1. Project restructure and tooling setup
  - [x] 1.1 Create new directory structure (channels/, middleware/, db/, utils/, config/, data/, __tests__/)
  - [x] 1.2 Install new dependencies (better-sqlite3, vitest, supertest)
  - [x] 1.3 Configure Vitest in package.json with test scripts
  - [x] 1.4 Create .env.example with all new environment variables
  - [x] 1.5 Create config/apps.example.json with documented template
  - [x] 1.6 Update .gitignore (data/*.db, config/apps.json)
  - [x] 1.7 Verify project builds and empty test suite runs

- [x] 2. SQLite database layer
  - [x] 2.1 Write tests for db/index.ts (table creation, WAL mode, in-memory for tests)
  - [x] 2.2 Implement db/index.ts - SQLite connection with auto-schema creation
  - [x] 2.3 Write tests for db/messages.ts (logMessage, updateStatus, getMessages, getStats)
  - [x] 2.4 Implement db/messages.ts - message CRUD operations
  - [x] 2.5 Verify all database tests pass (24 tests green)

- [x] 3. Authentication middleware (security-critical)
  - [x] 3.1 Write tests for middleware/authenticate.ts and config/loader.ts (17 tests)
  - [x] 3.2 Implement config/loader.ts - loadAppsConfig, validateAppsConfig, buildKeyIndex
  - [x] 3.3 Create test fixture __tests__/fixtures/apps.json
  - [x] 3.4 Implement middleware/authenticate.ts - X-API-Key header only, app resolution, admin key
  - [x] 3.5 Verify all 41 tests pass, query param auth fully rejected

- [x] 4. Input validation and sanitization (security-critical)
  - [x] 4.1 Write tests for utils/sanitize.ts (HTML stripping, XSS prevention, length limits, null handling, Swedish chars)
  - [x] 4.2 Implement utils/sanitize.ts - input sanitization with strict HTML removal
  - [x] 4.3 Write tests for middleware/validate.ts (required fields, length limits, email format, channel existence)
  - [x] 4.4 Implement middleware/validate.ts - payload structure validation with clear error messages
  - [x] 4.5 Verify all 71 tests pass (30 new validation tests)

- [x] 5. Spam detection (security)
  - [x] 5.1 Write tests for utils/spam.ts (medical, gambling, adult, marketing, URLs, HTML, clean Swedish/English text)
  - [x] 5.2 Implement utils/spam.ts - spam detection adapted from Kodfika's useSendContactForm.js patterns
  - [x] 5.3 Verify all 90 tests pass, no false positives on normal Swedish text

- [x] 6. Discord channel adapter
  - [x] 6.1 Write tests for channels/discord.ts (embed formatting, sender fields, metadata, success/failure handling, timeout)
  - [x] 6.2 Implement channels/discord.ts - format message as Discord embed and forward to webhook URL
  - [x] 6.3 Verify all 102 tests pass with mocked fetch

- [x] 7. Main notify endpoint and server refactor
  - [x] 7.1 Write integration tests for POST /api/notify (success, auth errors, validation errors, spam, channel errors)
  - [x] 7.2 Create src/app.ts factory + src/server.ts entry point replacing old server.js
  - [x] 7.3 Implement POST /api/notify route handler (authenticate → validate → spam check → log → send → update status)
  - [x] 7.4 Integration tests verify full flow: request → database log → Discord delivery → response
  - [x] 7.5 Verify all 117 tests pass (15 new integration tests)

- [ ] 8. Admin endpoints
  - [ ] 8.1 Write integration tests for GET /api/logs (admin auth, pagination, filters)
  - [ ] 8.2 Write integration tests for GET /api/status (admin auth, per-app stats)
  - [ ] 8.3 Write integration tests for POST /api/test/:channel (admin auth, test message delivery)
  - [ ] 8.4 Implement GET /api/logs with query filters and pagination
  - [ ] 8.5 Implement GET /api/status with database aggregation
  - [ ] 8.6 Implement POST /api/test/:channel with test payload
  - [ ] 8.7 Update GET /health to reflect new service name and version
  - [ ] 8.8 Verify all admin endpoint tests pass

- [ ] 9. Security hardening and final verification
  - [ ] 9.1 Security audit: verify no API keys can leak via query params, logs, or error responses
  - [ ] 9.2 Security audit: verify all user input is sanitized before database storage and Discord forwarding
  - [ ] 9.3 Security audit: verify error responses in production never expose stack traces or internal details
  - [ ] 9.4 Security audit: verify Helmet CSP headers are correct for new endpoints
  - [ ] 9.5 Review CORS configuration for production origins
  - [ ] 9.6 Run full test suite - all tests must pass
  - [ ] 9.7 Manual curl testing: send test message, verify Discord delivery, check database log
  - [ ] 9.8 Update README.md to reflect new Dispatch service documentation
