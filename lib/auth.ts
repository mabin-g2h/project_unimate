import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { cookies } from 'next/headers';
import { sql } from '@/lib/db';

const secret = new TextEncoder().encode(process.env.JWT_SECRET!);

export interface SessionPayload extends JWTPayload {
  userId: number;
  email: string;
  role: string;
  emailVerified: boolean;
  // users.token_version at issue time. Bumped on demote / password reset to revoke every
  // older token. Tokens issued before this existed have no `tv` and count as 0.
  tv?: number;
}

export async function signToken(payload: Omit<SessionPayload, keyof JWTPayload>) {
  return new SignJWT(payload as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .sign(secret);
}

export async function verifyToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as SessionPayload;
  } catch {
    return null;
  }
}

// Verifies the JWT, then re-checks it against the DB so a deleted user, a demoted admin or a
// token revoked by a password reset / demotion stops working immediately (not after 7 days).
// Role, email and emailVerified are taken from the DB row, never from the token.
export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload) return null;

  const [user] = await sql`
    SELECT email, role, email_verified, token_version FROM users WHERE id = ${payload.userId}
  `;
  if (!user || (payload.tv ?? 0) !== user.token_version) return null;

  return { ...payload, email: user.email, role: user.role, emailVerified: user.email_verified, tv: user.token_version };
}

export function makeSessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  };
}
