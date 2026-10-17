// pre-push: run Playwright e2e only when the backend responds; otherwise warn and skip.
import { spawnSync } from 'node:child_process';

const api = process.env.E2E_API_URL || 'http://localhost:8080/actuator/health';
let up = false;
try {
  const res = await fetch(api, { signal: AbortSignal.timeout(2000) });
  up = res.status < 500;
} catch { /* not running */ }
if (!up) {
  console.warn(`⚠ e2e skipped: backend not responding at ${api}. Start the stack (see RUNNING.md) to run e2e on push.`);
  process.exit(0);
}
const r = spawnSync('npm', ['test'], { cwd: 'e2e', stdio: 'inherit', shell: process.platform === 'win32' });
process.exit(r.status ?? 1);
