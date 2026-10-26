# UniMate Testing Plan

Living document. Update the status checkboxes and the change log as work progresses.

**Status:** All phases executed 2026-10-21 (report: `docs/qa/2026-10-21-report.md`, 35 findings; Critical/High fixed in PR #8, F-30 fixed 2026-10-26, 27 open). The harness is merged to `main` and extended with every behaviour change (latest: registration form + final admission document, PR #9).
**Last run (2026-10-26, `npm run test:all`):** 79 unit + 254 Playwright (1 skipped), all green; `tsc` and `eslint` clean. "Green" includes the open QA findings, which are written as `test.fail` / `it.fails`.
**Last updated:** 2026-10-26

> **Test branch expiry:** the Neon branch `test/qa-harness` expires **2026-10-28**. After that `npm run test:*` fails until a new branch is created (Neon MCP/console, off `production`), its host is added to `TEST_DB_ALLOWED_HOSTS` and `DATABASE_CONNECTION_STRING` in the gitignored `.env.test` is updated. Extend the expiry instead if you want to avoid this.

## Running the suites

- Prerequisites: Docker Desktop running, then `npm run test:mail` (Mailpit on 1025/8025). Global setup refuses to run without it.
- `npm run test:unit` (Vitest) · `test:api` · `test:e2e` · `test:security` (Playwright, each starts its own `next dev -p 3100`) · `test:all`.
- `npm run test:e2e -- <file>` still runs **every** e2e spec (the script already passes `tests/e2e`); run a single file or test with `npx playwright test tests/e2e/<file>.spec.ts [-g "name"]`.
- Only one `next dev` can run per checkout (Next 16 lock): stop any preview server before running the suites.
- Specs added after the 2026-10-21 QA run: `tests/e2e/register-form.spec.ts` (11 tests, see Phase 2 item 12). The shared helper `tests/helpers/ui.ts` `fillRegistration` ticks the "I confirm this is my final … not an offer letter" checkbox; any new journey that fills the registration form must go through it.

## Manual testing against a throwaway Neon branch (never `.env.local`)

`.env.local` points at production. For hands-on testing of UI changes:
1. Create a Neon branch off `production` (e.g. `preview/<topic>`). It is a full copy of production data incl. student PII and the Neon MCP offers no TTL or schema-only option — **delete it when done**.
2. Create a gitignored `.env.preview`: copy `.env.test` without `DATABASE_CONNECTION_STRING`/`TEST_MODE`, add the new branch's connection string **in single quotes** (it contains `&`), set `APP_URL=http://localhost:3200`, keep `SMTP_HOST=127.0.0.1`, `SMTP_PORT=1025`, `STORAGE_DRIVER=local`, blank Blob variables.
3. `npm run test:mail`, then `set -a; . ./.env.preview; set +a; BLOB_READ_WRITE_TOKEN='' BLOB_STORE_ID='' NODE_OPTIONS=--dns-result-order=ipv4first npx next dev -p 3200`.
4. Prove isolation before trusting it: sign up a throwaway user through the local server, then confirm the row exists on the preview branch and **not** on production (read-only `SELECT`).
5. Clean up: stop the server, `docker stop unimate-mailpit`, delete `.env.preview`, delete the Neon branch.

Done for PR #9 (2026-10-25/26) and cleaned up afterwards.

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
- [x] 12. Registration form resilience and final-document guidance (`tests/e2e/register-form.spec.ts`, added 2026-10-26): oversized / renamed non-PDF rejected inline on pick; missing document error in view; typed details survive a reload; consent submit shows an error and re-enables the button on a mocked 413, aborted request and non-JSON 500; guide lists all five documents before a country is chosen and follows the country (CoE / CAS / Germany fallback); Continue blocked until the "final letter" checkbox is ticked and the tick survives "Back to edit"; "Offer_Letter.pdf" warns but still attaches. Not covered: an API test that registration returns 200 when the acknowledgement email fails (the shared Mailpit cannot be made to fail), and a real Vercel 413 (only reproducible in production).

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
- [x] `lib/countries.ts` consistency (65 entries as documented; every `ACCEPTANCE_DOCS` key is a real country and the five documents CoE/CAS/LOA/I-20/IPA are covered)

## Reporting format

Each run writes `docs/qa/YYYY-MM-DD-report.md` with a summary table and, per finding: ID, severity (Critical / High / Medium / Low / Info), area, repro steps, expected vs actual, evidence (trace / screenshot / request-response), suggested fix. Known-and-accepted behaviour is documented, not silently skipped.

## Later options

- Playwright MCP or Claude in Chrome for exploratory sessions on the test server only
- GitHub Action running unit + API + E2E on every PR against a throwaway Neon branch (`neondatabase/create-branch-action`)
- Scheduled nightly run

## Open items

- [x] Branch created via Neon MCP: `test/qa-harness` (`br-patient-sky-apa7l3ng`), expires 2026-10-28
- [x] Allow-listed host: `ep-round-queen-apdb1d3n-pooler.c-7.us-east-1.aws.neon.tech` (in `.env.test`)
- [x] Harness committed and merged to `main` in PR #8 (2026-10-21)
- [ ] `test/qa-harness` expires 2026-10-28 — extend or recreate before then (see the note at the top)

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
| 2026-10-21 | PR #8 merged and deployed (fixes + harness). |
| 2026-10-26 | PR #9: added `tests/e2e/register-form.spec.ts` (11 tests) and an `ACCEPTANCE_DOCS` unit test; `fillRegistration` ticks the new confirmation checkbox. Full run 79 unit + 254 Playwright green. Documented the manual-testing recipe and the `next dev` lock. |
| 2026-10-26 | F-30 closed: `CLAUDE.md` now says 65 countries; the unit test asserts 65 (no longer `it.fails`). 27 findings open. |
