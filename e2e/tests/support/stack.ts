import { test } from '@playwright/test';

export const API_BASE = process.env.E2E_API_BASE_URL || 'http://localhost:8080';

/** Seeded demo operator — SEED_CREDENTIALS.md. */
export const SEED_OPERATOR = {
  email: 'ramon.delacruz@ceview.local',
  password: 'MoalboalDive2024!',
};

/** Password used for accounts the specs register; satisfies the backend's password rule. */
export const E2E_PASSWORD = 'MoalboalDive2024!';

async function postJson(path: string, body: unknown, token?: string, method = 'POST') {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : undefined };
}

/**
 * The 6-digit code most recently emailed to `email`, read through the backend's test-support hook
 * (CEVIEW_TEST_SUPPORT_ENABLED=true, with the default EMAIL_PROVIDER=log — nothing is really sent).
 */
export async function latestEmailCode(email: string): Promise<string> {
  const res = await fetch(`${API_BASE}/api/test-support/email-codes/latest?email=${encodeURIComponent(email)}`, {
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`No emailed code for ${email} (HTTP ${res.status})`);
  return ((await res.json()) as { code: string }).code;
}

/**
 * Skips a spec when the backend was started without the code-reading hook, since a spec that has to
 * enter an emailed code cannot run without it.
 */
export async function requireTestSupport() {
  try {
    const res = await fetch(`${API_BASE}/api/test-support/email-codes/latest?email=probe%40example.com`, {
      signal: AbortSignal.timeout(5000),
    });
    test.skip(
      res.status !== 404,
      'Backend lacks the e2e hook — start it with CEVIEW_TEST_SUPPORT_ENABLED=true (see RUNNING.md §5b)',
    );
  } catch {
    test.skip(true, `No backend at ${API_BASE} — run: cd backend && docker compose up -d`);
  }
}

/** Registers an account through the API (it starts unverified) and returns its session token. */
export async function registerViaApi(email: string, password = E2E_PASSWORD): Promise<string> {
  const { status, body } = await postJson('/api/auth/register', {
    firstName: 'E2E',
    lastName: 'Tester',
    email,
    password,
    contactNumber: '+63 917 000 0000',
  });
  if (status !== 200) throw new Error(`register ${email} failed: HTTP ${status}`);
  return body.token as string;
}

/** Verifies an account's email through the API using the emailed code. Safe to call when already verified. */
export async function verifyViaApi(email: string, password: string): Promise<void> {
  const login = await postJson('/api/auth/login', { email, password });
  if (login.status !== 200) throw new Error(`login ${email} failed: HTTP ${login.status}`);
  if (login.body.emailVerified) return;
  const token = login.body.token as string;
  // A 429 means a code was sent moments ago (e.g. at registration); the hook returns that one.
  const send = await postJson('/api/auth/email-verification/send', undefined, token);
  if (send.status !== 202 && send.status !== 429) throw new Error(`send code for ${email} failed: HTTP ${send.status}`);
  const verify = await postJson('/api/auth/email-verification/verify', { code: await latestEmailCode(email) }, token);
  if (verify.status !== 200) throw new Error(`verify ${email} failed: HTTP ${verify.status}`);
}

/**
 * Skips a spec when the backend isn't running, matching the contract tests'
 * behaviour so a developer without Docker sees skips rather than failures.
 */
export async function requireBackend() {
  try {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(SEED_OPERATOR),
      signal: AbortSignal.timeout(5000),
    });
    test.skip(res.status >= 500, `Backend unhealthy at ${API_BASE}`);
  } catch {
    test.skip(true, `No backend at ${API_BASE} — run: cd backend && docker compose up -d`);
  }
}
