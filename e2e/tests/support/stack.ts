import { test } from '@playwright/test';

export const API_BASE = process.env.E2E_API_BASE_URL || 'http://localhost:8080';

/** Seeded demo operator — SEED_CREDENTIALS.md. */
export const SEED_OPERATOR = {
  email: 'ramon.delacruz@ceview.local',
  password: 'MoalboalDive2024!',
};

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
