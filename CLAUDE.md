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
- **Styling**: Tailwind CSS 4, inline CSS variables (`--teal #0E6E62`, `--coral #EE5B36`, `--ink`, etc.)
- **Database**: Neon serverless PostgreSQL (`@neondatabase/serverless`) — raw SQL via tagged `sql` template literal
- **Auth**: Custom JWT — `jose` library, HS256, 7-day expiry, stored as `auth-token` HttpOnly cookie
- **Passwords**: `bcryptjs` (rounds: 12)
- **Email**: Nodemailer via Gmail SMTP
- **File storage**: Vercel Blob (`@vercel/blob`) — public URLs stored in DB; `put()` on upload, `del()` on admin review
- **IDs**: `uuid` v14 (used for verification tokens)

## Project Structure

```
/app
  page.tsx                               # Home dashboard (approved students) — live data from DB
  layout.tsx                             # Root layout; fonts: Bricolage Grotesque, Hanken Grotesk, Space Mono
  /login/page.tsx                        # Combined login + signup toggle
  /register/layout.tsx                   # 'use client' layout — provides RegistrationContext for /register and /register/consent
  /register/context.tsx                  # RegistrationContext + RegistrationProvider; holds form fields + File objects in memory across page navigation
  /register/page.tsx                     # Student registration form (9 fields + 3 file uploads); on submit saves to context and navigates to /register/consent
  /register/consent/page.tsx             # Consent page: application summary + 4 required checkboxes; POSTs to /api/student/register on accept
  /admin/page.tsx                        # Admin review portal (3 tabs: Student Applications, Manage Dropdowns, Manage Admins)
  /accept-invite/page.tsx                # Admin invite acceptance — set password to activate admin account
  /pending/page.tsx                      # Application status view (pending / rejected)
  /verify-email/page.tsx                 # Email verification landing
  /api/
    /auth/signup/route.ts                # POST — create account, hash password, send verification email; purges all expired+unverified rows before duplicate check; 2-hour expiry window
    /auth/login/route.ts                 # POST — authenticate, set auth-token cookie
    /auth/logout/route.ts                # POST — clear cookie
    /auth/me/route.ts                    # GET  — return current session user + registration status
    /auth/verify-email/route.ts          # GET  — validate token; deletes user row if expired, then redirects; sets session and redirects on success
    /auth/accept-invite/route.ts         # POST — validate invite token, create admin user (email_verified=true, role='admin'), set session cookie; deletes invite row on success
    /student/register/route.ts           # POST — FormData with files + consents_accepted flag; validates consent, inserts student_profiles row with consented_at = NOW()
    /admin/students/route.ts                          # GET    — list all student applications (admin only)
    /admin/students/[id]/review/route.ts              # POST   — approve/reject; deletes passport+admission letter from Blob; sends email
    /admin/admins/route.ts                            # GET    — list admin users + pending invites; POST — send admin invite email (48-hour token)
    /admin/admins/[id]/route.ts                       # DELETE — demote admin to student (cannot remove self)
    /admin/admins/invite/[id]/route.ts                # DELETE — revoke a pending admin invite
    /admin/options/universities/route.ts              # POST   — create university (admin only)
    /admin/options/universities/[id]/route.ts         # DELETE — remove university (admin only)
    /admin/options/universities/[id]/courses/route.ts # POST   — add course to university (admin only)
    /admin/options/courses/[id]/route.ts              # DELETE — remove course (admin only)
    /admin/options/airports/route.ts                  # POST   — create airport (admin only)
    /admin/options/airports/[id]/route.ts             # DELETE — remove airport (admin only)
    /admin/options/airlines/route.ts                  # POST   — create airline (admin only)
    /admin/options/airlines/[id]/route.ts             # DELETE — remove airline (admin only)
    /files/[filename]/route.ts                        # Retired — returns 410; files now served directly from Vercel Blob URLs
    /options/universities/route.ts                    # GET    — list universities + nested courses (authenticated students)
    /options/airports/route.ts                        # GET    — list airports (authenticated students)
    /options/airlines/route.ts                        # GET    — list airlines (authenticated students)
    /students/me/route.ts                # GET  — own approved profile + flight details
    /students/peers/route.ts             # GET  — approved peers at same university (phone masked unless share_phone)
    /students/flight/route.ts            # GET/POST — upsert own flight details
    /students/share-phone/route.ts       # PUT  — toggle share_phone boolean
  /components/
    Navbar.tsx                           # Sticky nav with real user info + sign-out button
    BoardingPass.tsx                     # Boarding-pass card — real profile + flight details; accepts FlightDetails props
    FlyMateExplorer.tsx                  # Peer discovery + filtering UI — live DB data; accepts Peer[] prop
    StudentCard.tsx                      # Individual peer card; exports Peer interface
    FlightDetailsModal.tsx               # Modal form: departure, arrival, date, airline; exports FlightDetails interface
    Services.tsx                         # Services hub (4 cards)
    Toast.tsx                            # useToast() hook, auto-dismiss 3.6s
  /data/
    students.ts                          # Static demo data (unused; kept for reference)
/lib/
  db.ts      # export const sql = neon(process.env.DATABASE_CONNECTION_STRING!)
  auth.ts    # signToken, verifyToken, getSession, makeSessionCookieOptions; SessionPayload interface
  email.ts   # sendVerificationEmail, sendRegistrationAcknowledgement, sendApprovalEmail, sendRejectionEmail, sendAdminInviteEmail
/middleware.ts                           # JWT protection — public allowlist + /admin role guard
/private_uploads/                        # Local dev placeholder only — production files live in Vercel Blob
```

## Database Schema

Full schema and migration history: [`db/schema.sql`](./db/schema.sql)

Tables: `users`, `student_profiles` (includes `share_phone BOOLEAN DEFAULT false`, `consented_at TIMESTAMPTZ`), `flight_details`, `universities`, `courses`, `airports`, `airlines`, `admin_invites` (UUID PK, email, token, expires_at, invited_by → users)

## Hard Rules — Never Break These

1. **Peer directory queries** must never return: `phone`, `password_hash`, `passport_url`, `admission_letter_url`, `rejection_reason`, `reviewed_by`. Safe fields: `full_name`, `email`, `course_name`, `intake_month`, `intake_year`, `country_of_origin`, `degree_level`, `university_name`, `profile_picture_url`.

2. **Sensitive documents** (`passport_url`, `admission_letter_url`) must be deleted from Vercel Blob via `del()` immediately after admin approve or reject. `profile_picture_url` is intentionally retained — it is displayed on the dashboard and in the peer directory. See `/api/admin/students/[id]/review/route.ts`.

3. **All API routes** must call `getSession()` before any database operation. Public exceptions: `POST /api/auth/signup`, `POST /api/auth/login`, `GET /api/auth/verify-email`, `POST /api/auth/accept-invite`.

4. **Admin routes** (`/admin/*` and `/api/admin/*`) must check `session.role === 'admin'`. Student sessions must never access admin routes.

5. **File URLs** stored in the DB (`passport_url`, `admission_letter_url`, `profile_picture_url`) are full Vercel Blob `https://` URLs. Use them directly as `src`/`href` — do not route through `/api/files/`. Profile pictures are public blob URLs visible to any authenticated student; passport and admission letter blobs are deleted after review.

6. **Env vars** are accessed via `process.env` directly. Never hardcode secrets or connection strings. All vars must be present at runtime — the non-null assertions (`!`) will throw if missing.

## Auth Middleware Logic

```
Public (no auth):  /login, /verify-email, /accept-invite, /api/auth/*
Admin only:        /admin/* → role must be 'admin', else redirect /
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
```

## Conventions

- Server components by default. Add `'use client'` only when using hooks or browser APIs.
- Email sends are fire-and-forget — never block a response waiting for email confirmation.
- Design tokens are CSS variables — use `var(--teal)`, `var(--coral)`, etc. rather than hardcoding colours.
- Neon `sql` is a tagged template literal with automatic parameterisation — always pass values as template interpolations, never via string concatenation.
- Catch database errors as `Error` — check `err.message` for Neon constraint violations (unique email → Postgres code `23505`).

## Known Gaps (not MVP-blocking for auth/admin flows)

- **No server-side field validation** in `/api/student/register` — fields are inserted as-is. Add presence/length checks before the SQL insert.

## Phase 1 Scope — What Exists

- Signup → email verification (2-hour expiry; expired rows auto-deleted) → login/logout (with sign-out button in Navbar)
- Student registration form with passport, admission letter, and profile photo upload (photo resized client-side to max 400 px before upload)
- Admin review queue (approve / reject with reason + file deletion)
- Email notifications: verification link, registration acknowledgement, approved, rejected
- File uploads via Vercel Blob (public URLs); sensitive documents deleted from Blob after admin review
- Live peer directory: real approved students at same university, profile photos, email + opt-in phone
- Boarding pass: real profile data + flight details (departure, arrival, date, airline)
- Flight details form: students enter their flight info; "Same flight day" badge on peer cards
- Phone sharing toggle on dashboard; phone masked in peer query unless `share_phone = true`
- Admin-managed dropdown options: universities (with nested courses), airports, airlines — full CRUD via `/api/admin/options/*`
- Student-facing dropdown APIs: `/api/options/universities`, `/api/options/airports`, `/api/options/airlines`
- Consent flow: after filling the registration form students are taken to `/register/consent` where they must accept 4 required consent declarations (document storage, profile picture, email sharing, phone collection) before submission; `consented_at` timestamp recorded in DB
- Admin invite-by-email: admins can invite new admins via the "Manage Admins" tab; invite link (48-hour expiry) sent by email; recipient sets password at `/accept-invite`; admin accounts skip email verification; admins can also revoke pending invites and demote existing admins
- Deployed to Vercel; email links use `APP_URL` env var

## Out of Scope (Do Not Build)

Career hub, PR calculator, job board, marketplace, events ticketing, senior mentors, Google OAuth, in-app messaging, automated OCR, AWS S3/SES migration, Prisma migration, setup-password JWT flow, archived/expired status, affiliate consents.
