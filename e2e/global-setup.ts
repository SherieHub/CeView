import { API_BASE, SEED_OPERATOR, verifyViaApi } from './tests/support/stack';

/**
 * Every account must verify its email once, seeded demo operators included, and the specs that
 * sign in as SEED_OPERATOR through the UI would otherwise all land on /verify-email. Verify that
 * operator up front through the API, reading the code from the backend's test-support hook.
 *
 * Never throws: with no backend the specs skip themselves (requireBackend), and a backend without
 * the hook is reported here so the resulting seed-login failures are explainable.
 */
export default async function globalSetup() {
  try {
    await verifyViaApi(SEED_OPERATOR.email, SEED_OPERATOR.password);
  } catch (err) {
    console.warn(
      `[e2e] Could not verify the seeded operator at ${API_BASE}: ${(err as Error).message}\n` +
        '[e2e] Specs that sign in as the seeded operator will stop at /verify-email. ' +
        'Start the backend with CEVIEW_TEST_SUPPORT_ENABLED=true (see RUNNING.md §5b).',
    );
  }
}
