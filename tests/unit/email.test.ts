import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const sendMail = vi.fn();
const createTransport = vi.fn(() => ({ sendMail }));
const logMock = vi.fn(async () => {});
vi.mock('nodemailer', () => ({ default: { createTransport: (...a: unknown[]) => (createTransport as (...x: unknown[]) => unknown)(...a) } }));
vi.mock('@/lib/logger', () => ({ log: (...a: unknown[]) => (logMock as (...x: unknown[]) => unknown)(...a) }));

beforeEach(() => { sendMail.mockReset(); createTransport.mockClear(); logMock.mockClear(); vi.resetModules(); vi.stubEnv('APP_URL', 'http://localhost:3100'); vi.stubEnv('GMAIL_USER', 'noreply@unimate.test'); });
afterEach(() => vi.unstubAllEnvs());
const load = () => import('@/lib/email');

describe('transport selection', () => {
  it('uses Gmail with auth by default', async () => {
    vi.stubEnv('SMTP_HOST', '');
    await load();
    expect(createTransport.mock.calls[0][0]).toMatchObject({ host: 'smtp.gmail.com', port: 587, auth: { user: 'noreply@unimate.test' } });
  });
  it('uses plain SMTP (no auth, no TLS) when SMTP_HOST is set', async () => {
    vi.stubEnv('SMTP_HOST', '127.0.0.1'); vi.stubEnv('SMTP_PORT', '1025');
    await load();
    const opts = createTransport.mock.calls[0][0] as Record<string, unknown>;
    expect(opts).toMatchObject({ host: '127.0.0.1', port: 1025, secure: false, ignoreTLS: true });
    expect(opts.auth).toBeUndefined();
  });
});

describe('deliver() logging (via sendVerificationEmail)', () => {
  it('logs one email_sent row with type + subject only - never the body or token link', async () => {
    sendMail.mockResolvedValue({});
    await (await load()).sendVerificationEmail('Student@Example.test', 'SECRETTOKEN123');
    expect(logMock).toHaveBeenCalledTimes(1);
    const entry = logMock.mock.calls[0][0] as { event: string; level: string; email: string; metadata: Record<string, unknown> };
    expect(entry).toMatchObject({ event: 'email_sent', level: 'info', email: 'student@example.test' });
    expect(Object.keys(entry.metadata).sort()).toEqual(['subject', 'type']);
    expect(JSON.stringify(entry)).not.toContain('SECRETTOKEN123');
  });
  it('on failure logs exactly one email_send_failed row and rethrows the original error', async () => {
    const boom = new Error('SMTP down');
    sendMail.mockRejectedValue(boom);
    await expect((await load()).sendVerificationEmail('a@b.test', 't')).rejects.toBe(boom);
    expect(logMock).toHaveBeenCalledTimes(1);
    expect(logMock.mock.calls[0][0]).toMatchObject({ event: 'email_send_failed', level: 'error' });
  });
});

describe('HTML escaping', () => {
  const xss = "<img/src=x/onerror=alert('z')>";
  const sentHtml = () => (sendMail.mock.calls[0][0] as { html: string }).html;
  it('control: revoke, unrevoke and peer-invite templates escape user input', async () => {
    sendMail.mockResolvedValue({});
    const m = await load();
    await m.sendRevokeEmail('a@b.test', xss, xss); expect(sentHtml()).not.toContain(xss);
    sendMail.mockClear(); await m.sendUnrevokeEmail('a@b.test', xss); expect(sentHtml()).not.toContain(xss);
    sendMail.mockClear(); await m.sendPeerInviteEmail('a@b.test', xss, xss); expect(sentHtml()).not.toContain(xss);
  });
  // FINDING F-21: these templates interpolate the first name / university without escapeHtml.
  it.fails.each([
    ['sendRegistrationAcknowledgement', (m: Awaited<ReturnType<typeof load>>) => m.sendRegistrationAcknowledgement('a@b.test', xss)],
    ['sendApprovalEmail', (m: Awaited<ReturnType<typeof load>>) => m.sendApprovalEmail('a@b.test', xss)],
    ['sendRejectionEmail', (m: Awaited<ReturnType<typeof load>>) => m.sendRejectionEmail('a@b.test', xss, 'reason')],
    ['sendAccountExpiredEmail', (m: Awaited<ReturnType<typeof load>>) => m.sendAccountExpiredEmail('a@b.test', xss)],
    ['sendNewPeerNotificationEmail', (m: Awaited<ReturnType<typeof load>>) => m.sendNewPeerNotificationEmail('a@b.test', xss, xss)],
    ['sendAdminRegistrationNotification', (m: Awaited<ReturnType<typeof load>>) => m.sendAdminRegistrationNotification('a@b.test', xss, 'x@y.test')],
  ])('%s escapes user-controlled values', async (_n, call) => {
    sendMail.mockResolvedValue({});
    await call(await load());
    expect(sentHtml()).not.toContain(xss);
  });
});
