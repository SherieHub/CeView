import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests', testMatch: 'social-publishing.spec.ts', workers: 1,
  timeout: 60000, use: { baseURL: 'http://127.0.0.1:3013', headless: true },
  webServer: { command: 'npm run dev -- --host 127.0.0.1 --port 3013', cwd: '../frontend', url: 'http://127.0.0.1:3013', reuseExistingServer: false, timeout: 60000, env: { VITE_USE_FIXTURES: 'false' } },
});
