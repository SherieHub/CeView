import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startFakeMeta } from './tests/support/fakeMeta';
import { API_BASE, SEED_OPERATOR, verifyViaApi } from './tests/support/stack';

const HERE = dirname(fileURLToPath(import.meta.url));
export const ENV_FILE = join(HERE, '.cache', 'env.json');

/**
 * 1. Starts the fake Meta server (tests/support/fakeMeta.ts) that docker-compose.e2e.yml points
 *    the backend at.
 * 2. Verifies the seeded demo operator's email, so read-only checks can sign in as them.
 * 3. Probes which test hooks the backend exposes and records it in .cache/env.json, so specs that
 *    need a hook skip with a clear reason instead of failing on a backend started without them.
 *
 * Never throws: a missing backend shows up as skipped specs (requireBackend), not a crashed run.
 */
export default async function globalSetup() {
  const fakeMetaStarted = await startFakeMeta();

  const env = {
    fakeMetaStartedHere: fakeMetaStarted,
    testSupport: false,
    demandWindowHook: false,
  };

  try {
    await verifyViaApi(SEED_OPERATOR.email, SEED_OPERATOR.password);
  } catch (err) {
    console.warn(
      `[e2e] Could not verify the seeded operator at ${API_BASE}: ${(err as Error).message}\n` +
        '[e2e] Start the stack with: cd backend && docker compose -f docker-compose.yml -f docker-compose.e2e.yml up -d --build',
    );
  }

  try {
    const codes = await fetch(`${API_BASE}/api/test-support/email-codes/latest?email=probe%40example.com`);
    env.testSupport = codes.status === 404;
    const dw = await fetch(`${API_BASE}/api/test-support/demand-window`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'probe@example.com' }),
    });
    env.demandWindowHook = dw.status === 404;
  } catch {
    /* backend down — specs skip themselves */
  }

  mkdirSync(dirname(ENV_FILE), { recursive: true });
  writeFileSync(ENV_FILE, JSON.stringify(env, null, 2));
}
