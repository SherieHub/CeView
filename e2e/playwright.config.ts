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
    env: { ...process.env, VITE_USE_FIXTURES: 'false' },
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
