import { defineConfig, devices } from '@playwright/test';

const API_BASE = process.env.E2E_API_BASE_URL || 'http://localhost:8080';
const CI = !!process.env.CI;

/** Lead-form endpoint baked into the main frontend; tests stub this host (the provider only). */
export const LEAD_FORM_ENDPOINT = 'https://leads.e2e.ceview.invalid/submit';

/**
 * Frontend env shared by both dev servers: real backend (no fixtures), and blank Firebase so
 * sign-up uses the plain-number "verify later" path — no real SMS or Google popup in e2e.
 */
const frontendEnv = {
  ...process.env,
  VITE_USE_FIXTURES: 'false',
  VITE_API_BASE_URL: API_BASE,
  VITE_FIREBASE_API_KEY: '',
  VITE_FIREBASE_AUTH_DOMAIN: '',
  VITE_FIREBASE_PROJECT_ID: '',
  VITE_FIREBASE_APP_ID: '',
} as Record<string, string>;

export default defineConfig({
  testDir: './tests',
  globalSetup: './global-setup.ts',
  globalTeardown: './global-teardown.ts',
  fullyParallel: true,
  // Live Groq/SBERT calls rate-limit under heavy parallelism; @ai files also run serially.
  workers: CI ? 2 : 4,
  retries: CI ? 2 : 0,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ...(CI ? ([['github'], ['junit', { outputFile: 'test-results/junit.xml' }]] as const) : []),
  ],
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3012',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      grepInvert: /@mobile|@alt-env|@degraded/,
    },
    {
      name: 'chromium-mobile',
      use: { ...devices['Pixel 7'] },
      grep: /@mobile/,
    },
    {
      // Same app built with no lead-form endpoint and no contact email ("requests aren't open").
      name: 'chromium-alt-env',
      use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:3013' },
      grep: /@alt-env/,
    },
    ...(process.env.E2E_DEGRADED
      ? [
          {
            // Stops fastapi-transformer for the duration; never part of a default run.
            name: 'degraded',
            use: { ...devices['Desktop Chrome'] },
            grep: /@degraded/,
            fullyParallel: false,
          },
        ]
      : []),
  ],
  webServer: [
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 3012 --strictPort',
      cwd: '../frontend',
      url: 'http://127.0.0.1:3012',
      env: {
        ...frontendEnv,
        VITE_LEAD_FORM_ENDPOINT: LEAD_FORM_ENDPOINT,
        VITE_CONTACT_EMAIL: 'hello@ceview.local',
      },
      reuseExistingServer: !CI,
      timeout: 120_000,
    },
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 3013 --strictPort',
      cwd: '../frontend',
      url: 'http://127.0.0.1:3013',
      env: { ...frontendEnv, VITE_LEAD_FORM_ENDPOINT: '', VITE_CONTACT_EMAIL: '' },
      reuseExistingServer: !CI,
      timeout: 120_000,
    },
  ],
});
