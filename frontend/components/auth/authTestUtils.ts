/**
 * Test helpers for the auth screens: a fetch stub that answers by "METHOD /path" so a test can
 * describe the backend it expects rather than ordering mockReturnValueOnce calls.
 */
import { vi } from 'vitest';

export type Handler = (body: Record<string, unknown> | undefined) => { status?: number; body: unknown };

export function json(body: unknown, status = 200): { status: number; body: unknown } {
  return { status, body };
}

export function stubBackend(routes: Record<string, Handler>) {
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    const path = new URL(url).pathname;
    const key = `${init?.method ?? 'GET'} ${path}`;
    const handler = routes[key];
    if (!handler) {
      return Promise.resolve(new Response(JSON.stringify({ error: `unexpected ${key}` }), { status: 500 }));
    }
    const parsed = init?.body ? (JSON.parse(init.body as string) as Record<string, unknown>) : undefined;
    const { status = 200, body } = handler(parsed);
    return Promise.resolve(new Response(JSON.stringify(body), { status }));
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

/** Calls made to "METHOD /path", with their parsed JSON bodies. */
export function callsTo(fetchMock: ReturnType<typeof vi.fn>, key: string): Array<Record<string, unknown> | undefined> {
  const [method, path] = key.split(' ');
  return fetchMock.mock.calls
    .filter(([url, init]) => new URL(url as string).pathname === path && ((init as RequestInit | undefined)?.method ?? 'GET') === method)
    .map(([, init]) => ((init as RequestInit | undefined)?.body ? JSON.parse((init as RequestInit).body as string) : undefined));
}
