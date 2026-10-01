/**
 * Live contract-test support. Probes the backend once per run; when nothing
 * answers, suites call describeIfBackend(...) and are skipped rather than failed.
 *
 * Requires the Docker stack: cd backend && docker compose up -d
 * Seeded operator credentials:
 *   backend/spring-boot/src/main/resources/db/migration/SEED_CREDENTIALS.md
 */
import { describe } from 'vitest';

// `||` (not `??`) deliberately: the repo's .env ships `VITE_API_BASE_URL=` (blank),
// which reads back as `''`, not undefined/null — same fallback rule as apiClient.ts.
export const BASE_URL = process.env.VITE_API_BASE_URL || 'http://localhost:8080';

/** Seeded demo operator — Moalboal FreeDive Cebu, category "Coastal & Island". */
export const SEED_OPERATOR = {
  email: 'ramon.delacruz@ceview.local',
  password: 'MoalboalDive2024!',
};

let reachable: boolean | null = null;

export async function isBackendUp(): Promise<boolean> {
  if (reachable !== null) return reachable;
  try {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(SEED_OPERATOR),
      signal: AbortSignal.timeout(3000),
    });
    reachable = res.status < 500;
  } catch {
    reachable = false;
  }
  return reachable;
}

let cachedToken: string | null = null;

/** Logs in as the seeded operator and caches the JWT for the whole run. */
export async function seedToken(): Promise<string> {
  if (cachedToken) return cachedToken;
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(SEED_OPERATOR),
  });
  if (!res.ok) {
    throw new Error(
      `Seeded login failed with ${res.status}. Is Flyway seed V2 applied? ` +
      `Run: cd backend && docker compose up -d`,
    );
  }
  const { token } = (await res.json()) as { token: string };
  cachedToken = token;
  return token;
}

/** Authenticated fetch against the live backend. */
export async function api(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const token = await seedToken();
  return fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  });
}

/**
 * describe() that skips the whole suite when no backend is reachable.
 * Vitest needs the skip decision synchronously, so the probe runs at module
 * load via a top-level await in each contract suite.
 */
export function describeIfBackend(up: boolean, name: string, fn: () => void) {
  const d = up ? describe : describe.skip;
  d(name, fn);
  if (!up) {
    console.warn(`[contract] skipped "${name}" — no backend at ${BASE_URL}`);
  }
}
