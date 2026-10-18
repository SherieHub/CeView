import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    // A dedicated port avoids silently reusing a developer's fixture-mode Vite
    // server on 3001. The browser suite owns the 3012 process below.
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3012',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 3012',
    cwd: '../frontend',
    url: 'http://127.0.0.1:3012',
    // Blank Firebase config so signup uses the plain-number fallback (no real SMS in e2e),
    // even if frontend/.env has Firebase set up for Google sign-in / phone OTP.
    env: {
      ...process.env,
      VITE_USE_FIXTURES: 'false',
      VITE_FIREBASE_API_KEY: '',
      VITE_FIREBASE_AUTH_DOMAIN: '',
      VITE_FIREBASE_PROJECT_ID: '',
      VITE_FIREBASE_APP_ID: '',
    },
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
