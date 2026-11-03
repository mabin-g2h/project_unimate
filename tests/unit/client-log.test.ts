import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// lib/client-log.ts runs in the browser; stub the few globals it touches.
let store: Record<string, string>;
const fetchMock = vi.fn();

beforeEach(() => {
  store = {};
  fetchMock.mockReset();
  vi.resetModules();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
  });
  vi.stubGlobal('navigator', { onLine: true, userAgent: 'test-agent', connection: { effectiveType: '3g', downlink: 1.2, rtt: 300, saveData: false } });
  vi.stubGlobal('document', { visibilityState: 'visible' });
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const load = () => import('@/lib/client-log');
const queue = () => JSON.parse(store['unimate:client-log-queue'] ?? '[]');

describe('reportClient', () => {
  it('sends the event with connection context and nothing queued on success', async () => {
    fetchMock.mockResolvedValue({ status: 204 });
    const { reportClient } = await load();
    reportClient('client_submit_gave_up', { attempt: 3 });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.event).toBe('client_submit_gave_up');
    expect(body.metadata).toMatchObject({ attempt: 3, online: true, user_agent: 'test-agent', net_type: '3g', rtt: 300, visibility: 'visible' });
    expect(fetchMock.mock.calls[0][1].keepalive).toBe(true);
    expect(queue()).toHaveLength(0);
  });

  it('queues the entry when the network is down, and never throws', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    const { reportClient } = await load();
    expect(() => reportClient('client_submit_network_error', { attempt: 1 })).not.toThrow();
    await vi.waitFor(() => expect(queue()).toHaveLength(1));
    expect(queue()[0].event).toBe('client_submit_network_error');
  });

  it('does not queue on a 4xx (e.g. signed out) but does on a 5xx', async () => {
    const { reportClient } = await load();
    fetchMock.mockResolvedValue({ status: 401 });
    reportClient('client_load_failed');
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await new Promise(r => setTimeout(r, 10));
    expect(queue()).toHaveLength(0);
    fetchMock.mockResolvedValue({ status: 503 });
    reportClient('client_load_failed');
    await vi.waitFor(() => expect(queue()).toHaveLength(1));
  });

  it('keeps only the newest 20 queued entries', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    const { reportClient } = await load();
    for (let i = 0; i < 25; i++) reportClient('client_load_failed', { attempt: i });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(25));
    await vi.waitFor(() => expect(queue().length).toBe(20));
    expect(queue().every((e: { metadata: { attempt: number } }) => e.metadata.attempt >= 0)).toBe(true);
  });

  it('survives unavailable storage', async () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); }, removeItem: () => { throw new Error('blocked'); } });
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    const { reportClient, flushClientLogQueue } = await load();
    expect(() => reportClient('client_load_failed')).not.toThrow();
    await expect(flushClientLogQueue()).resolves.toBeUndefined();
  });
});

describe('reportClientOnce', () => {
  it('reports a key once per page visit', async () => {
    fetchMock.mockResolvedValue({ status: 204 });
    const { reportClientOnce } = await load();
    reportClientOnce('validation:phone', 'client_validation_error', { field: 'phone' });
    reportClientOnce('validation:phone', 'client_validation_error', { field: 'phone' });
    reportClientOnce('validation:city', 'client_validation_error', { field: 'city' });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });
});

describe('flushClientLogQueue', () => {
  it('sends queued entries in order, marks them delayed, and empties the queue', async () => {
    const old = Date.now() - 120_000;
    store['unimate:client-log-queue'] = JSON.stringify([
      { event: 'client_submit_network_error', metadata: { attempt: 1 }, at: old },
      { event: 'client_submit_gave_up', metadata: { attempt: 3 }, at: old },
    ]);
    fetchMock.mockResolvedValue({ status: 204 });
    const { flushClientLogQueue } = await load();
    await flushClientLogQueue();
    const sent = fetchMock.mock.calls.map(c => JSON.parse(c[1].body));
    expect(sent.map(s => s.event)).toEqual(['client_submit_network_error', 'client_submit_gave_up']);
    expect(sent[0].metadata.delayed_s).toBeGreaterThanOrEqual(120);
    expect(queue()).toHaveLength(0);
  });

  it('puts entries that still fail back in the queue', async () => {
    store['unimate:client-log-queue'] = JSON.stringify([{ event: 'client_load_failed', metadata: {}, at: Date.now() }]);
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    const { flushClientLogQueue } = await load();
    await flushClientLogQueue();
    expect(queue()).toHaveLength(1);
  });
});
