<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Working rules for agents

Architecture, schema, security hard rules and conventions live in `CLAUDE.md`. This file covers *how to work* in the repo.

### Before you code
- Read the matching guide in `node_modules/next/dist/docs/` first (Next 16 differs from training data).
- Prefer extending existing modules (`lib/auth.ts`, `lib/logger.ts`, `lib/rate-limit.ts`, `lib/email.ts`, `lib/storage.ts`, `lib/account.ts`) over adding new helpers.
- Stay inside Phase 1 scope; see "Out of Scope" in `CLAUDE.md`.

### Next.js 16 gotchas
- Request APIs are async: `await cookies()`; dynamic routes take `{ params }: { params: Promise<{ id: string }> }` and `await params`.
- `middleware.ts` is deprecated in Next 16 in favour of `proxy.ts` (export `proxy`, Node runtime). Never add both files; migrate (`npx @next/codemod@canary middleware-to-proxy .`) only when asked.
- Middleware is JWT-only and not a security boundary: every API route still calls `getSession()` (re-checks the DB) and checks `role === 'admin'` on admin routes.
- Routes using Vercel Blob or nodemailer set `export const runtime = 'nodejs'`.
- Server components by default; `'use client'` only for hooks/browser APIs.

### Vercel / serverless
- The function is frozen once the response returns. `await` anything that must finish: primary emails, `log()` for auth/admin success events, Blob deletes. Un-awaited sends get killed (caused a prod bug, b5c16b9).
- Secondary effects (admin alerts, peer notifications): `Promise.allSettled` or `.catch(() => {})`. Never bare `Promise.all`.
- Request bodies are capped at 4.5 MB on Vercel. Keep the upload caps (2 MB PDF, 1 MB image); raising them needs client-side Blob uploads.
- The cron endpoint fails closed when `CRON_SECRET` is unset. Keep it that way.
- No secrets in code. Add new env vars to the `CLAUDE.md` env list and tell the user to set them in Vercel.

### Database
- Use the `sql` tagged template only; never concatenate strings.
- Schema change = update the main `CREATE TABLE` in `db/schema.sql` **and** append the next numbered, idempotent migration (after 020; use `IF NOT EXISTS`). Apply to the Neon **test** branch first; touch production only with explicit user approval.
- Never run destructive SQL (DROP/TRUNCATE/DELETE without WHERE) on a connection you haven't verified is the test branch.

### Logging & privacy
- Log failures and key events via `log()` from `lib/logger.ts`. Never log passwords, tokens, reset links, document URLs or phone numbers.

### Testing
- Commands: `npm run test:unit` (Vitest); `test:api` / `test:e2e` / `test:security` (Playwright, starts its own `next dev -p 3100`); `test:all`; `test:mail` (Mailpit in Docker, SMTP 1025 / UI 8025).
- Tests use a dedicated Neon test branch via the gitignored `.env.test` (`TEST_MODE=1`, `TEST_DB_ALLOWED_HOSTS`). Never point tests at `.env.local` or the production host. Don't weaken `assertSafeTestDb`.
- Use the test seams instead of mocking production paths: `SMTP_HOST`/`SMTP_PORT` (email), `STORAGE_DRIVER=local` (Blob), `RATE_LIMIT_IP_MAX` (rate limits).
- Every behaviour change ships with a test: pure logic in `tests/unit`, routes in `tests/api`, flows in `tests/e2e`, authz/abuse cases in `tests/security`.
- Open QA findings are encoded as `test.fail` / `it.fails`. When you fix one, remove the marker (otherwise it reports "unexpectedly passed") and update `docs/qa/` and `docs/testing-plan.md`.
- Bug fix: write the failing test first, then the fix.

### Definition of done
1. `npx tsc --noEmit && npm run lint` (or `/check`).
2. Relevant test suites pass; state which you ran and which you didn't.
3. Run `/update-unimate` if you changed routes, schema, env vars, components or flows, so `CLAUDE.md` and `db/schema.sql` stay accurate.
4. UI changes: verify in the browser (dev server on port 3000), including the mobile layout.

### Git & PRs
- Work on a feature branch, never commit directly to `main`. PRs target `main` (`/new-pr`).
- Commit only when asked. Imperative, descriptive subject; no `Co-Authored-By` or generated-by trailers.
- Git identity is `mabin-g2h`; run `/git-connect` if identity or remote looks wrong. Never print or write the `origin` URL (it may embed a token).
- Don't commit `.env*`, `.claude/`, `public/__test_uploads/`, `test-results/`, `playwright-report/`.
- Keep the managed `nextjs-agent-rules` block above intact; `next dev` re-adds it.
