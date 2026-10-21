# UniMate Testing Plan

Living document. Update the status checkboxes and the change log as work progresses.

**Status:** All phases executed 2026-10-21. Report: `docs/qa/2026-10-21-report.md` (35 findings, no app fixes made).
**Last updated:** 2026-10-21 (pre-flight corrections + Phase 1)

## Decisions

| Topic | Decision |
|---|---|
| Test database | Neon **branch** (truncated, then seeded with synthetic data only) |
| Email | **Mailpit** in Docker (SMTP 1025, UI/API 8025) |
| File uploads | **Local disk** stand-in for Vercel Blob (test mode only) |
| Driver | **Playwright** E2E and API tests, **Vitest** unit tests |
| Scope | Workflow/E2E + API, Security, Unit |
| Reporting | Markdown report in `docs/qa/YYYY-MM-DD-report.md` |
| Autonomy | **Report only.** Claude does not change app code during test runs; fixes happen after you pick findings |

## How production stays safe

1. Playwright `webServer.env` sets **every** variable explicitly (DB, `JWT_SECRET`, `ADMIN_EMAIL`, `APP_URL`, SMTP, storage, dummy Gmail/Blob/`CRON_SECRET`). Process env beats `.env.local` in Next.js, so the production `.env.local` cannot leak into a test run.
2. Global setup **refuses to run** unless `TEST_MODE=1`, and aborts if the DB host is the production endpoint (`ep-red-queen-apffrdjy`) or not on the allow-list of test-branch hosts. No `TRUNCATE` or seed happens without passing the guard.
3. Separate port **3100** and `APP_URL=http://localhost:3100`, so email links hit the test server.
4. A Neon branch is a copy of production, so it contains real student rows (PII). The first setup step truncates every table, then seeds synthetic data. The branch connection string lives only in a gitignored `.env.test`.

## Test seams (the only app-code changes; env-gated, no production behaviour change)

- `lib/email.ts`: transporter uses `SMTP_HOST` / `SMTP_PORT` (no auth/TLS) when set, otherwise Gmail as today.
- New `lib/storage.ts` wrapping `put` / `del` (used in `app/api/student/register/route.ts` and `app/api/admin/students/[id]/review/route.ts`). `STORAGE_DRIVER=local` writes to gitignored `public/__test_uploads/`; otherwise delegates to `@vercel/blob`.
- `lib/db.ts` needs no change (same Neon HTTP driver works against a branch).

## Planned layout

```
tests/
  fixtures/     dummy passport.pdf, admission.pdf, photo.png, bad.exe, fake-pdf.txt
  helpers/      db.ts (reset + seed), mail.ts (Mailpit API), auth.ts (signup/verify/login)
  e2e/          Playwright browser workflows
  api/          Playwright `request` API + role-matrix tests
  security/     security checks
  unit/         Vitest for lib/*
playwright.config.ts   webServer (port 3100) + env + globalSetup guard
vitest.config.ts
docs/qa/               generated reports
```

Scripts: `test:unit`, `test:e2e`, `test:api`, `test:security`, `test:all`, `test:db:reset`, `test:mail`.

---

## Phase 1: Harness (prerequisite)

- [x] Create Neon test branch (console or API key + neonctl) and allow-list its host
- [x] Start Mailpit in Docker
- [x] `.env.test` (gitignored) and `.gitignore` entries (`.env.test`, `public/__test_uploads/`)
- [x] Install `@playwright/test` (+ browsers, about 300 MB) and `vitest`
- [x] Add seams: SMTP env in `lib/email.ts`, `lib/storage.ts`
- [x] `playwright.config.ts` with webServer env and global-setup guard
- [x] Global setup: guard, truncate, seed (universities / cities / airports / airlines per country, admin user)
- [ ] Test fixtures (dummy PDFs, PNG, bad files): generate in the spec files that need them (Phase 3)
- [x] Smoke test: signup, then verification mail appears in Mailpit
- [x] Harness checks: guard aborts with the prod connection string; reset leaves only seeded data; prod row counts unchanged

## Phase 2: Workflow / E2E scenarios

- [x] 1. Student happy path: signup, verify link from Mailpit, `/register` (country-scoped dropdowns, "Other" fallback, phone, 3 uploads), consent, `/pending`, admin approves with course start date, approval email, dashboard, peers, boarding pass
- [x] 2. Admin bootstrap: `ADMIN_EMAIL` signup, invite admin, accept-invite, demote, revoke pending invite
- [x] 3. Rejection: student sees reason, can re-apply
- [x] 4. Revoke: "Access Suspended", hidden from peers, then unrevoke restores access
- [x] 5. Archive: approve with past start date, "Archive expired students", "Access Ended"; cron with `CRON_SECRET` (abandoned-account purge, 90-day log prune)
- [x] 6. Forgot / reset password: link, expiry, single use, enumeration (always 200)
- [x] 7. Expired / invalid / reused verification link; duplicate signup; unverified login; abandoned-account purge frees the email
- [x] 8. Peers: same country/university, peer notification email, filters, phone-share toggle, "Same flight" / "Same day" badges, flight form (arrival scoped by country, "Other")
- [x] 9. Invite-a-peer: self-invite, existing user, 7-day duplicate, 10/day cap
- [x] 10. Logs tab: every step above shows in Logs and the student timeline; email Sent/Failed pills; filters; email failure logs `email_send_failed` once
- [x] 11. Mobile viewport (390px) pass of login / register / dashboard / admin

## Phase 3: API tests (no browser)

- [x] Auth / role matrix: every route under `app/api/**` x {anonymous, student, other student, admin}
- [x] Validation: missing / oversize / invalid fields, phone, file magic-byte spoofing, size caps (2 MB PDF, 1 MB image), bad dates and ids
- [x] Hard rules: peers and `me` never expose `phone` (unless shared), `password_hash`, `passport_url`, `admission_letter_url`, `rejection_reason`, `reviewed_by`; documents removed after review; `/api/files/*` returns 410
- [x] State machine: review / revoke only from valid states; double-approve; approve without `course_start_date`

## Phase 4: Security testing (test server only)

- [x] AuthZ / IDOR: student calling `/api/admin/*`; student A touching student B's data
- [x] Session / JWT: tampered, `alg:none` and expired tokens rejected; cookie flags
- [x] Hypotheses to confirm: role and status are read from the 7-day JWT, so a demoted admin or revoked / archived student may keep access until the token expires; no logout-all; no CSRF token beyond SameSite
- [x] Brute force / abuse: login, signup, forgot-password, invite-peer have no rate limiting (expected finding)
- [x] Injection / XSS: SQL metacharacters in text fields and log filters; stored XSS in names / reasons in admin UI and emails (several email templates interpolate `name` / `reason` unescaped; verify)
- [x] Uploads: type spoofing, polyglots, huge bodies, filename tricks
- [x] Enumeration: signup 409 vs forgot-password 200, login messages, timing
- [x] Headers / config: security headers present, no CSP (expected finding), `npm audit`, secrets scan of git history
- [ ] Optional: OWASP ZAP baseline scan (Docker): not run

## Phase 5: Unit tests (Vitest)

- [x] `lib/account.ts` (`computeExpiry`, `isValidDateString`, lifespan env)
- [x] Phone parsing / E.164 logic and file-sniffing helper (extract if needed)
- [x] `lib/email.ts` `deliver()` logging (mock transporter: sent / failed rows, rethrow)
- [x] `lib/logger.ts` never rejects
- [x] `lib/countries.ts` consistency

## Reporting format

Each run writes `docs/qa/YYYY-MM-DD-report.md` with a summary table and, per finding: ID, severity (Critical / High / Medium / Low / Info), area, repro steps, expected vs actual, evidence (trace / screenshot / request-response), suggested fix. Known-and-accepted behaviour is documented, not silently skipped.

## Later options

- Playwright MCP or Claude in Chrome for exploratory sessions on the test server only
- GitHub Action running unit + API + E2E on every PR against a throwaway Neon branch (`neondatabase/create-branch-action`)
- Scheduled nightly run

## Open items

- [x] Branch created via Neon MCP: `test/qa-harness` (`br-patient-sky-apa7l3ng`), expires 2026-10-28
- [x] Allow-listed host: `ep-round-queen-apdb1d3n-pooler.c-7.us-east-1.aws.neon.tech` (in `.env.test`)
- [ ] Commit the harness on `test/qa-harness` (branch exists locally, nothing committed yet)

## Pre-flight corrections (2026-10-21, from reading the code)

- Env var is `DATABASE_CONNECTION_STRING` (not `DATABASE_URL`); `.env.local` also holds `BLOB_STORE_ID`, blanked in `webServer.env`.
- Anonymous `/api/*` calls get a 307 redirect to `/login` from middleware (only `/api/auth/*` returns 401): role-matrix tests use `maxRedirects: 0`.
- Email XSS: `reason` is escaped everywhere. Unescaped: first name in ack/approval/rejection/expired emails; first name + university in new-peer email (body and subject); full name + email in the admin registration alert. Payloads must contain no space (only the first token is used).
- Role is read from the JWT only (demoted admin keeps admin until expiry: confirmed by code). Student status is re-checked on `me`/`peers`/`auth/me`, but `flight`, `share-phone` and `invite-peer` have no status/role gate.
- Likely findings to confirm: empty/unset `CRON_SECRET` accepts a request with no Authorization header; `student/register` deletes a rejected profile before validating; login does not check status; approval email failure throws after the DB update; `reviewed_by` FK blocks deleting a reviewing admin.
- Test server runs `next dev -p 3100` (non-Secure cookie, IPv4 DNS patch active); chromium only. A `build && start` run is only for the cookie-flag check.
- Branch is a normal copy of production (the Neon MCP cannot create schema-only branches) and is wiped by the guarded global-setup before any test data exists. Production could not be set to protected (plan limit reached), so the host guard is the safeguard.
- Vitest 3 is used because Vitest 5 requires `@types/node` 22+ and the app pins 20.

## Change log

| Date | Change |
|---|---|
| 2026-10-21 | Plan created and approved (decisions above). No code written. |
| 2026-10-21 | Pre-flight review against the code; plan corrected. Phase 1 harness built and gated (guard unit tests, smoke test, prod counts unchanged). |
| 2026-10-21 | Phases 2-5 executed: 62 unit + 241 Playwright tests pass; 35 findings documented in docs/qa/2026-10-21-report.md. |
| 2026-10-21 | Fixed Critical/High findings F-35, F-31, F-14, F-19 (+F-15, F-16, F-20) on branch `fix/critical-high-findings`; suite 78 unit + 244 Playwright green. Production migrations 019/020 pending. |
| 2026-10-21 | Migrations 019 (users.token_version) and 020 (rate_limits) applied to production; CRON_SECRET confirmed in Vercel. Fix branch not yet committed/deployed. |
