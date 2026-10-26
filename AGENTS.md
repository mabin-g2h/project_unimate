<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Working rules for agents

Architecture, schema, hard rules and conventions live in `CLAUDE.md`. This file is only *how to work* here.

### Code
- Extend existing `lib/*` modules instead of adding new helpers. Stay inside Phase 1 scope.
- Next 16: request APIs are async (`await cookies()`, `await params`). `middleware.ts` is deprecated for `proxy.ts`; never have both, and migrate only when asked.
- Routes using Blob or nodemailer set `export const runtime = 'nodejs'`.

### Serverless (Vercel)
- The function freezes once the response returns, so `await` anything that must finish: primary emails, `log()` for auth/admin events, Blob deletes. Secondary effects use `Promise.allSettled` or `.catch(() => {})`, never bare `Promise.all`.
- Request bodies are capped at 4.5 MB: keep the upload caps (2 MB PDF, 1 MB image).
- The cron endpoint must keep failing closed when `CRON_SECRET` is unset.
- New env var: add it to the `CLAUDE.md` env list and tell the user to set it in Vercel.

### Database
- Schema change = update the `CREATE TABLE` in `db/schema.sql` **and** append the next idempotent migration (after 020, with `IF NOT EXISTS`).
- Apply to the Neon **test** branch first. Touch production only with explicit user approval.
- Never run destructive SQL on a connection you haven't verified is the test branch.

### Testing
- Run: `npm run test:unit` (Vitest), `test:api` / `test:e2e` / `test:security` (Playwright), `test:all`. `test:mail` starts Mailpit (Docker).
- Tests use the Neon test branch from the gitignored `.env.test`. Never point them at `.env.local` or production, and don't weaken `assertSafeTestDb`.
- Use the seams, not mocks: `SMTP_HOST`/`SMTP_PORT`, `STORAGE_DRIVER=local`, `RATE_LIMIT_IP_MAX`.
- Every behaviour change ships with a test (bug fix: failing test first).
- Open QA findings are `test.fail` / `it.fails`. When you fix one, remove the marker and update `docs/qa/` and `docs/testing-plan.md`.
- Manual testing never uses `.env.local` (production). Use a throwaway Neon branch + gitignored env file with Mailpit and `STORAGE_DRIVER=local`; recipe in `docs/testing-plan.md`. Only one `next dev` can run per checkout, so stop the preview server before `npm run test:*`.

### Done means
1. `npx tsc --noEmit && npm run lint` pass (`/check`).
2. Relevant tests pass; say which you ran and which you didn't.
3. `/update-unimate` run if routes, schema, env vars, components or flows changed.
4. UI changes checked in the browser, including mobile.
5. `docs/CHANGELOG.md` entry added (what, why/evidence, tests, deploy notes). Move any shipped idea out of `docs/backlog.md`; check both files before designing a feature.

### Git
- Feature branch, never commit to `main`. PRs target `main` (`/new-pr`). Commit only when asked.
- Imperative subject, no `Co-Authored-By` or generated-by trailers. Identity is `mabin-g2h` (`/git-connect` if it looks wrong).
- Never print or write the `origin` URL (it may hold a token).
- Don't commit `.env*`, `.claude/`, `public/__test_uploads/`, `test-results/`, `playwright-report/`.
