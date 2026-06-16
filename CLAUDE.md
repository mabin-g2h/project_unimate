@AGENTS.md

# UniMate

India's student community platform for studying abroad. Connects Indian students from offer letter through graduation.

## Commands

```bash
npm run dev          # Start development server (port 3000)
npm run build        # Production build
npm run lint         # ESLint check
npx tsc --noEmit     # TypeScript check (no typecheck script in package.json)
```

Run `npx tsc --noEmit && npm run lint` before marking any task complete.

## Tech Stack

- **Framework**: Next.js 16.2.7, React 19.2.4, TypeScript 5.9.3 strict mode
- **Styling**: Tailwind CSS 4, inline CSS variables (`--teal #0942BD`, `--coral #EE5B36`, `--ink #1D1D1F`, `--cream #F5F5F7`, etc.) — Apple-inspired palette; SF Pro system font stack
- **Database**: Neon serverless PostgreSQL (`@neondatabase/serverless`) — raw SQL via tagged `sql` template literal
- **Auth**: Custom JWT — `jose` library, HS256, 7-day expiry, stored as `auth-token` HttpOnly cookie
- **Passwords**: `bcryptjs` (rounds: 12)
- **Email**: Nodemailer via Gmail SMTP
- **File storage**: Vercel Blob (`@vercel/blob`) — public URLs stored in DB; `put()` on upload, `del()` on admin review
- **IDs**: `uuid` v14 (used for email-verification and password-reset tokens)
- **Phone**: `react-phone-number-input` (country-dropdown input on registration) + `libphonenumber-js` — format-only validation (no OTP/SMS); numbers stored normalised as `+E.164`, validated client-side and again in `/api/student/register`

## Project Structure

```
/app
  page.tsx                               # Home dashboard (approved students) — live data from DB
  layout.tsx                             # Root layout; system font stack (SF Pro Display/Text/Mono) via CSS variables — no Google Fonts
  /login/page.tsx                        # Combined login + signup toggle
  /register/layout.tsx                   # 'use client' layout — provides RegistrationContext for /register and /register/consent
  /register/context.tsx                  # RegistrationContext + RegistrationProvider; holds form fields + File objects in memory across page navigation
  /register/page.tsx                     # Student registration form (10 fields incl. city + 3 file uploads; course/programme is a free-text input — students type it from their admission letter); University + City dropdowns are country-scoped — disabled until Country of education is chosen, fetch only that country's options (?country=), reset on country change, with an "Other — type it in yourself" fallback; on submit saves to context and navigates to /register/consent
  /register/consent/page.tsx             # Consent page: application summary + 4 required checkboxes; POSTs to /api/student/register on accept
  /admin/page.tsx                        # Admin review portal (3 tabs: Student Applications, Manage Dropdowns incl. cities, Manage Admins). Manage Dropdowns tags each university/city with a country (shown as a chip; ⚠ warning for untagged rows). Review modal's University/City selects are country-scoped (reset + refetch on country change) with an "Other" free-text fallback
  /accept-invite/page.tsx                # Admin invite acceptance — set password to activate admin account
  /pending/page.tsx                      # Application status view (pending / rejected)
  /verify-email/page.tsx                 # Email verification landing
  /forgot-password/page.tsx              # Request a password-reset link by email
  /reset-password/page.tsx               # Set a new password from a reset-link token
  /api/
    /auth/signup/route.ts                # POST — create account, hash password, send verification email; purges all expired+unverified rows before duplicate check; 12-hour expiry window
    /auth/login/route.ts                 # POST — authenticate, set auth-token cookie
    /auth/logout/route.ts                # POST — clear cookie
    /auth/me/route.ts                    # GET  — return current session user + registration status + email_verified flag
    /auth/cleanup/route.ts               # GET  — Vercel cron endpoint (Bearer CRON_SECRET); deletes all expired unverified user rows; runs daily at midnight UTC
    /auth/verify-email/route.ts          # GET  — validate token; deletes user row if expired, then redirects; sets session and redirects on success
    /auth/accept-invite/route.ts         # POST — validate invite token, create admin user (email_verified=true, role='admin'), set session cookie; deletes invite row on success
    /auth/forgot-password/route.ts       # POST — issue uuid reset token (1-hour expiry) for verified users, email it (fire-and-forget); always returns 200 to prevent email enumeration
    /auth/reset-password/route.ts        # POST — validate reset token + expiry, bcrypt-hash new password (min 8 chars), clear token
    /student/register/route.ts           # POST — FormData with files + consents_accepted flag; validates consent, inserts student_profiles row with consented_at = NOW(); fires admin notification email (fire-and-forget)
    /admin/students/route.ts                          # GET    — list all student applications (admin only)
    /admin/students/[id]/review/route.ts              # POST   — approve/reject; deletes passport+admission letter from Blob; sends approval/rejection email; on approve also notifies all other approved students at the same university (awaited via Promise.allSettled)
    /admin/students/[id]/profile/route.ts             # PATCH  — admin edit of a student's profile fields (name, phone, country, university, degree, course, intake, city)
    /admin/admins/route.ts                            # GET    — list admin users + pending invites; POST — send admin invite email (48-hour token)
    /admin/admins/[id]/route.ts                       # DELETE — demote admin to student (cannot remove self)
    /admin/admins/invite/[id]/route.ts                # DELETE — revoke a pending admin invite
    /admin/options/universities/route.ts              # POST   — create university with required country (admin only)
    /admin/options/universities/[id]/route.ts         # DELETE — remove university (admin only)
    /admin/options/universities/[id]/courses/route.ts # POST   — add course to university (admin only)
    /admin/options/courses/[id]/route.ts              # DELETE — remove course (admin only)
    /admin/options/airports/route.ts                  # POST   — create airport (admin only)
    /admin/options/airports/[id]/route.ts             # DELETE — remove airport (admin only)
    /admin/options/airlines/route.ts                  # POST   — create airline (admin only)
    /admin/options/airlines/[id]/route.ts             # DELETE — remove airline (admin only)
    /admin/options/cities/route.ts                    # POST   — create city with required country (admin only)
    /admin/options/cities/[id]/route.ts               # DELETE — remove city (admin only)
    /files/[filename]/route.ts                        # Retired — returns 410; files now served directly from Vercel Blob URLs
    /options/universities/route.ts                    # GET    — list universities (id, name, country); optional ?country= filter (authenticated students)
    /options/airports/route.ts                        # GET    — list airports (authenticated students)
    /options/airlines/route.ts                        # GET    — list airlines (authenticated students)
    /options/cities/route.ts                          # GET    — list destination cities (id, label, country); optional ?country= filter (authenticated students)
    /students/me/route.ts                # GET  — own approved profile (incl. city, country_of_education) + flight details
    /students/peers/route.ts             # GET  — all approved peers heading to my country_of_education (phone masked unless share_phone); client filters by university/city/course/degree/intake
    /students/flight/route.ts            # GET/POST — upsert own flight details
    /students/share-phone/route.ts       # PUT  — toggle share_phone boolean
    /students/invite-peer/route.ts       # POST — student-to-student email invite; validates email, blocks self/existing-user/recent-dup (7-day), caps 10/student/day, records peer_invites row, awaits sendPeerInviteEmail
  /components/
    AppLogo.tsx                          # Shared logo component — renders public/unimatelogo.png via next/image (unoptimized); accepts height prop
    Navbar.tsx                           # Sticky nav — logo + Verified badge + sign-out button (no user name/avatar; takes no props)
    BoardingPass.tsx                     # Boarding-pass card — real profile (incl. city, round profile-photo avatar) + flight details; accepts FlightDetails + profilePictureUrl props; blue stub shows an animated "BOARDS IN N DAYS" countdown pill (computed client-side from travel_date) with a plane-along-runway animation (CSS in globals.css)
    FlyMateExplorer.tsx                  # Peer discovery UI — 2-col layout (filters horizontal row + right services sidebar); live DB data; University/City/Course/Degree/Intake dropdowns + active-filter chips + search/sort; services data inlined (4 cards, icon+title+tag+CTA only) plus an "Invite a peer" card that opens InvitePeerModal; mobile filter drawer; peer grid uses minmax(170px,1fr); accepts Peer[] prop
    StudentCard.tsx                      # Compact portrait tile (88px avatar, name, university, city — click to open detail modal); exports Peer interface; includes Avatar sub-component; Apple-style sheet modal with backdrop blur, Escape key close, bottom-sheet on mobile with safe-area inset
    FlightDetailsModal.tsx               # Modal form: departure, arrival, date, airline; exports FlightDetails interface
    InvitePeerModal.tsx                  # Invite-a-peer modal — single email input; POSTs to /api/students/invite-peer; Apple-style sheet (backdrop blur, Escape close, mobile bottom-sheet); accepts onClose + onToast props
    Services.tsx                         # Services hub (4 cards) — NOT rendered from page.tsx; service card data is inlined in FlyMateExplorer for the right sidebar
    Toast.tsx                            # useToast() hook, auto-dismiss 3.6s
  /data/
    students.ts                          # Static demo data (unused; kept for reference)
/lib/
  db.ts        # export const sql = neon(process.env.DATABASE_CONNECTION_STRING!)
  auth.ts      # signToken, verifyToken, getSession, makeSessionCookieOptions; SessionPayload interface
  email.ts     # sendVerificationEmail, sendRegistrationAcknowledgement, sendAdminRegistrationNotification, sendApprovalEmail, sendRejectionEmail, sendAdminInviteEmail, sendPasswordResetEmail, sendNewPeerNotificationEmail, sendPeerInviteEmail
  countries.ts # export const COUNTRIES — canonical 67-country list; shared by /register and /admin (country dropdowns + university/city country-tagging) so filter strings stay identical
/middleware.ts                           # JWT protection — public allowlist + /admin role guard + /register emailVerified guard
/private_uploads/                        # Local dev placeholder only — production files live in Vercel Blob
```

## Database Schema

Full schema and migration history: [`db/schema.sql`](./db/schema.sql)

Tables: `users` (includes `password_reset_token VARCHAR(255)`, `password_reset_expires TIMESTAMPTZ` for the forgot-password flow), `student_profiles` (includes `share_phone BOOLEAN DEFAULT false`, `consented_at TIMESTAMPTZ`, `city VARCHAR(255)` — destination city, nullable for pre-feature rows, `gender VARCHAR(10)`), `flight_details`, `universities` (id, name, `country VARCHAR(100)`, created_at; `UNIQUE(name, country)`), `courses` (legacy, unused), `airports`, `airlines`, `cities` (id, label, `country VARCHAR(100)`, created_at; `UNIQUE(label, country)`), `admin_invites` (UUID PK, email, token, expires_at, invited_by → users), `peer_invites` (UUID PK, email, invited_by → users, created_at — no token/expiry; powers per-student rate-limit + dedup + attribution for the Invite-a-peer feature). On `universities`/`cities`, `country` is nullable — pre-feature rows are NULL until re-tagged in admin and won't appear in any country-filtered dropdown.

## Hard Rules — Never Break These

1. **Peer directory queries** must never return: `phone`, `password_hash`, `passport_url`, `admission_letter_url`, `rejection_reason`, `reviewed_by`. Safe fields: `full_name`, `email`, `course_name`, `intake_month`, `intake_year`, `country_of_origin`, `degree_level`, `university_name`, `city`, `profile_picture_url`.

2. **Sensitive documents** (`passport_url`, `admission_letter_url`) must be deleted from Vercel Blob via `del()` immediately after admin approve or reject. `profile_picture_url` is intentionally retained — it is displayed on the dashboard and in the peer directory. See `/api/admin/students/[id]/review/route.ts`.

3. **All API routes** must call `getSession()` before any database operation. Public exceptions: `POST /api/auth/signup`, `POST /api/auth/login`, `GET /api/auth/verify-email`, `POST /api/auth/accept-invite`, `POST /api/auth/forgot-password`, `POST /api/auth/reset-password` (the last two are token-gated, not session-gated).

4. **Admin routes** (`/admin/*` and `/api/admin/*`) must check `session.role === 'admin'`. Student sessions must never access admin routes.

5. **File URLs** stored in the DB (`passport_url`, `admission_letter_url`, `profile_picture_url`) are full Vercel Blob `https://` URLs. Use them directly as `src`/`href` — do not route through `/api/files/`. Profile pictures are public blob URLs visible to any authenticated student; passport and admission letter blobs are deleted after review.

6. **Env vars** are accessed via `process.env` directly. Never hardcode secrets or connection strings. All vars must be present at runtime — the non-null assertions (`!`) will throw if missing.

## Auth Middleware Logic

```
Public (no auth):  /login, /verify-email, /accept-invite, /forgot-password, /reset-password, /api/auth/*
Admin only:        /admin/* → role must be 'admin', else redirect /
Register gate:     /register/* → JWT must have emailVerified=true, else redirect /login
Protected:         all other routes → valid auth-token cookie required, else redirect /login
```

Post-login redirect logic (client-side `useEffect` via `/api/auth/me`):
- `role === 'admin'` → `/admin`
- No `registration_status` (no profile yet) → `/register`
- `registration_status !== 'approved'` → `/pending`

## Environment Variables

```
DATABASE_CONNECTION_STRING   # Neon PostgreSQL connection string
JWT_SECRET                   # Signing key for auth-token JWT
GMAIL_USER                   # Gmail sender address
GMAIL_APP_PASSWORD           # Gmail app password (not account password)
APP_URL                      # Base URL used in email links (e.g. http://localhost:3000)
ADMIN_EMAIL                  # Email auto-assigned role='admin' at signup
BLOB_READ_WRITE_TOKEN        # Vercel Blob store token (auto-set by Vercel; add to .env.local for dev)
CRON_SECRET                  # Secret for /api/auth/cleanup cron endpoint — set in Vercel project settings + .env.local
```

## Conventions

- Server components by default. Add `'use client'` only when using hooks or browser APIs.
- Primary email sends (to the acting user) are awaited. Secondary notifications (admin alert on registration, peer alerts on approval) are either fire-and-forget with `.catch(() => {})` or awaited via `Promise.allSettled` — never use bare `Promise.all` for secondary sends.
- Design tokens are CSS variables — use `var(--teal)`, `var(--coral)`, etc. rather than hardcoding colours.
- Neon `sql` is a tagged template literal with automatic parameterisation — always pass values as template interpolations, never via string concatenation.
- Catch database errors as `Error` — check `err.message` for Neon constraint violations (unique email → Postgres code `23505`).

## Known Gaps (not MVP-blocking for auth/admin flows)

- **Server-side field validation** in `/api/student/register` checks all required fields are present (returns 400 if blank); `course_name` is trimmed + whitespace-collapsed on save; `phone` is parsed/validated with `libphonenumber-js` and stored as `+E.164` (returns 400 if invalid). No max-length enforcement yet beyond the `VARCHAR(255)` column. Phone is **format-validated only** — not ownership-verified (no OTP); the admin review + passport upload covers authenticity.
- **`student_profiles.city` is nullable for pre-feature rows** — profiles approved before the city feature have `city = NULL` and won't surface in anyone's "My city" scope until set. An admin can fill it retroactively via the review-modal profile edit (PATCH `/api/admin/students/[id]/profile`); there is still no student-facing self-edit flow.
- **Reference-table `country` is nullable and re-tag-only** — `universities`/`cities` rows created before the country-scoping feature have `country = NULL`, so they appear in no country-filtered dropdown until an admin sets a country. There is no inline edit on these rows — admins delete and re-add with a country (shown by a ⚠ "No country — re-add" chip in Manage Dropdowns).

## Phase 1 Scope — What Exists

- Signup → email verification (12-hour expiry; expired rows auto-deleted by cron + inline on next signup) → login/logout (with sign-out button in Navbar)
- Forgot/reset password: `/forgot-password` requests a reset link (uuid token, 1-hour expiry, stored on `users.password_reset_token/expires`); `/reset-password` validates the token and sets a new bcrypt-hashed password. Forgot-password always returns 200 to prevent email enumeration; only verified accounts receive a link
- Student registration form with passport, admission letter, and profile photo upload (photo resized client-side to max 400 px before upload)
- Admin review queue (approve / reject with reason + file deletion)
- Email notifications: verification link, registration acknowledgement, approved, rejected; admin alerted on new registration; all approved peers at the same university notified when a new student from that university is approved
- File uploads via Vercel Blob (public URLs); sensitive documents deleted from Blob after admin review
- Live peer directory: real approved students heading to the same destination country, profile photos, email + opt-in phone
- Dashboard peer directory: the peers query (`/api/students/peers`) returns **every approved student heading to my `country_of_education`**; the default dashboard view shows them all. `FlyMateExplorer` then narrows client-side with five composable "pick any" dropdowns — **University, City, Course, Degree, Intake** (options derived from the country pool, default "All") — plus active-filter chips + "Clear all", search, sort, and a phone-share toggle. 2-col layout: filters+peer grid on left, compact service sidebar on right (collapses to 1-col on narrow viewports). Mobile: filters hidden behind a "Filters" toggle button that opens a fixed drawer overlay. Selecting your own university/city gives "same university"/"same city"; University+City together give campus-level precision. Own city shown on the boarding pass; each peer card shows the peer's university + city
- Peer cards are compact portrait tiles (88px avatar, name, university, city only). Clicking a tile opens an Apple-style detail sheet modal with full info (programme, intake, flight line, degree/country tags) and Email + Phone action buttons (phone opens a `tel:` call link). Modal is a bottom sheet on mobile ≤480px (slide-up animation, drag handle, safe-area inset); centred dialog on desktop. Closes on backdrop click, × button, or Escape key
- Boarding pass: real profile data (round profile-photo avatar) + flight details (departure, arrival, date, airline). When flight details exist, an animated "BOARDS IN N DAYS" countdown pill is shown on the stub (recomputed from `travel_date` on every load; "Boarding today" on the day; hidden once past)
- Flight details form: students enter their flight info. Peer cards show a **"Same flight!"** badge when travel date + departure + arrival + airline all match the viewer, **"Same day"** when only the date matches
- Phone sharing toggle on dashboard; phone masked in peer query unless `share_phone = true`
- Invite a peer: approved students can invite someone by email from the dashboard services sidebar (InvitePeerModal). The peer receives a branded UniMate invitation naming the inviter + their university, the key benefits, and a link to register (`/login`). No token — invitees sign up through the normal flow. `/api/students/invite-peer` blocks self-invites, emails that already have an account, and recent re-invites (7-day window), and caps each student at 10 invites/day; every send is recorded in `peer_invites`
- Admin-managed dropdown options: universities, airports, airlines, cities — full CRUD via `/api/admin/options/*`. Universities and cities are each tagged with a country on creation (required); Manage Dropdowns shows the country as a chip and flags untagged rows. (The `courses` table and its `/api/admin/options/.../courses` routes still exist but are unused — course is now a free-text field on registration, so the admin per-university course-management UI was removed.)
- Country-scoped university & city selection: both the registration form and the admin review modal filter the University and City dropdowns by the selected `country_of_education` (fetched live via `?country=` on the options APIs). Changing the country resets and re-populates both fields in realtime; an "Other — type it in yourself" free-text fallback lets users enter values not in the country's configured list. Country list is the shared `lib/countries.ts` constant.
- Student-facing dropdown APIs: `/api/options/universities`, `/api/options/airports`, `/api/options/airlines`, `/api/options/cities`
- Consent flow: after filling the registration form students are taken to `/register/consent` where they must accept 4 required consent declarations (document storage, profile picture, email sharing, phone collection) before submission; `consented_at` timestamp recorded in DB
- Admin invite-by-email: admins can invite new admins via the "Manage Admins" tab; invite link (48-hour expiry) sent by email; recipient sets password at `/accept-invite`; admin accounts skip email verification; admins can also revoke pending invites and demote existing admins
- Deployed to Vercel; email links use `APP_URL` env var
- `/register` explicitly gated on `emailVerified=true` in both middleware (server-side JWT claim check) and page `useEffect` (client-side fallback via `email_verified` from `/api/auth/me`)

## Out of Scope (Do Not Build)

Career hub, PR calculator, job board, marketplace, events ticketing, senior mentors, Google OAuth, in-app messaging, automated OCR, AWS S3/SES migration, Prisma migration, setup-password JWT flow, archived/expired status, affiliate consents.
