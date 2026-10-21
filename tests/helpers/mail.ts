import { loadTestEnv } from './env';

const api = () => loadTestEnv().MAILPIT_API ?? 'http://127.0.0.1:8025';

export interface MailSummary { ID: string; Subject: string; To: { Address: string }[] }

export async function clearMail() {
  await fetch(`${api()}/api/v1/messages`, { method: 'DELETE' });
}

export async function mailFor(to: string): Promise<MailSummary[]> {
  const r = await fetch(`${api()}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`);
  return ((await r.json()) as { messages: MailSummary[] }).messages ?? [];
}

export async function waitForMail(to: string, subjectIncludes = '', timeoutMs = 15000): Promise<MailSummary> {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    const hit = (await mailFor(to)).find(m => m.Subject.includes(subjectIncludes));
    if (hit) return hit;
    await new Promise(r => setTimeout(r, 400));
  }
  throw new Error(`No mail to ${to} matching "${subjectIncludes}" within ${timeoutMs}ms`);
}

export async function mailHtml(id: string): Promise<string> {
  const r = await fetch(`${api()}/api/v1/message/${id}`);
  return ((await r.json()) as { HTML: string }).HTML;
}

export function firstLink(html: string, pattern: RegExp): string {
  const m = html.match(pattern);
  if (!m) throw new Error(`No link matching ${pattern} in mail`);
  return m[0].replace(/&amp;/g, '&');
}

// Every message to an address, with its rendered HTML — for scanning escaping behaviour.
export async function htmlsFor(to: string, timeoutMs = 8000): Promise<{ subject: string; html: string }[]> {
  const end = Date.now() + timeoutMs;
  let msgs = await mailFor(to);
  while (!msgs.length && Date.now() < end) { await new Promise(r => setTimeout(r, 400)); msgs = await mailFor(to); }
  return Promise.all(msgs.map(async m => ({ subject: m.Subject, html: await mailHtml(m.ID) })));
}
