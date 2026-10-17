// Usage: node check-venv.mjs <service>   e.g. fastapi-sbert
// Fails unless backend/<service>/.venv exists.
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const svc = process.argv[2];
const dir = resolve('backend', svc);
const py = process.platform === 'win32' ? '.venv/Scripts/python.exe' : '.venv/bin/python';
if (!existsSync(resolve(dir, py))) {
  console.error(`✖ Missing virtualenv for ${svc}. One-time setup:`);
  console.error(`  cd backend/${svc} && python -m venv .venv && ${py.replace('/python.exe', '/pip').replace('/python', '/pip')} install -r requirements.txt -r requirements-dev.txt`);
  process.exit(1);
}
