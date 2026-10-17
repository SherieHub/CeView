// Usage: node scripts/hooks/run-and-scan.mjs <cwd> -- <cmd> [args...]
// Runs a command, streams its output, and fails on a non-zero exit OR on any
// ERROR line not matched by scripts/hooks/error-allowlist.txt.
import { spawn } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const sep = args.indexOf('--');
if (sep < 1 || sep === args.length - 1) {
  console.error('usage: run-and-scan.mjs <cwd> -- <cmd> [args...]');
  process.exit(2);
}
const cwd = resolve(args[0]);
const [cmd, ...cmdArgs] = args.slice(sep + 1);

const allowFile = join(here, 'error-allowlist.txt');
const allow = existsSync(allowFile)
  ? readFileSync(allowFile, 'utf8')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'))
      .map((l) => new RegExp(l))
  : [];

const ERROR_RE = /\bERROR\b/;
const offending = [];
let buffer = '';
const scan = (chunk) => {
  buffer += chunk.toString();
  const lines = buffer.split(/\r?\n/);
  buffer = lines.pop();
  for (const line of lines) {
    if (ERROR_RE.test(line) && !allow.some((re) => re.test(line))) offending.push(line);
  }
};

// On Windows, npm/npx are .cmd shims and need a shell; pass one string to avoid Node's DEP0190 warning.
const child = process.platform === 'win32'
  ? spawn([cmd, ...cmdArgs].join(' '), { cwd, shell: true, env: process.env })
  : spawn(cmd, cmdArgs, { cwd, env: process.env });
child.stdout.on('data', (d) => { process.stdout.write(d); scan(d); });
child.stderr.on('data', (d) => { process.stderr.write(d); scan(d); });
child.on('error', (e) => { console.error(`failed to start ${cmd}: ${e.message}`); process.exit(1); });
child.on('close', (code) => {
  scan('\n');
  if (code !== 0) process.exit(code ?? 1);
  if (offending.length) {
    console.error(`\n✖ ${offending.length} unexpected ERROR line(s) in output of "${cmd} ${cmdArgs.join(' ')}":`);
    offending.slice(0, 20).forEach((l) => console.error('  ' + l));
    console.error('Fix the cause, or add an expected pattern to scripts/hooks/error-allowlist.txt.');
    process.exit(1);
  }
});
