import { test as base, expect } from '@playwright/test';
import { provisionOperator, signIn, type Operator, type ProvisionOptions } from './operator';

/**
 * Live AI calls (Groq, SBERT, the forecast engine) go Spring → FastAPI with a 90 s timeout
 * (application.yml `timeout-seconds: 90`), so an `@ai` test waits up to AI_WAIT for a result and gets
 * a long overall budget.
 */
export const AI_WAIT = 100_000;
const AI_TEST_TIMEOUT = 240_000;

type Fixtures = {
  /** A fresh operator for this test only — for tests that mutate state destructively. */
  freshOperator: Operator;
  /** A second, unrelated tenant for isolation checks. */
  otherOperator: Operator;
  _aiTimeout: void;
};

export const test = base.extend<Fixtures>({
  freshOperator: async ({}, use, testInfo) => {
    await use(await provisionOperator(screenOf(testInfo.file)));
  },
  otherOperator: async ({}, use, testInfo) => {
    await use(await provisionOperator(`${screenOf(testInfo.file)}-other`, { businessName: 'Other Tenant Cafe' }));
  },
  _aiTimeout: [
    async ({}, use, testInfo) => {
      if (testInfo.tags.includes('@ai')) testInfo.setTimeout(AI_TEST_TIMEOUT);
      await use();
    },
    { auto: true },
  ],
});

export { expect };

function screenOf(file: string): string {
  const parts = file.replace(/\\/g, '/').split('/');
  return (parts[parts.length - 1] ?? 'spec').replace(/\.spec\.ts$/, '');
}

/**
 * One operator shared by the tests of a spec file (per worker, since fully-parallel files spread
 * across workers). Call at the top of a file; read `.current` inside tests.
 */
export function useOperator(screen: string, opts: ProvisionOptions = {}) {
  const holder: { current: Operator } = { current: undefined as unknown as Operator };
  test.beforeAll(async () => {
    test.setTimeout(120_000);
    holder.current = await provisionOperator(screen, opts);
  });
  return holder;
}

export { provisionOperator, signIn };
export type { Operator };
