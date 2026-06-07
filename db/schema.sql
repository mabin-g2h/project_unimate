-- UniMate database schema
-- Target: Neon serverless PostgreSQL
-- Run each section in order when setting up a new environment.

-- ─── Core tables ──────────────────────────────────────────────────────────────

CREATE TABLE users (
  id                   SERIAL PRIMARY KEY,
  email                VARCHAR(255) UNIQUE NOT NULL,
  password_hash        VARCHAR(255) NOT NULL,
  email_verified       BOOLEAN DEFAULT false,
  verification_token   VARCHAR(255),
  verification_expires TIMESTAMPTZ,
  role                 VARCHAR(20) DEFAULT 'student',   -- 'student' | 'admin'
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
  passport_url          TEXT,           -- filename only, served via /api/files/[filename]
  admission_letter_url  TEXT,
  profile_picture_url   TEXT,
  status                VARCHAR(20) DEFAULT 'pending',  -- 'pending' | 'approved' | 'rejected'
  submitted_at          TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at           TIMESTAMPTZ,
  reviewed_by           INTEGER REFERENCES users(id),
  rejection_reason      TEXT,
  share_phone           BOOLEAN DEFAULT false           -- student opt-in to share phone with peers
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

-- ─── Reference / dropdown tables ─────────────────────────────────────────────

CREATE TABLE universities (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
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
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE airlines (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
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
