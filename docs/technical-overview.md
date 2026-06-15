# UniMate — Technical Overview

India's student community platform for studying abroad. Connects Indian students from offer letter acceptance through graduation.

---

## 1. Architecture

### High-Level Overview

UniMate is a full-stack web application built on **Next.js App Router** with server components as the default. It follows a monolithic architecture — the frontend, API layer, and business logic all live in a single Next.js project deployed to Vercel.

```
Browser
  │
  ▼
Vercel Edge (middleware — JWT guard runs here)
  │
  ▼
Next.js App Router
  ├── Server Components  →  renders pages with live DB data
  ├── API Routes         →  handles mutations and authenticated actions
  └── Client Components →  interactive UI (forms, modals, toggles)
  │
  ├── Neon PostgreSQL    →  primary data store (serverless, HTTP-based)
  └── Vercel Blob        →  file storage for uploads (profile photos, documents)
```

### Key Layers

| Layer | Technology | Role |
|---|---|---|
| Frontend | React 19 / Next.js App Router | Pages and UI components |
| Styling | Tailwind CSS 4 + CSS variables | Design system (teal, coral, ink tokens) |
| API | Next.js Route Handlers | REST-like endpoints under `/api/` |
| Auth | Custom JWT (jose, HS256) | Session management via HttpOnly cookie |
| Database | Neon PostgreSQL | All application data |
| File Storage | Vercel Blob | Student uploads (photos, passports, letters) |
| Email | Nodemailer + Gmail SMTP | Transactional emails |

### Authentication Architecture

Authentication is entirely custom — no third-party auth provider. When a user logs in, the server signs a JWT (HS256) and sets it as an `auth-token` HttpOnly cookie. Every subsequent request carries this cookie.

The **Next.js middleware** (`middleware.ts`) runs at the Vercel Edge before any page or API handler. It:

1. Skips verification for public paths (`/login`, `/verify-email`, `/api/auth/*`, `/accept-invite`)
2. Verifies the JWT signature against the server-side `JWT_SECRET`
3. Rejects requests with invalid or missing tokens by redirecting to `/login`
4. Blocks non-admin users from accessing any `/admin` path

API route handlers then call `getSession()` to re-read the token and extract the user's identity for database operations.

### Database Design

Three core tables, three reference/lookup tables, and one admin-management table:

**Core tables**

- `users` — email, hashed password, email verification state, and role (`student` or `admin`)
- `student_profiles` — all registration data for a student, their review status, uploaded file URLs, and consent timestamp
- `flight_details` — one row per student with their departure airport, arrival airport, travel date, and airline

**Reference tables** (admin-managed via the admin portal)

- `universities` + `courses` — universities list; course is now a free-text field at registration (the courses table still exists but is unused in the student form)
- `airports` — departure and arrival options for flight details
- `airlines` — airline options for flight details
- `cities` — destination city options for the registration form and peer city filter

**Admin management**

- `admin_invites` — invite tokens sent to new admins; they sign up via the invite link rather than the regular signup flow

---

## 2. Deployment

### Platform: Vercel

The project deploys to **Vercel** via Git push. Vercel automatically builds (`npm run build`) and deploys on each push to the main branch. No manual build step is needed.

### Infrastructure Components

| Component | Provider | Notes |
|---|---|---|
| Hosting & CDN | Vercel | Serverless functions per API route |
| Edge middleware | Vercel Edge Runtime | JWT auth guard (runs before any route) |
| Database | Neon (serverless Postgres) | HTTP-based connection, no persistent connection pool needed |
| File storage | Vercel Blob | Public blob URLs stored in the DB; no proxy layer |
| Email | Gmail SMTP via Nodemailer | Sent from a Gmail account using an app password |

### Environment Variables

All secrets are configured as Vercel environment variables (not committed to the repo):

| Variable | Purpose |
|---|---|
| `DATABASE_CONNECTION_STRING` | Neon PostgreSQL connection string |
| `JWT_SECRET` | Signing key for session JWTs |
| `GMAIL_USER` | Gmail address used as the email sender |
| `GMAIL_APP_PASSWORD` | Gmail app password (not the account password) |
| `APP_URL` | Public base URL — used to build links in emails |
| `ADMIN_EMAIL` | Email address that is automatically granted admin role at signup |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob store token (auto-injected by Vercel in production) |
| `CRON_SECRET` | Bearer token for the `/api/auth/cleanup` cron endpoint |

For local development, these go into a `.env.local` file (not committed).

### File Storage Approach

Uploaded files (passport scans, admission letters, profile photos) are stored directly in **Vercel Blob** — not on the server filesystem. When a student uploads a file, the server calls Vercel Blob's `put()`, which returns a public `https://` URL. That URL is stored in the database.

Sensitive documents (passport and admission letter) are deleted from Blob via `del()` immediately after an admin approves or rejects the application. Profile photos are retained and served directly from the Blob URL in the peer directory.

---

## 3. Features

### Student Journey Features

**Sign-up and Email Verification**
Students create an account with their email and password. A verification link is emailed immediately. The link expires after 12 hours. If a student tries to re-register with the same email after their token has expired, the system automatically removes the stale unverified row before creating a fresh one, so they can start over cleanly. Expired unverified rows are also purged daily by a Vercel cron job (`/api/auth/cleanup`, secured with `CRON_SECRET`).

**Registration Form**
After verifying their email, students fill out an eleven-field registration form covering personal details (name, phone, country of origin, gender) and academic details in a natural order — destination country, university, city, degree level, course/programme (free text), and intake month/year — plus three file uploads (passport scan, admission letter, profile photo). The university and city dropdowns each include a stand-out **"Other"** option that reveals a free-text input, so a student whose institution or city isn't in the admin-managed list can still register; the typed value is stored on their profile (like the free-text course name) rather than being added to the dropdown tables. Each upload field shows its own format and size requirement inline (PDF, max 2 MB for documents; JPEG or PNG, max 1 MB for photos), and profile photos are resized client-side to a maximum of 400px before upload to keep storage lean. On submission, an acknowledgement email goes to the student and an alert email is sent to the admin (`ADMIN_EMAIL`) notifying them of the new application.

**Consent Flow**
After completing the registration form, students are taken to a dedicated consent page before submission. They must check four declarations covering document storage, profile picture use, email sharing, and phone number collection. The moment of consent is recorded as a `consented_at` timestamp in the database. The form data is held in memory via a React context across the two-page flow.

**Application Status Page**
While waiting for admin review, students see a status page (`/pending`) confirming their application is pending. The pending view also reminds students to check their spam or junk folder for emails from UniMate.

**Re-registration After Rejection**
A rejected student's account is kept in the database with `status = 'rejected'` (nothing is deleted). On their next login the app detects the rejected status and routes them **straight to a fresh, blank registration form** (`/register`) rather than the status page, so they can re-apply immediately. The rejection reason is communicated by email. When they submit the new application, the old rejected profile row is replaced and the application returns to `pending` for review.

**Dashboard (Approved Students)**
Approved students land on the main dashboard, which shows:
- A **Boarding Pass** card displaying their profile (round avatar, destination city) and flight details. When flight details are set, an animated countdown pill ("BOARDS IN N DAYS") appears on the stub, computed from the travel date on every load.
- A **FlyMate Explorer** for discovering peers heading to the same destination country. Peers are filtered client-side by five composable dropdowns — University, City, Course, Degree, Intake — with active-filter chips, search, and sort. A "Filters" drawer opens on mobile.
- A **Services Hub** linking to upcoming platform features

**Flight Details**
Students can enter their departure airport, arrival airport, travel date, and airline. This data powers the peer directory — peer cards show a **"Same flight!"** badge when all four fields match the viewer, or **"Same day"** when only the travel date matches.

**Peer Directory (FlyMate Explorer)**
Shows all approved students heading to the same destination country. Peer cards are compact portrait tiles (avatar, name, university, city). Clicking a tile opens a detail modal with full info, email, and phone (if shared). The modal is a bottom sheet on mobile and a centred dialog on desktop. Phone numbers are hidden by default; students who opt in to phone sharing have their number visible to peers. Sensitive fields (passport URLs, rejection reasons, phone unless shared) are excluded at the SQL level.

**Forgot / Reset Password**
Students who forget their password can request a reset link from `/forgot-password`. A UUID reset token (1-hour expiry) is emailed to verified accounts only. The endpoint always returns 200 to prevent email enumeration. Submitting the reset form at `/reset-password` validates the token and sets a new bcrypt-hashed password.

**Phone Sharing Toggle**
A toggle on the dashboard lets students control whether their phone number is visible to peers. The preference is stored in the `share_phone` column of `student_profiles`.

### Admin Features

**Application Review Queue**
Admins see all submitted applications with student details and uploaded documents (passport scan, admission letter). They can approve or reject an application. Rejection requires a written reason. On review completion, sensitive documents are deleted from Vercel Blob and an email is sent to the student.

**Admin-Managed Dropdown Options**
Admins maintain the lists that appear in student-facing dropdowns: universities, airports, airlines, and destination cities. Options can be added and deleted individually via the admin portal.

**Admin Invite System**
New admins are added via an invite link (48-hour expiry). An existing admin sends an invite to an email address; the invitee sets their password through the invite URL, which grants them admin role automatically. Admins can also revoke pending invites and demote existing admins back to student role (cannot demote yourself).

---

## 4. Workflow

### New Student Flow

```
1. Sign up  →  verification email sent (12-hour window)
2. Click email link  →  email verified, session created, redirected to /register
3. Fill registration form (personal + academic details + destination city + file uploads)
4. Consent page  →  accept 4 declarations
5. Submit  →  files uploaded to Vercel Blob, profile row inserted
           →  acknowledgement email sent to student
           →  alert email sent to admin (fire-and-forget)
6. Wait on /pending  →  admin reviews application
7. Receive approval/rejection email
8. If approved  →  all existing approved students at the same university receive a peer-join notification
9. If approved  →  log in and land on dashboard
10. If rejected  →  account kept as 'rejected'; next login routes straight to a blank /register form to re-apply (old profile replaced on resubmit)
```

### Admin Review Flow

```
1. Admin logs in  →  redirected to /admin
2. Review queue shows all pending applications
3. Admin opens a student's application, views documents
4. Approve or Reject (with reason)
5. System:
   - Updates student status in DB
   - Deletes passport + admission letter from Vercel Blob
   - Sends approval or rejection email to student
   - On approval: notifies all other approved students at the same university (peer-join email)
```

### Request Lifecycle

For every authenticated request:

```
Browser request
  → Vercel Edge: middleware verifies JWT cookie
  → If valid: request reaches the Next.js route handler or page
  → Route handler: calls getSession() to identify the user
  → Executes DB query via Neon sql`` tagged template
  → Returns JSON response or renders server component
```

### Email Notification Points

| Event | Email sent to |
|---|---|
| Signup | Student — email verification link |
| Registration submitted | Student — acknowledgement |
| Registration submitted | Admin — new application alert (fire-and-forget) |
| Application approved | Student — approval confirmation |
| Application approved | All approved peers at the same university — peer-join notification |
| Application rejected | Student — rejection with reason |
| Forgot password | Student — password reset link (1-hour expiry) |
| Admin invited | Invitee — invite link (48-hour expiry) |

### Data Lifecycle for Uploaded Files

```
Student uploads file
  → Client resizes image (profile photos only)
  → POST to /api/student/register (FormData)
  → Server calls Vercel Blob put()  →  gets public URL
  → URL saved to student_profiles row in Neon DB

Admin approves or rejects
  → Server reads passport_url and admission_letter_url from DB
  → Calls Vercel Blob del() for both URLs
  → Clears URL columns in DB
  → profile_picture_url is kept (used in dashboard + peer directory)
```

---

## 5. Security Notes

- Passwords are hashed with bcrypt (12 rounds) before storage. Plain-text passwords are never stored or logged.
- JWTs are signed with HS256 and expire after 7 days. They are stored in HttpOnly cookies, making them inaccessible to JavaScript.
- The middleware prevents any unauthenticated access to protected routes at the edge — before any server-side code runs.
- Peer directory queries are written to exclude sensitive columns at the SQL level, not filtered in application code after the fact.
- Admin routes require `role === 'admin'` in the JWT payload. A student session cannot reach any admin endpoint.
- All database values are passed as parameterised template interpolations via the Neon `sql` tagged literal — no raw string concatenation, no SQL injection risk.
- Sensitive uploaded documents are deleted from storage as soon as they have been reviewed, minimising the window of exposure.
