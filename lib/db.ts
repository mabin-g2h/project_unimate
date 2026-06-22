import { neon, neonConfig } from '@neondatabase/serverless';

// On this machine, Node.js's built-in fetch (undici) tries IPv6 before IPv4.
// IPv6 has no route here, so all DB queries time out.
// Fix: override neonConfig.fetchFunction with a custom https.request-based
// implementation that forces IPv4 via the `lookup` option.
// Only applied in development; production (Vercel) has proper IPv6 routing.
if (process.env.NODE_ENV === 'development') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const https = require('node:https') as typeof import('https');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const dns = require('node:dns') as typeof import('dns');

  const ipv4Lookup: import('https').RequestOptions['lookup'] = (host, opts, cb) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    dns.lookup(host, { ...opts, family: 4 }, cb as any);

  neonConfig.fetchFunction = (url: string, opts?: RequestInit) =>
    new Promise<Response>((resolve, reject) => {
      const parsed = new URL(url);
      const reqHeaders: Record<string, string> = {};
      if (opts?.headers) {
        if (opts.headers instanceof Headers) {
          opts.headers.forEach((v, k) => { reqHeaders[k] = v; });
        } else if (Array.isArray(opts.headers)) {
          (opts.headers as [string, string][]).forEach(([k, v]) => { reqHeaders[k] = v; });
        } else {
          Object.assign(reqHeaders, opts.headers);
        }
      }

      const req = https.request({
        hostname: parsed.hostname,
        port: Number(parsed.port || 443),
        path: parsed.pathname + parsed.search,
        method: (opts?.method as string) ?? 'POST',
        headers: reqHeaders,
        lookup: ipv4Lookup,
      }, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => {
          const body = Buffer.concat(chunks);
          const headers = new Headers();
          for (const [k, v] of Object.entries(res.headers)) {
            if (v !== undefined) headers.set(k, Array.isArray(v) ? v.join(', ') : v);
          }
          resolve(new Response(body, { status: res.statusCode ?? 200, headers }));
        });
        res.on('error', reject);
      });
      req.on('error', reject);
      if (opts?.body) req.write(opts.body as string);
      req.end();
    });
}

export const sql = neon(process.env.DATABASE_CONNECTION_STRING!);
