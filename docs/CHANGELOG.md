# UniMate Change Log

What changed, **why**, and the evidence behind it — newest first. `CLAUDE.md` describes how the system works *now*; this file explains how it got there, so a future change can see the intent behind current behaviour before altering it.

**Rule:** every PR that changes behaviour adds an entry here (see "Done means" in `AGENTS.md`). Entry format: date · PR · what changed · why/evidence · tests · deploy/migration notes · known limits. Older history is in `git log`.

---

## 2026-10-26 — Docs sync: changelog, backlog, product rules (this PR)
- Added `docs/CHANGELOG.md` (this file) and `docs/backlog.md` (ideas not built yet, with evidence); added a "Product Rules" and "Where things are documented" section to `CLAUDE.md`; brought `docs/testing-plan.md` up to date (new tests, counts, manual-testing recipe, test-branch expiry).
- Corrected `CLAUDE.md` to say `COUNTRIES` has 65 entries (it said 67) and made the unit test assert 65 — closes QA finding F-30 (27 findings now open).
- Also commits earlier uncommitted housekeeping: a condensed `AGENTS.md` and the QA report marking PR #8 merged/deployed.

## 2026-10-26 — PR #9 `9be2a88` — Fix registration form drop-off; require the final admission document
**Why (production data, read-only Neon queries, 2026-10-25):**
- Since activity logging began (2026-10-21): 11 sign-ups → 11 verified (email delivery healthy, median < 3 min) → only **4 submitted the form**. 3 verified accounts were purged unsubmitted; 3 more were still inside their 48 h window; 3 non-submitters came back and logged in (one three times) yet still didn't finish. So the drop-off is the form, not email.
- One logged upload failure: admission letter 2.2 MB against the 2 MB cap, found only at the last step.
- Both document-based rejections (2026-10-17, 2026-10-24) were for a missing final letter (an email confirmation / "please share your CoE"); **neither student has logged in since**.
- A reported bug: after accepting consents the page stayed on "Submitting…" forever.

**What changed**
- `app/register/consent/page.tsx`: submit wrapped in try/catch/finally, response read as text then parsed; clear messages for 413, dropped connection, non-JSON 5xx; button always re-enabled. (A Vercel 413 is rejected before our route runs, so it never appears in the Logs tab.)
- `app/register/page.tsx`: PDFs checked when picked (PDF only, ≤ 2 MB, `%PDF` header) with inline errors; validation errors scroll into view; photo-resize failure caught; typed details drafted to `sessionStorage` (`DRAFT_KEY` in `app/register/context.tsx`, cleared by `clear()`), files never stored; country-aware "final admission document" field with guidance card, required "this is my final letter, not an offer letter" checkbox, and a non-blocking warning when the file name contains "offer".
- `lib/countries.ts`: new `ACCEPTANCE_DOCS` (Australia CoE, UK CAS, Canada LOA, US I-20, Singapore IPA; others "final admission letter").
- `app/register/consent/page.tsx` wording ("final admission document"); `app/admin/page.tsx` document button shows the expected type (e.g. "View CoE").
- `app/api/student/register/route.ts`: a failed acknowledgement email after the INSERT no longer returns 500 (which caused a confusing 409 on retry); validation label renamed. API field `admission_letter` and column `admission_letter_url` unchanged.

**Tests:** new `tests/e2e/register-form.spec.ts` (11 tests) + unit test for `ACCEPTANCE_DOCS`; `fillRegistration` helper now ticks the confirmation checkbox. New tests fail on the old code, pass on the new. Full run: 79 unit + 254 Playwright (1 skipped) green; `tsc`/`eslint` clean.
**Deploy:** merged and deployed 2026-10-26 (Vercel Ready, SHA matches); no schema, route or env-var changes. Smoke-checked unauthenticated endpoints; the new form was *not* viewed on production (needs a student login).
**Known limits:** the confirmation checkbox is client-side only and the document type is still judged by a human admin; rejection flow, blank re-apply form and the 48 h purge are unchanged (see `docs/backlog.md`). No API test for the email-failure change (the shared Mailpit can't be made to fail without breaking other tests).

## 2026-10-21 — PR #8 `a9a6dbe` — Fix Critical/High QA findings; add QA test harness
- F-35 dependency upgrades (`next` 16.4.2, `nodemailer` 10.1.7; `npm audit --omit=dev` = 0). F-31 cron fails closed when `CRON_SECRET` is unset. F-14 (+F-15/F-16) `getSession()` re-checks the `users` row; `users.token_version` bumped on demote and password reset. F-19 (+F-20) Postgres-backed rate limiting (`lib/rate-limit.ts`, `rate_limits`).
- Added the QA harness (Playwright + Vitest, guarded global setup, Mailpit, local storage seam), `docs/testing-plan.md` and `docs/qa/2026-10-21-report.md` (35 findings; 28 were still open then).
- Migrations **019** (`users.token_version`) and **020** (`rate_limits`) applied to production on 2026-10-21 before deploy; `CRON_SECRET` confirmed set in Vercel.

## 2026-10-21 — PR #7 `e9257f4` — Activity log, email log, per-student timeline in admin Logs tab
- Successful auth/registration/admin events logged (with acting admin), every outgoing email recorded via `lib/email.ts deliver()` (metadata only); Logs tab extracted to `LogsPanel` with filters, row-detail sheet and per-student timeline (`/api/admin/logs/student`).
- Schema: `category` + `actor_email` columns and a `LOWER(email)` index (migration 018); daily cron prunes logs older than 90 days.
- This log is what made the 2026-10-25 funnel analysis possible — keep logging new funnel steps there.
