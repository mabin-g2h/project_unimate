# UniMate Change Log

What changed, **why**, and the evidence behind it — newest first. `CLAUDE.md` describes how the system works *now*; this file explains how it got there, so a future change can see the intent behind current behaviour before altering it.

**Rule:** every PR that changes behaviour adds an entry here (see "Done means" in `AGENTS.md`). Entry format: date · PR · what changed · why/evidence · tests · deploy/migration notes · known limits. Older history is in `git log`.

---

## 2026-11-05 — Process: `main` is protected, CI checks are required (PR #20, not yet merged)
**Why:** nothing technical stopped a direct push to `main`, a force push, or a merge with failing checks; the rule lived only in `AGENTS.md` (workflow gap #4). GitHub reported "Branch not protected" and no rulesets.

**What changed (GitHub settings, not in git):** ruleset `Protect main` on the default branch: pull request required (0 approvals; a solo reviewer cannot approve their own PR), required checks `Checks (tsc, lint, unit)` and `Playwright (api, e2e, security)` (a skipped Playwright job counts as passed, so docs-only PRs still merge), force pushes and deletion blocked, no bypass actors (applies to the owner too). Repository merge settings: squash only, head branches auto-deleted after merge. In git: `docs/workflow.md`, `docs/workflow-todo.md` and `AGENTS.md` describe the rule.

**Evidence:** effective rules for `main` listed through the API match the ruleset. **Not done:** Neon production branch protection needs a paid plan (project is on Free). A real direct push was not attempted so as not to risk a stray commit on `main`. **Tests:** docs only; this PR is the first to merge under the rule. **Deploy:** none.

---

## 2026-11-05 — Vercel previews no longer use production data, secrets or email (PR #18, merged)
**Why:** `vercel env ls` showed `DATABASE_CONNECTION_STRING`, `JWT_SECRET`, `GMAIL_*`, `ADMIN_EMAIL`, `CRON_SECRET` and the Blob store set for both Production and Preview. Every pushed branch built a preview that read and wrote live student data, sent real email, accepted production-signed tokens, treated the production admin email as admin and accepted the production cron secret (workflow gap #3). `APP_URL` was Production-only, so preview email links had no base URL.

**What changed**
- **Vercel (infrastructure, not in git):** the 8 shared variables are Production-only. Preview has its own: a Neon `preview` branch, new `JWT_SECRET` and `CRON_SECRET`, `ADMIN_EMAIL=preview-admin@unimate.test`, a fake `GMAIL_USER` (no app password), `SMTP_*` for an Ethereal mail catcher, and a separate Blob store (`BLOB_STORE_ID`, `BLOB_WEBHOOK_PUBLIC_KEY`).
- **Neon `preview` branch** (`br-tiny-star-apci7pli`): created off production, then immediately truncated (users, profiles, flights, logs, invites, rate limits) and given one fake admin. Reference tables (universities, cities, airports, airlines) kept: public data. Migrations must be applied to it by hand when the schema changes.
- `lib/email.ts`: `SMTP_USER`/`SMTP_PASS` with `SMTP_HOST` switch to authenticated SMTP + STARTTLS; without them the plain no-auth seam used by the tests is unchanged. New exported `appUrl()` (`APP_URL`, else `https://$VERCEL_URL`) replaces every `process.env.APP_URL` use in `lib/email.ts` and the admin-invite route.

**Evidence (real preview deploy, 2026-11-05):** a signup through the preview created the user only on the `preview` branch (`signup_success`, `email_sent: verification`); production had 0 such rows and still 31 users. The verification email arrived in the Ethereal inbox and its link and logo pointed at the preview's own URL. The preview URL redirects to Vercel SSO (deployment protection on).

**Tests:** 4 new unit tests (SMTP auth transport, `appUrl()` precedence and fallback); 96 unit tests, `tsc` and lint pass. Playwright not run locally (no change to app behaviour with the test env); CI runs it on the PR. **Deploy:** none for Production (it has no `SMTP_HOST` and keeps `APP_URL`). **Known limits:** Ethereal is a free service with no guarantees (swap the four `SMTP_*` values for Mailtrap if needed); the preview DB does not follow schema migrations automatically; `BLOB_PREVIEW_*` variables auto-created by Vercel for the new store should be unticked from Production in the dashboard.

---

## 2026-11-05 — CI: tests run automatically on every pull request (PR #17, merged)
**Why:** there was no `.github/workflows/`, so unit and Playwright tests only ran when someone ran them by hand and a PR could be merged untested (workflow gap #2).

**What changed:** `.github/workflows/ci.yml`, triggered by `pull_request` to `main`.
- `Checks (tsc, lint, unit)` always runs.
- `Playwright (api, e2e, security)` runs only when the PR touches app code (`app/ lib/ db/ tests/ public/`, `middleware.ts`, `next.config.ts`, `package*.json`, `tsconfig.json`, the Playwright/Vitest/ESLint configs, `vercel.json`, or the workflow itself). Docs-only PRs skip it; a skipped job counts as passed. It is also skipped for fork PRs (no secrets).
- The Playwright job creates a throwaway Neon branch off production (a full copy, so it holds real student rows until it is deleted; the harness TRUNCATEs every table before seeding and the runner never reads them), writes `.env.test` from its pooled connection string, runs Mailpit as a service container, runs `npx playwright test`, and deletes the branch afterwards (`if: always()`, plus a 3-hour `expires_at` as a safety net). The harness guards (`TEST_MODE`, production host marker, host allow-list) are unchanged.
- Neon actions are pinned to commit SHAs. `pull_request` only, never `pull_request_target`.

**Tests:** the workflow can only be proven by a real PR run; YAML and the path filter were checked locally. **Deploy:** needs GitHub secret `NEON_API_KEY` and variable `NEON_PROJECT_ID` (both added). **Known limits:** a PR that adds a migration after 021 is not applied to the CI branch (it is cut from production's schema). A schema-only branch (no student data) was tried first and Neon refused it: `project with a legacy web access role do not support schema-only branches; role:"anonymous"`. Production has the Neon Data API enabled (roles `anonymous`, `authenticator`, `authenticated`, created 2026-10-21) which the app does not use; disabling it would allow schema-only branches (production change, tracked separately).

---

## 2026-11-05 — Tooling: `npm run lint` ignores vendored agent skills (PR #19, not yet merged)
**Why:** `npm run lint` reported 24 problems (23 errors), all in the untracked `.agents/skills/security-audit/*.cjs` (a third-party skill installed from `cloudflare/security-audit-skill`). App code was clean, but the noise made "lint clean" unreadable.

**What changed:** `eslint.config.mjs` ignores `.agents/**`; `.gitignore` lists `/.agents/` and `/skills-lock.json` so the vendored skill is not committed.

**Tests:** `npm run lint` and `npx tsc --noEmit` both exit 0. No app code touched. **Deploy:** none.

---

## 2026-11-05 — Dashboard: remove fake service cards, move "Invite a peer", fix + rewrite the invite email (PR #15, merged)
**Why:** the Accommodation / Forex / Flight cards only fired a toast (no route, no storage). The invite lived in that sidebar, which is hidden below 860 px, so phones could not reach it. Production had one `peer_invites` row ever (2026-06-16) and no `peer_invite` email logs, so recent attempts were being rejected before sending; the error toast (z-index 90) rendered behind the modal backdrop (100/101), so nothing visible happened. Also, the route inserted `peer_invites` before sending, so a failed send still burned the daily cap and the 7-day block.

**What changed**
- `FlyMateExplorer.tsx`: removed the services array and sidebar; single-column layout; "Invite a peer" pill in the heading row (mobile too) plus a CTA in the zero-peers empty state. Deleted unused `Services.tsx`.
- `InvitePeerModal.tsx`: errors shown inline (`role="alert"`); `Toast.tsx` z-index raised above modals.
- `invite-peer/route.ts`: malformed JSON -> 400; failed send deletes its `peer_invites` row.
- `app/page.tsx` stats row: cards were a fixed 5-column grid, so with 4 cards (no flight details yet) a gap was left on the right. Now `auto-fit` columns so the cards span the full boarding-pass width; restyled as white cards with a coloured accent bar.
- `lib/email.ts` `sendPeerInviteEmail`: friendlier, region-neutral copy (no mention of India: UniMate is for students worldwide), no mention of removed services, 3-step how-to-start incl. final admission document, CTA + plain link to `/login?mode=signup`. `app/login/page.tsx` honours `?mode=signup`.

**Tests:** full suite on a throwaway Neon test branch: 92 unit + 265 Playwright (1 skipped: the `ALLOW_MAIL_OUTAGE` test, run separately and passing). The `/login?mode=signup` link, inline invite errors, mobile invite button and the failed-send rollback each have a test. **Deploy:** none (no schema/env change). Real Gmail delivery/spam placement not verified locally.

## 2026-11-05 — Dashboard: share-number switch + reveal-email in peer modal (PR #14, merged)
**Why:** the "Share my number" control was a dot + On/Off text that did not look clickable, and `toggleSharePhone` never checked `res.ok`, so a failed save left the UI "On" with a false success toast (privacy-relevant). The peer modal's Email was a bare `mailto:` link: with no mail client nothing happens and the address is never visible.

**What changed**
- `BoardingPass.tsx` / `globals.css` (`.sw-*`): real `role="switch"` toggle (brand blue when on) with helper text "Peers can see / Only you can see your number"; disabled while saving. `app/page.tsx`: checks `res.ok`, rolls back and shows an error toast on failure.
- `StudentCard.tsx`: Email button now reveals the address inline (`data-testid="peer-email-panel"`) with a Copy button (clipboard API + `execCommand` fallback); no navigation. The `tel:` phone pill is unchanged.

**Tests:** `tests/e2e/dashboard-admin-ui.spec.ts` updated (switch aria-checked, rollback on 500, email reveal). Not yet run: no Neon test branch exists. **Deploy:** none (no schema/env change).

## 2026-11-03 — Registration: browser-side failure logging + automatic submit retry (PRs #11 and #12, merged)
**Why (production evidence, 2026-11-03):** a student (annagrace2204@gmail.com) saw "We could not reach the server" on the consent page at 04:01 UTC. Neon had no `registration_failed/error` row and no profile; Vercel had no `POST /api/student/register` for her (two other students' POSTs that hour are there). So `fetch` threw in her browser and the failure left no trace anywhere. Code review found the same blind spot elsewhere: client-only validation, PDF/photo rejection on pick, 413s, and the page-load `/api/auth/me` / dropdown fetches (no `.catch`, endless spinner). Payload size was ruled out: PDFs are capped at 2 MB each and the photo is resized to ≤400 px, so the real maximum is ~4.1 MB, under Vercel's 4.5 MB limit.

**What changed**
- New `POST /api/student/client-log` + client-safe `lib/client-log.ts`: whitelisted `client_*` events (`submit_network_error/retry/recovered/duplicate_ok/gave_up/http_error`, `file_rejected/unreadable`, `photo_failed`, `validation_error`, `load_failed`) written as category `registration` rows via `log()`, so they show in the Logs tab and the per-student timeline. Metadata is whitelisted and typed (error name/message, attempt, elapsed, byte sizes, online/visibility/connection type, user agent); never phone, URLs, file names or form values. Rate-limited (40/student/h + per-IP); over the limit it answers 204 and stores nothing. Reports that fail while offline wait in a 20-entry `localStorage` queue and are sent on the next `/register*` load or `online` event (this is what would have captured Anna's case).
- `app/register/consent/page.tsx`: automatic retry only when `fetch` throws (no HTTP response): 3 attempts, 1.5 s / 4 s backoff, waits for `online`, visible "retrying (2 of 3)" banner. Any HTTP response is final. A 409 after a network failure is verified via `/api/auth/me` and treated as success when the status is `pending` (response lost after the server saved). 413 / HTML-5xx are now reported too.
- `app/register/page.tsx`: picked PDFs are copied into memory at pick time (guards against Android picker sources becoming unreadable before submit); unreadable file → inline error; `.catch` + "Try again" on the page-load fetches; rejections, validation blocks and photo failures are reported (once per field per visit).
- `app/register/layout.tsx`: flushes the offline queue.
- **Migration 021 — `student_profiles(user_id)` unique index** (`student_profiles_user_id_key`). The register route only checked "already submitted?" *before* the multi-second upload, so a retry arriving while the first request was still running could pass the check and insert a second profile (plus orphaned blobs, incl. a passport). The route now maps the index violation (23505) to the same 409, deletes its own uploads, and logs `registration_failed` / `duplicate_submission`; the consent page already treats that 409 as success after a network failure. Upload file names also get a random suffix so two concurrent requests can never share (and delete) each other's file. Production had 0 duplicate users (23 profiles / 23 users, checked 2026-11-03) so the index can be built safely.
- No env-var or cron change.

**Tests:** `tests/api/client-log.spec.ts` (5), `tests/unit/client-log.test.ts` (8), `tests/unit/register-duplicate.test.ts` (4, forces the 23505 path; 2 of them fail on the old route), two duplicate-submit API tests in `register-validation.spec.ts` (4 simultaneous submits → one 200, three 409, one profile, no orphaned files; DB refuses a second profile), four new consent-submit e2e tests in `tests/e2e/register-form.spec.ts` (retry then give up, recover on retry, lost-response 409 confirmed, first-try 409 not retried); the old "dropped connection" test now expects the 3-attempt message.
**Deploy:** **apply migration 021 to production BEFORE deploying this code** (`CREATE UNIQUE INDEX IF NOT EXISTS student_profiles_user_id_key ON student_profiles (user_id)`; re-run the duplicate check in `db/schema.sql` first). **Applied to production on 2026-11-03** (after re-checking 23 profiles / 0 duplicate users / 0 NULL `user_id`; index valid) and to the Neon test branch `preview/registration-logging`. Preview first, against that separate Neon branch. NB: Vercel *Preview* env vars are identical to Production (same `DATABASE_CONNECTION_STRING`, `JWT_SECRET`, Gmail, Blob store; `APP_URL` is Production-only), so a plain preview build or a pushed branch would use the production database. Use per-deployment `-e` overrides.
**Known limits:** no per-attempt timeout, server-side `formData()`/Blob failures are still unlogged, no client/server correlation id (see `docs/backlog.md` B16-B18). Reports from a page that is killed before the request is sent are lost.

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
