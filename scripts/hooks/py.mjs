// Usage: node py.mjs <service> <python args...>
// Runs the service's venv python (after the venv check) inside backend/<service>.
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const [svc, ...rest] = process.argv.slice(2);
const chk = spawnSync(process.execPath, [resolve('scripts/hooks/check-venv.mjs'), svc], { stdio: 'inherit' });
if (chk.status !== 0) process.exit(1);
const dir = resolve('backend', svc);
const py = resolve(dir, process.platform === 'win32' ? '.venv/Scripts/python.exe' : '.venv/bin/python');
const r = spawnSync(py, rest, { cwd: dir, stdio: 'inherit' });
process.exit(r.status ?? 1);
