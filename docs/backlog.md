# UniMate Backlog — ideas not built yet

Candidate improvements with the evidence behind them, so the next feature starts from data rather than guesses. Nothing here is committed work. Move an item to `docs/CHANGELOG.md` when it ships, and keep it inside Phase 1 scope (see "Out of Scope" in `CLAUDE.md`). Evidence dates refer to read-only production queries of `student_error_logs` / `student_profiles`.

## Registration funnel (highest value — only 4 of 11 verified students submitted the form, 2026-10-21..25)

| # | Idea | Evidence / why | Notes |
|---|---|---|---|
| B1 | **Reminder email ~24 h before the 48 h form deadline**, deadline stated on the form and verify page | Students are purged silently; one returned 8 h before purge and was deleted anyway. The deadline is never shown to students. | Cron already runs daily; dedupe via an activity-log event (no schema change) |
| B2 | **Clear message when an account was purged** | A purged student sees "Invalid email or password"; "Forgot password" then sends nothing (uniform 200). | Login can't tell purged from never-existed without a tombstone; maybe a generic "create an account" hint |
| B3 | **"No final letter yet" path** (longer window, e.g. ~30 days, + reminder) | Students without a CoE/CAS/LOA/I-20/IPA can't finish, then lose the account at 48 h. Product choice on 2026-10-26: *inform only* for now. | Needs a flag/column (migration 021+) and cron change |
| B4 | **Prefilled re-apply for rejected students** | Both document rejections (10-17, 10-24) never returned; re-apply is a blank 11-field form plus 3 uploads. Passport + letter are deleted after review (Hard Rule 2) so only text fields can be prefilled. | Expose the student's own profile fields via `/api/auth/me` for `rejected` |
| B5 | **Admin "wrong document" rejection template + one nudge email ~3 days later** | Rejection reasons are free text ("register again" vs the app's "re-apply"); no follow-up exists. | Country-specific wording from `ACCEPTANCE_DOCS`; dedupe nudge via the activity log |
| B6 | **Admin visibility of no-form accounts** | Row shows "No form yet" for both unverified and verified-not-submitted; no signup time/deadline; admin student list doesn't auto-refresh (a purged account stayed on screen in a stale tab). | Show verified/created/deadline; hide the "Review →" button for no-form rows |
| B7 | **Funnel events: page views** (register viewed, consent reached) | Steps between "verified" and "submitted" are invisible. The failure half shipped 2026-11-03 (`client_*` events: upload rejected, validation blocked, 413, network failure, load failure — see CHANGELOG); plain "viewed" events are still missing, so drop-off by step can't be counted. | Reuse `/api/student/client-log` + `CLIENT_EVENTS`; keep PII out of metadata |
| B8 | **Login tab defaults to sign-in** | 4 students tried Sign In with an unknown email, then signed up seconds later. | Maybe "No account found — create one" on unknown email (watch enumeration policy: signup already returns 409) |

## Documents and uploads
| # | Idea | Evidence / why | Notes |
|---|---|---|---|
| B9 | **Accept JPG/PNG scans and convert to PDF client-side**, or move uploads to direct-to-Blob | PDF-only + 2 MB cap is a real barrier (2.2 MB letter rejected); students hold phone photos. Real worst case is ~4.1 MB (2 + 2 MB PDFs + a ≤400 px photo), under Vercel's 4.5 MB limit; the nominal 2+2+1 MB maximum (QA test) is not reachable from the form. A 4 MB upload is still long on weak mobile data (see 2026-11-03 incident). | Needs a new dependency or client-side Blob uploads |
| B10 | **Record which document type the student chose** and show it to the admin | The "final letter" confirmation is client-side only and not stored. | Needs a column (migration 021+) |
| B11 | Server-side proof the file is a CoE/CAS/… | Only a human checks content today. | OCR is **out of scope** (CLAUDE.md) |

## Email and operations
| # | Idea | Evidence / why | Notes |
|---|---|---|---|
| B12 | **Resend-verification endpoint + button** | No resend path exists; signup swallows email failures and re-signup returns 409 for up to 12 h. Currently low impact: 11/11 verified. | Keep rate limits (`signup:email` 3/h) |
| B13 | **Make verification link scanner-proof** | The verify link is a GET with side effects; one student hit "Invalid link" after a second click. | e.g. confirm-on-page POST |
| B14 | **Review the Gmail SMTP sender** | Personal Gmail cap (~500/day); a bad-credentials outage on 2026-08-07 broke reset emails. | Consider a transactional provider (AWS SES is out of scope per CLAUDE.md — decide with the owner) |
| B15 | **Longer log retention for diagnosis** | Vercel CLI logs only reach back ~15 min; app logs are the only history. | `student_error_logs` already keeps 90 days |

## Open QA findings
27 findings from `docs/qa/2026-10-21-report.md` remain open (all Critical/High are fixed). They are `test.fail` / `it.fails` markers in `tests/`; fixing one means removing the marker and updating the report and `docs/testing-plan.md`.

## Registration submit hardening (left open on 2026-11-03)

| # | Idea | Evidence / why | Notes |
|---|---|---|---|
| B16 | **Per-attempt timeout on the submit** (e.g. ~90 s) | A stalled upload on weak data hangs on "Submitting…" until the browser gives up; `fetch` has no upload progress, so a slow-but-moving upload could be cut off. | XHR would give progress + timeout |
| B17 | **Log server-side body/Blob failures** in `/api/student/register` | `request.formData()` (truncated upload) and `putFile` (Blob outage) throw uncaught: a 500 with no `student_error_logs` row. | try/catch + `log()` with `reason: 'body_unreadable' / 'blob_failed'` |
| B18 | **Correlation id per submit** shared by client `client_*` rows and the server's `registration_submitted` | Would show "client tried 3 times, server saw 1". | Send an id in the FormData; store in log metadata |
