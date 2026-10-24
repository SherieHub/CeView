import { API_BASE } from './stack';

export interface ApiResult<T = any> {
  status: number;
  body: T;
}

/** Thrown by the `*OrThrow` helpers when the backend answers outside 2xx. */
export class ApiCallError extends Error {
  constructor(
    readonly method: string,
    readonly path: string,
    readonly status: number,
    readonly body: unknown,
  ) {
    super(`${method} ${path} → HTTP ${status}: ${JSON.stringify(body)}`);
  }
}

async function call<T>(method: string, path: string, token: string | undefined, body?: unknown, timeoutMs = 30_000): Promise<ApiResult<T>> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await res.text();
  let parsed: unknown = undefined;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }
  return { status: res.status, body: parsed as T };
}

/**
 * Real-backend client bound to one operator's JWT (or none, for public endpoints). The plain verbs
 * return `{status, body}` so tests can assert on error statuses; the `*OrThrow` variants are for
 * test setup, where anything but 2xx means the scenario can't be built.
 */
export function api(token?: string) {
  const ok = async <T>(method: string, path: string, body?: unknown, timeoutMs?: number) => {
    const r = await call<T>(method, path, token, body, timeoutMs);
    if (r.status < 200 || r.status >= 300) throw new ApiCallError(method, path, r.status, r.body);
    return r.body;
  };
  return {
    get: <T = any>(path: string) => call<T>('GET', path, token),
    post: <T = any>(path: string, body?: unknown, timeoutMs?: number) => call<T>('POST', path, token, body, timeoutMs),
    put: <T = any>(path: string, body?: unknown, timeoutMs?: number) => call<T>('PUT', path, token, body, timeoutMs),
    patch: <T = any>(path: string, body?: unknown) => call<T>('PATCH', path, token, body),
    del: <T = any>(path: string) => call<T>('DELETE', path, token),
    getOrThrow: <T = any>(path: string) => ok<T>('GET', path),
    postOrThrow: <T = any>(path: string, body?: unknown, timeoutMs?: number) => ok<T>('POST', path, body, timeoutMs),
    putOrThrow: <T = any>(path: string, body?: unknown, timeoutMs?: number) => ok<T>('PUT', path, body, timeoutMs),
    patchOrThrow: <T = any>(path: string, body?: unknown) => ok<T>('PATCH', path, body),
    delOrThrow: <T = any>(path: string) => ok<T>('DELETE', path),
  };
}
