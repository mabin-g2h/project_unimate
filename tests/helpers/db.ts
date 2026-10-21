import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';
import { loadTestEnv, assertSafeTestDb, ADMIN } from './env';

// Every call re-runs the guard; there is no way to get a connection without it.
export function testSql() {
  return neon(assertSafeTestDb(loadTestEnv()));
}

const UNIVERSITIES: Record<string, string[]> = {
  Australia: ['University of Melbourne', 'Monash University'],
  Canada: ['University of Toronto', 'McGill University'],
  'United Kingdom': ['University of Manchester', 'University of Leeds'],
  'United States': ['Arizona State University'],
  Germany: ['Technical University of Munich'],
};
const CITIES: Record<string, string[]> = {
  Australia: ['Melbourne', 'Sydney'],
  Canada: ['Toronto', 'Montreal'],
  'United Kingdom': ['Manchester', 'Leeds'],
  'United States': ['Tempe'],
  Germany: ['Munich'],
};
const AIRPORTS: [string, string][] = [
  ['New Delhi (DEL)', 'India'], ['Mumbai (BOM)', 'India'], ['Kochi (COK)', 'India'],
  ['Melbourne (MEL)', 'Australia'], ['Sydney (SYD)', 'Australia'],
  ['Toronto (YYZ)', 'Canada'], ['Manchester (MAN)', 'United Kingdom'],
];
const AIRLINES = ['Air India', 'Qantas', 'Emirates', 'Air Canada'];

export async function resetAndSeed() {
  const sql = testSql();
  await sql`TRUNCATE users, student_profiles, flight_details, student_error_logs, admin_invites,
            peer_invites, universities, courses, airports, airlines, cities, rate_limits RESTART IDENTITY CASCADE`;

  for (const [country, names] of Object.entries(UNIVERSITIES))
    for (const name of names) await sql`INSERT INTO universities (name, country) VALUES (${name}, ${country})`;
  for (const [country, labels] of Object.entries(CITIES))
    for (const label of labels) await sql`INSERT INTO cities (label, country) VALUES (${label}, ${country})`;
  for (const [label, country] of AIRPORTS) await sql`INSERT INTO airports (label, country) VALUES (${label}, ${country})`;
  for (const name of AIRLINES) await sql`INSERT INTO airlines (name) VALUES (${name})`;

  const hash = await bcrypt.hash(ADMIN.password, 4);
  await sql`INSERT INTO users (email, password_hash, email_verified, role)
            VALUES (${ADMIN.email}, ${hash}, true, 'admin')`;
}

export async function tableCounts() {
  const sql = testSql();
  const [r] = await sql`SELECT (SELECT count(*) FROM users) users, (SELECT count(*) FROM student_profiles) profiles,
    (SELECT count(*) FROM flight_details) flights, (SELECT count(*) FROM student_error_logs) logs,
    (SELECT count(*) FROM universities) universities, (SELECT count(*) FROM cities) cities,
    (SELECT count(*) FROM airports) airports, (SELECT count(*) FROM airlines) airlines,
    (SELECT count(*) FROM peer_invites) peer_invites, (SELECT count(*) FROM admin_invites) admin_invites`;
  return Object.fromEntries(Object.entries(r).map(([k, v]) => [k, Number(v)]));
}
