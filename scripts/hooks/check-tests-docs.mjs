// commit-msg hook: source changes need test changes and doc changes unless the
// commit message carries [no-test: reason] / [no-docs: reason].
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const msg = readFileSync(process.argv[2], 'utf8');
const files = execSync('git diff --cached --name-only --diff-filter=ACMRD', { encoding: 'utf8' })
  .split(/\r?\n/).filter(Boolean);

const isTest = (f) =>
  /^frontend\/tests\//.test(f) || /\.(test|spec)\.[tj]sx?$/.test(f) ||
  /^backend\/spring-boot\/src\/test\//.test(f) || /^backend\/fastapi-[^/]+\/tests\//.test(f) ||
  /^e2e\//.test(f);
const isDoc = (f) => /^docs\//.test(f) || /\.md$/i.test(f);
const isSource = (f) =>
  !isTest(f) && (
    /^frontend\/(components|services|layout|content)\//.test(f) ||
    /^backend\/spring-boot\/src\/main\/(?!resources\/db\/migration\/)/.test(f) && !/\.(properties|ya?ml)$/.test(f) ||
    /^backend\/fastapi-[^/]+\/app\/.*\.py$/.test(f));

const src = files.filter(isSource);
if (!src.length) process.exit(0);

const problems = [];
const tag = (name) => new RegExp(String.raw`\[${name}:\s*\S[^\]]*\]`).test(msg);
if (!files.some(isTest) && !tag('no-test')) problems.push('no test changes (add a test, or tag the message with [no-test: reason])');
if (!files.some(isDoc) && !tag('no-docs')) problems.push('no docs changes (update relevant docs, or tag the message with [no-docs: reason])');
if (problems.length) {
  console.error(`✖ Source files changed (${src.length}, e.g. ${src[0]}) but:`);
  problems.forEach((p) => console.error('  - ' + p));
  process.exit(1);
}
