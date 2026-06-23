-- UniMate database schema
-- Target: Neon serverless PostgreSQL
-- Run each section in order when setting up a new environment.

-- ─── Core tables ──────────────────────────────────────────────────────────────

CREATE TABLE users (
  id                   SERIAL PRIMARY KEY,
  email                VARCHAR(255) UNIQUE NOT NULL,
  password_hash        VARCHAR(255) NOT NULL,
  email_verified       BOOLEAN DEFAULT false,
  verification_token    VARCHAR(255),
  verification_expires  TIMESTAMPTZ,                       -- pre-verify: 12h link expiry; post-verify (students): 48h deadline to submit the registration form; NULL once the form is submitted (or for admins). Abandoned no-form rows are purged on cron + next signup.
  password_reset_token  VARCHAR(255),
  password_reset_expires TIMESTAMPTZ,
  role                  VARCHAR(20) DEFAULT 'student',   -- 'student' | 'admin'
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE student_profiles (
  id                    SERIAL PRIMARY KEY,
  user_id               INTEGER REFERENCES users(id) ON DELETE CASCADE,
  full_name             VARCHAR(255),
  phone                 VARCHAR(50),
  country_of_origin     VARCHAR(100),
  country_of_education  VARCHAR(100),
  university_name       VARCHAR(255),
  degree_level          VARCHAR(100),
  course_name           VARCHAR(255),
  intake_month          VARCHAR(20),
  intake_year           INTEGER,
  passport_url          TEXT,           -- full Vercel Blob URL; deleted from Blob after admin review
  admission_letter_url  TEXT,
  profile_picture_url   TEXT,
  status                VARCHAR(20) DEFAULT 'pending',  -- 'pending' | 'approved' | 'rejected' | 'revoked' | 'archived'
  submitted_at          TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at           TIMESTAMPTZ,
  reviewed_by           INTEGER REFERENCES users(id),
  rejection_reason      TEXT,
  share_phone           BOOLEAN DEFAULT false,          -- student opt-in to share phone with peers
  consented_at          TIMESTAMPTZ,                     -- set at registration; NULL = no consent recorded
  city                  VARCHAR(255),                    -- destination city abroad; powers same-city peer discovery; NULL for pre-feature profiles
  gender                VARCHAR(10),                     -- 'Male' | 'Female'; required at registration; admin-visible only
  revoke_reason         TEXT,                            -- set when status changes to 'revoked'; cleared to NULL on unrevoke
  course_start_date     DATE,                            -- admin-entered at review; mandatory to approve; NULL otherwise
  expiry_date           DATE,                            -- snapshot = course_start_date + ACCOUNT_LIFESPAN_DAYS; drives the archive sweep
  archived_at           TIMESTAMPTZ                      -- set when status changes to 'archived' (access expired); admin-only thereafter
);

CREATE TABLE flight_details (
  id             SERIAL PRIMARY KEY,
  user_id        INTEGER REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  departure_from VARCHAR(255),   -- free-form, e.g. "New Delhi (DEL)"
  arrival        VARCHAR(255),   -- free-form, e.g. "Melbourne (MEL)"
  travel_date    DATE,
  airline        VARCHAR(100),   -- e.g. "Emirates"
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Student error log table ──────────────────────────────────────────────────
-- Records errors students hit during registration, verification, and login.
-- email is plain text (not a FK) — pre-account attempts have no users row yet.

CREATE TABLE student_error_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level       VARCHAR(10) NOT NULL DEFAULT 'error',  -- 'error' | 'warn' | 'info'
  event       VARCHAR(100) NOT NULL,
  message     TEXT NOT NULL,
  email       VARCHAR(255),
  user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  route       VARCHAR(255),
  metadata    JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX ON student_error_logs (created_at DESC);
CREATE INDEX ON student_error_logs (email);
CREATE INDEX ON student_error_logs (level, created_at DESC);

-- ─── Admin invite table ───────────────────────────────────────────────────────

CREATE TABLE admin_invites (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email      VARCHAR(255) UNIQUE NOT NULL,
  token      VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  invited_by INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Peer invite table ────────────────────────────────────────────────────────
-- Records peer-to-peer invitations sent from the student dashboard. No token /
-- expiry: invitees join through the normal signup flow (no privilege bypass).
-- Used only for per-student rate-limiting, recent-dedup, and attribution.
-- No UNIQUE(email): the same person may legitimately be invited by many students.

CREATE TABLE peer_invites (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email      VARCHAR(255) NOT NULL,          -- invitee email, normalised lowercase
  invited_by INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_peer_invites_inviter_date ON peer_invites (invited_by, created_at);
CREATE INDEX idx_peer_invites_email ON peer_invites (email);

-- ─── Reference / dropdown tables ─────────────────────────────────────────────

CREATE TABLE universities (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(255) NOT NULL,
  country    VARCHAR(100),                  -- destination country; filters the university dropdown by country_of_education; NULL for pre-feature rows
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (name, country)                    -- country-scoped: same-named universities can exist in different countries
);

CREATE TABLE courses (
  id            SERIAL PRIMARY KEY,
  university_id INTEGER REFERENCES universities(id) ON DELETE CASCADE,
  name          VARCHAR(255) NOT NULL,
  UNIQUE(university_id, name)
);

CREATE TABLE airports (
  id         SERIAL PRIMARY KEY,
  label      VARCHAR(255) UNIQUE NOT NULL,  -- e.g. "New Delhi (DEL)"
  country    VARCHAR(100),                  -- destination country; scopes the flight-details ARRIVAL dropdown by country_of_education; NULL for pre-feature rows (still shown in the global departure list)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE airlines (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE cities (
  id         SERIAL PRIMARY KEY,
  label      VARCHAR(255) NOT NULL,         -- destination city abroad, e.g. "Melbourne"
  country    VARCHAR(100),                  -- destination country; filters the city dropdown by country_of_education; NULL for pre-feature rows
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (label, country)                   -- country-scoped: same-named cities can exist in different countries (e.g. London UK / London, Canada)
);

-- ─── Migrations (apply to existing databases in order) ────────────────────────

-- Migration 001 — peer directory phone opt-in (added with FlyMate peer directory feature)
-- ALTER TABLE student_profiles ADD COLUMN share_phone BOOLEAN DEFAULT false;

-- Migration 002 — flight details table (added with FlyMate peer directory feature)
-- CREATE TABLE flight_details ( ... );  -- see full definition above

-- Migration 003 — admin-managed dropdown reference tables
-- CREATE TABLE universities ( id SERIAL PRIMARY KEY, name VARCHAR(255) UNIQUE NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW() );
-- CREATE TABLE courses ( id SERIAL PRIMARY KEY, university_id INTEGER REFERENCES universities(id) ON DELETE CASCADE, name VARCHAR(255) NOT NULL, UNIQUE(university_id, name) );
-- CREATE TABLE airports ( id SERIAL PRIMARY KEY, label VARCHAR(255) UNIQUE NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW() );
-- CREATE TABLE airlines ( id SERIAL PRIMARY KEY, name VARCHAR(255) UNIQUE NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW() );

-- Migration 004 — file storage migrated from local filesystem to Vercel Blob
-- passport_url, admission_letter_url, profile_picture_url now store full https:// Vercel Blob URLs.
-- No schema change required; existing TEXT columns already hold the new URL format.

-- Migration 005 — consent timestamp (added with consent flow before registration submission)
-- ALTER TABLE student_profiles ADD COLUMN consented_at TIMESTAMPTZ;

-- Migration 006 — admin invite-by-email flow
-- CREATE TABLE admin_invites ( id UUID PRIMARY KEY DEFAULT gen_random_uuid(), email VARCHAR(255) UNIQUE NOT NULL, token VARCHAR(255) UNIQUE NOT NULL, expires_at TIMESTAMPTZ NOT NULL, invited_by INT REFERENCES users(id) ON DELETE SET NULL, created_at TIMESTAMPTZ DEFAULT NOW() );

-- Migration 007 — destination city (added with dashboard peer scope filters)
-- CREATE TABLE cities ( id SERIAL PRIMARY KEY, label VARCHAR(255) UNIQUE NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW() );
-- ALTER TABLE student_profiles ADD COLUMN city VARCHAR(255);

-- Migration 008 — forgot password reset tokens
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_token VARCHAR(255);
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_expires TIMESTAMPTZ;

-- Migration 009 — gender field on student profiles
-- ALTER TABLE student_profiles ADD COLUMN gender VARCHAR(10);

-- Migration 010 — country-scoped universities & cities (registration dropdowns filtered by country_of_education)
-- ALTER TABLE universities ADD COLUMN IF NOT EXISTS country VARCHAR(100);
-- ALTER TABLE cities       ADD COLUMN IF NOT EXISTS country VARCHAR(100);
-- -- Replace global name uniqueness with country-scoped uniqueness so the same-named
-- -- place can exist in two countries (e.g. London UK vs London, Canada).
-- -- NOTE: confirm the existing constraint names first via \d universities / \d cities (defaults shown below).
-- ALTER TABLE universities DROP CONSTRAINT IF EXISTS universities_name_key;
-- ALTER TABLE universities ADD CONSTRAINT universities_name_country_key UNIQUE (name, country);
-- ALTER TABLE cities       DROP CONSTRAINT IF EXISTS cities_label_key;
-- ALTER TABLE cities       ADD CONSTRAINT cities_label_country_key UNIQUE (label, country);
-- -- Existing rows keep country = NULL until an admin re-adds them with a country.

-- Migration 011 — country-scoped arrival airports (flight-details arrival dropdown filtered by country_of_education)
-- ALTER TABLE airports ADD COLUMN IF NOT EXISTS country VARCHAR(100);
-- Keep UNIQUE(label): an airport is one physical place. Departure dropdown stays global (all airports);
-- arrival dropdown filters by country. Existing rows keep country = NULL until an admin re-adds them with a country.

-- Migration 012 — peer invite table (student-to-student "Invite a peer" dashboard feature)
-- No token/expiry: invitees join via the normal signup flow. Used for rate-limiting, recent-dedup, and attribution.
-- CREATE TABLE peer_invites (
--   id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--   email      VARCHAR(255) NOT NULL,
--   invited_by INT REFERENCES users(id) ON DELETE SET NULL,
--   created_at TIMESTAMPTZ DEFAULT NOW()
-- );
-- CREATE INDEX idx_peer_invites_inviter_date ON peer_invites (invited_by, created_at);
-- CREATE INDEX idx_peer_invites_email ON peer_invites (email);

-- Migration 013 — post-verification registration deadline (no DDL change)
-- Repurposes users.verification_expires: on email verification, students get
-- verification_expires = NOW() + 48h as a deadline to submit the registration
-- form (admins get NULL). Submitting the form clears it (NULL). Abandoned
-- no-form student accounts (verification_expires < NOW(), no student_profiles
-- row) are purged by the daily cron + inline on next signup, freeing the email.

-- Migration 014 — revoke reason
-- ALTER TABLE student_profiles ADD COLUMN revoke_reason TEXT;

-- Migration 015 — account expiry + archive
-- Admin sets course_start_date at review (mandatory to approve); expiry_date is
-- snapshotted as course_start_date + ACCOUNT_LIFESPAN_DAYS (default 30). When the
-- expiry passes, the daily cron / admin "Archive expired students" button flips
-- status 'approved' → 'archived', stamps archived_at, and emails the student.
-- Archived students are hidden from peers (queries already filter status='approved').
-- status needs no DDL — 'archived' is just a new VARCHAR value (like 'revoked').
-- ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS course_start_date DATE;
-- ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS expiry_date       DATE;
-- ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS archived_at       TIMESTAMPTZ;
-- CREATE INDEX IF NOT EXISTS idx_student_profiles_expiry
--   ON student_profiles (expiry_date) WHERE status = 'approved';

-- Migration 016 — student error logging
-- Captures errors students hit during registration, verification, and login.
-- email stored as plain text (not a FK) so pre-account failures can be identified.
-- user_id SET NULL on account deletion to preserve history without blocking cleanup.
-- CREATE TABLE student_error_logs (
--   id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--   level       VARCHAR(10) NOT NULL DEFAULT 'error',
--   event       VARCHAR(100) NOT NULL,
--   message     TEXT NOT NULL,
--   email       VARCHAR(255),
--   user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
--   route       VARCHAR(255),
--   metadata    JSONB,
--   created_at  TIMESTAMPTZ DEFAULT NOW()
-- );
-- CREATE INDEX ON student_error_logs (created_at DESC);
-- CREATE INDEX ON student_error_logs (email);
-- CREATE INDEX ON student_error_logs (level, created_at DESC);

-- Migration 017 — add level column to student_error_logs (if table exists without it)
-- ALTER TABLE student_error_logs ADD COLUMN IF NOT EXISTS level VARCHAR(10) NOT NULL DEFAULT 'error';
-- CREATE INDEX IF NOT EXISTS idx_sel_level ON student_error_logs (level, created_at DESC);
-- Existing rows get DEFAULT 'error' automatically — no data backfill needed.
