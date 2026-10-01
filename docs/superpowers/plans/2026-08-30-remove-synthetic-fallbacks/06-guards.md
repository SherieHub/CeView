# Phase 5 — Making It Stick (Tasks 36–40)

Task 25 already made a fallback source unrepresentable — that is the primary
defense. This phase adds the backstops: a guard that catches a reintroduction in
review, a test suite that proves the failure path actually works, and docs so the
next developer knows what a red panel means.

**Prerequisite:** Phases 0–4 complete (Tasks 1–35).

---

### Task 36: `scripts/no-synthetic-data.mjs` guard

Matches **identifiers, not prose**. Matching the word "fallback" would fire on
legitimate comments, and a guard that cries wolf is a guard someone disables.

**Files:**
- Create: `scripts/no-synthetic-data.mjs`
- Create: `scripts/synthetic-data-allowlist.json`
- Create: `scripts/no-synthetic-data.test.mjs`
- Modify: `package.json` (root) — add the `guard:synthetic` script

- [ ] **Step 1: Write the allowlist**

```json
{
  "$comment": "Every entry needs a reason. An allowlist without justifications becomes a place to hide things.",
  "allow": [
    {
      "identifier": "PESComputationService",
      "path": "backend/spring-boot/src/main/java/com/ceview/module4/pes/PESComputationService.java",
      "reason": "Not a fallback. This is the deterministic PES formula from ARCHITECTURE_SPEC.md — arithmetic over real campaign records. Its javadoc previously mischaracterised it as the FR4.26 rule-based fallback, which is why it needs an explicit entry: the name reads like one of the deleted helpers but the code is load-bearing."
    }
  ]
}
```

- [ ] **Step 2: Write the failing test**

Create `scripts/no-synthetic-data.test.mjs`:

```javascript
import { describe, expect, it } from 'vitest';
import { scan } from './no-synthetic-data.mjs';

describe('no-synthetic-data guard', () => {
  it('flags a banned identifier', () => {
    const hits = scan([{ path: 'a.py', content: 'def _mock_captions():\n    return {}\n' }]);

    expect(hits).toHaveLength(1);
    expect(hits[0].identifier).toBe('_mock_captions');
    expect(hits[0].line).toBe(1);
  });

  it('ignores the identifier appearing in prose', () => {
    const hits = scan([
      { path: 'a.py', content: '# We used to have a fallback here. Not any more.\n' },
    ]);

    expect(hits).toEqual([]);
  });

  it('ignores a banned substring inside a longer identifier', () => {
    const hits = scan([{ path: 'a.py', content: 'my_stub_resultant_value = 1\n' }]);

    expect(hits).toEqual([]);
  });

  it('does not flag MOCK_ inside a test file', () => {
    const hits = scan([
      { path: 'frontend/services/foo.test.ts', content: 'const MOCK_POSTS = [];\n' },
    ]);

    expect(hits).toEqual([]);
  });

  it('flags MOCK_ inside a production frontend file', () => {
    const hits = scan([{ path: 'frontend/services/foo.ts', content: 'const MOCK_POSTS = [];\n' }]);

    expect(hits).toHaveLength(1);
  });

  it('honours the allowlist', () => {
    const hits = scan(
      [{ path: 'allowed.java', content: 'class PESComputationService {}\n' }],
      { allow: [{ identifier: 'PESComputationService', path: 'allowed.java', reason: 'x' }] },
    );

    expect(hits).toEqual([]);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npx vitest run scripts/no-synthetic-data.test.mjs
```

Expected: FAIL — module not found

- [ ] **Step 4: Implement**

```javascript
#!/usr/bin/env node
/**
 * Fails the build if a deleted synthetic-data identifier comes back.
 *
 * This is the *backup* mechanism. The primary one is the Literal["groq"] /
 * ContentSource enum from Task 25 — returning a fallback is a runtime validation
 * error there, which no one can quietly delete without a visible type change.
 * This script catches the rest: helper functions, stub constants, the frontend
 * fixture layer.
 *
 * It matches whole identifiers, never prose. "We removed the fallback" in a
 * comment is fine and must stay fine — a guard that fires on English is a guard
 * that gets switched off within a month.
 *
 * Usage: node scripts/no-synthetic-data.mjs
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/** Identifiers deleted by the 2026-08-30 synthetic-fallback removal. */
const BANNED = [
  // fastapi-sbert — Tier A
  '_mock_captions', '_fallback_captions', '_FALLBACK_SERVICES',
  '_NAVER_OPTIONS', '_NAVER_OPTION_NAMES', '_creative_fallback',
  '_FALLBACK_PAYLOAD', '_FALLBACK_REPORT', '_FALLBACK_EVALUATION', '_fallback_report',
  // fastapi-transformer — Tier C
  '_STUB_BASE', '_STUB_SERIES', '_stub_result', 'ml_stubs',
  // spring-boot
  'buildRuleBasedReport', 'buildOfflinePesAnalysisFallback',
  'gdpTrendFallback', 'forexTrendFallback',
  // frontend — Tier B
  'VITE_USE_FIXTURES', 'services/fixtures',
];

/** `MOCK_` is only banned in production frontend code — tests may declare doubles. */
const MOCK_PREFIX = /\bMOCK_[A-Z_]+\b/;

const SCAN_DIRS = ['backend', 'frontend', 'e2e', 'scripts'];
const SCAN_EXT = /\.(py|java|ts|tsx|mjs|js|yml|yaml|sql)$/;
const SKIP_DIR = /(^|\/)(node_modules|__pycache__|\.venv|target|dist|build|\.git)(\/|$)/;
const TEST_FILE = /(\.test\.|\.spec\.|(^|\/)tests?\/|(^|\/)__fixtures__\/)/;

/** Escape a literal for use inside a RegExp. */
function escape(literal) {
  return literal.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
}

/**
 * A banned identifier matched as a whole token.
 *
 * `\b` alone is wrong for names starting with `_`: JS word-boundaries treat `_`
 * as a word character, so `\b_stub_result\b` would also match inside
 * `my_stub_result`. The explicit non-identifier-char lookarounds fix that.
 */
function pattern(identifier) {
  return new RegExp(`(?<![A-Za-z0-9_])${escape(identifier)}(?![A-Za-z0-9_])`);
}

export function scan(files, allowlist = { allow: [] }) {
  const allowed = new Set(allowlist.allow.map((a) => `${a.path}::${a.identifier}`));
  const hits = [];

  for (const file of files) {
    const lines = file.content.split('\n');

    lines.forEach((line, index) => {
      for (const identifier of BANNED) {
        if (!pattern(identifier).test(line)) continue;
        if (allowed.has(`${file.path}::${identifier}`)) continue;
        hits.push({ path: file.path, line: index + 1, identifier, text: line.trim() });
      }

      if (!TEST_FILE.test(file.path) && file.path.startsWith('frontend/')) {
        const match = line.match(MOCK_PREFIX);
        if (match && !allowed.has(`${file.path}::${match[0]}`)) {
          hits.push({ path: file.path, line: index + 1, identifier: match[0], text: line.trim() });
        }
      }
    });
  }

  return hits;
}

function collect(dir, root, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const rel = relative(root, full).replace(/\\/g, '/');
    if (SKIP_DIR.test(rel)) continue;

    if (statSync(full).isDirectory()) collect(full, root, out);
    else if (SCAN_EXT.test(entry)) out.push({ path: rel, content: readFileSync(full, 'utf8') });
  }
  return out;
}

function main() {
  const root = process.cwd();
  const allowlist = JSON.parse(readFileSync(join(root, 'scripts/synthetic-data-allowlist.json'), 'utf8'));

  const files = SCAN_DIRS.flatMap((dir) => {
    try { return collect(join(root, dir), root); } catch { return []; }
  });

  const hits = scan(files, allowlist);

  if (hits.length === 0) {
    console.log(`no-synthetic-data: clean (${files.length} files scanned)`);
    return;
  }

  console.error('\nno-synthetic-data: banned identifiers found.\n');
  console.error('These were deleted by the 2026-08-30 synthetic-fallback removal. If you are');
  console.error('reintroducing one deliberately, add it to scripts/synthetic-data-allowlist.json');
  console.error('with a reason — and expect that reason to be read in review.\n');
  for (const hit of hits) {
    console.error(`  ${hit.path}:${hit.line}  ${hit.identifier}`);
    console.error(`      ${hit.text}`);
  }
  console.error(`\n${hits.length} violation(s).\n`);
  process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npx vitest run scripts/no-synthetic-data.test.mjs
```

Expected: PASS — 6 passed

- [ ] **Step 6: Run the guard against the real tree**

```bash
node scripts/no-synthetic-data.mjs
```

Expected: `no-synthetic-data: clean (N files scanned)`. Any violation means an
earlier phase is incomplete — fix the code, not the guard.

- [ ] **Step 7: Add the npm script**

In the root `package.json`, under `scripts`:

```json
    "guard:synthetic": "node scripts/no-synthetic-data.mjs"
```

- [ ] **Step 8: Commit** *(operator runs this)*

```bash
git add scripts/ package.json
git commit -m "feat(ci): guard against reintroduced synthetic-data identifiers"
```

---

### Task 37: Wire the guard into all six CI workflows

**Files:**
- Modify: `.github/workflows/ci-frontend.yml`, `ci-frontend-v2.yml`,
  `ci-spring-boot.yml`, `ci-fastapi-sbert.yml`, `ci-fastapi-transformer.yml`, `e2e.yml`

- [ ] **Step 1: Add the step to each workflow**

In each file, after the checkout step and before the language-specific setup, insert:

```yaml
      - name: Guard against synthetic data
        run: node scripts/no-synthetic-data.mjs
```

The Python and Java workflows need Node for this. Add before it, if not present:

```yaml
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
```

Running it in all six — rather than one — is deliberate: a contributor touching only
the Python service still gets the check, and no workflow is "the one that matters".

- [ ] **Step 2: Verify the YAML parses**

```bash
for f in .github/workflows/*.yml; do node -e "
  const yaml=require('js-yaml');
  yaml.load(require('fs').readFileSync('$f','utf8'));
  console.log('ok $f');
"; done
```

If `js-yaml` is unavailable, `npx --yes js-yaml .github/workflows/e2e.yml > /dev/null`
per file works equally well.

- [ ] **Step 3: Commit** *(operator runs this)*

```bash
git add .github/workflows/
git commit -m "ci: run the synthetic-data guard in every workflow"
```

---

### Task 38: Negative-path contract tests

The existing 13 contract tests assert success shapes. These assert the *failure*
shape — the one that used to be a cheerful 200 full of canned captions.

**Files:**
- Create: `frontend/tests/contract/unavailable.contract.test.ts`
- Create: `backend/docker-compose.no-llm.yml`
- Modify: `frontend/package.json` — add `test:contract:unavailable`

- [ ] **Step 1: Write the compose override**

Create `backend/docker-compose.no-llm.yml`:

```yaml
# Deliberately unconfigured LLM, for the negative-path contract tests.
#
# Before the synthetic-fallback removal this configuration returned HTTP 200 with
# canned captions and a placeholder report — indistinguishable from success. These
# tests exist to prove that can no longer happen.
services:
  fastapi:
    environment:
      GROQ_API_KEY: ""
  fastapi-transformer:
    environment:
      GROQ_API_KEY: ""
```

- [ ] **Step 2: Write the test**

```typescript
/**
 * With no GROQ_API_KEY, every AI endpoint must answer 503 with a dependency and a
 * cause. Never 200. Never canned text.
 *
 * Run with: npm run test:contract:unavailable
 * Requires: docker compose -f docker-compose.yml -f docker-compose.no-llm.yml up -d
 */
import { describe, expect, it, beforeAll } from 'vitest';
import { backendAvailable, loginAsSeededOperator } from './backendProbe';

const AI_ENDPOINTS: Array<{ path: string; method: 'GET' | 'POST'; body?: unknown }> = [
  {
    path: '/api/content/generate',
    method: 'POST',
    body: {
      market: 'korea', businessName: 'Test Dive Co', description: 'Diving in Cebu',
      categories: ['Coastal & Island'], trend: 'surging',
    },
  },
  { path: '/api/creative-direction/generate', method: 'POST', body: {} },
  { path: '/api/analytics/report', method: 'POST', body: {} },
];

describe.skipIf(!(await backendAvailable()))('AI endpoints with no LLM configured', () => {
  let token: string;

  beforeAll(async () => {
    token = await loginAsSeededOperator();
  });

  it.each(AI_ENDPOINTS)('$method $path answers 503, not 200', async ({ path, method, body }) => {
    const res = await fetch(`http://localhost:8080${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    expect(res.status, `${method} ${path} must not succeed without an LLM`).toBe(503);
  });

  it.each(AI_ENDPOINTS)('$method $path names its dependency and cause', async ({ path, method, body }) => {
    const res = await fetch(`http://localhost:8080${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const payload = await res.json();

    expect(payload.dependency, `${path} must name what is unavailable`).toBeTruthy();
    expect(payload.cause, `${path} must say why`).toBeTruthy();
    expect(payload.code).toMatch(/^MOD\d/);
    expect(payload.stage).toContain('spring/');
  });

  it('no AI response carries a fallback source', async () => {
    const res = await fetch('http://localhost:8080/api/content/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        market: 'korea', businessName: 'T', description: 'd',
        categories: ['c'], trend: 't',
      }),
    });
    const payload = await res.json();

    expect(payload.source).toBeUndefined();
    expect(JSON.stringify(payload)).not.toContain('fallback');
  });
});
```

- [ ] **Step 3: Add the script**

In `frontend/package.json`:

```json
    "test:contract:unavailable": "vitest run tests/contract/unavailable.contract.test.ts --passWithNoTests"
```

- [ ] **Step 4: Run it**

```bash
cd backend && docker compose -f docker-compose.yml -f docker-compose.no-llm.yml up -d && sleep 90
cd frontend && npm run test:contract:unavailable
```

Expected: PASS — 7 assertions. Then restore the normal stack:

```bash
cd backend && docker compose up -d
```

- [ ] **Step 5: Wire it into e2e CI**

In `.github/workflows/e2e.yml`, after the existing contract-test job, add a job that
brings the stack up with the override and runs `npm run test:contract:unavailable`,
mirroring the existing job's compose-up, health-gate and teardown steps
(:124, :139-144, :191).

- [ ] **Step 6: Commit** *(operator runs this)*

```bash
git add frontend/tests/contract/unavailable.contract.test.ts backend/docker-compose.no-llm.yml frontend/package.json .github/workflows/e2e.yml
git commit -m "test(contract): assert AI endpoints fail loudly without an LLM"
```

---

### Task 39: Provenance e2e spec

The end-to-end statement of the guarantee: no canned string reaches the DOM.

**Files:**
- Create: `e2e/tests/provenance.spec.ts`

- [ ] **Step 1: Write the spec**

```typescript
/**
 * No fabricated string reaches a user's screen.
 *
 * Each string below was, before 2026-08-30, rendered to operators as if it were
 * real: generated captions, measured demand, an AI-written report. They are the
 * canaries — if one reappears, a fallback came back somewhere between the model
 * and the browser, and the unit tests missed it.
 */
import { expect, test } from '@playwright/test';
import { loginAsSeededOperator } from './support/auth';

/** Verbatim fragments of deleted synthetic data. */
const CANNED = [
  '세부에서 찾은 나만의 힐링 스팟',          // _NAVER_OPTIONS[0]
  '직장인 필수 코스',                        // _NAVER_OPTIONS[1]
  'resort stay',                             // _FALLBACK_SERVICES
  'beach activities',                        // _FALLBACK_SERVICES
  'Analysis unavailable — AI agent is offline.', // _FALLBACK_PAYLOAD
  'PES analysis agent is offline',           // _FALLBACK_PAYLOAD warning
];

const ROUTES = [
  { name: 'Dashboard', path: '/dashboard' },
  { name: 'Content Studio', path: '/content' },
  { name: 'Performance', path: '/performance' },
  { name: 'Settings', path: '/settings' },
];

test.describe('provenance', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSeededOperator(page);
  });

  for (const route of ROUTES) {
    test(`${route.name} renders no canned content`, async ({ page }) => {
      await page.goto(route.path);
      await page.waitForLoadState('networkidle');

      const body = await page.locator('body').innerText();

      for (const fragment of CANNED) {
        expect(body, `${route.name} must not render the deleted string "${fragment}"`)
          .not.toContain(fragment);
      }
    });
  }

  test('every screen is in one of the four legible states', async ({ page }) => {
    // Real data, stale-but-real, an error naming a dependency, or "not built yet".
    // A blank screen is none of those and means something failed silently.
    for (const route of ROUTES) {
      await page.goto(route.path);
      await page.waitForLoadState('networkidle');

      const text = await page.locator('main').innerText();
      expect(text.trim().length, `${route.name} rendered nothing at all`).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Run it**

```bash
cd backend && docker compose up -d && sleep 90
cd e2e && npx playwright test tests/provenance.spec.ts
```

Expected: PASS — 5 tests. A failure names the exact route and string, which is the
whole point of listing them verbatim.

- [ ] **Step 3: Commit** *(operator runs this)*

```bash
git add e2e/tests/provenance.spec.ts
git commit -m "test(e2e): assert no canned AI content reaches the DOM"
```

---

### Task 40: Docs

**Files:**
- Modify: `RUNNING.md`
- Modify: `.claude/CLAUDE.md`

- [ ] **Step 1: Add the troubleshooting section to `RUNNING.md`**

```markdown
## Why a screen says "unavailable"

CeView has no fallback data. When a dependency cannot answer, the screen says so and
names the cause instead of showing something plausible. That is deliberate — see
`docs/superpowers/specs/2026-08-30-remove-synthetic-fallbacks-design.md`.

Every failure carries a `dependency` field. Find yours:

| `dependency` | What it means | Fix |
|---|---|---|
| `groq` | The LLM is unreachable or misconfigured | Check `GROQ_API_KEY` in `backend/.env`. If the key is set, read the `cause` — a `404 model_not_found` means `GROQ_MODEL` names a decommissioned model. Current default: `openai/gpt-oss-120b`. |
| `gemini` | The PES / report agent is unreachable | Check `GOOGLE_API_KEY`. |
| `pytrends` | Google Trends data could not be fetched | Usually a `429`. Wait, or ingest later — the dashboard keeps serving the last real measurement with a staleness banner. |
| `business_profile` | A required profile field is empty (HTTP 424) | Complete onboarding. Retrying will not help. |
| `campaign_records` | No campaign data to analyse (HTTP 424) | Submit the ingestion form on the Performance screen. |
| `fastapi` | A service is down entirely | `docker compose ps`, then `docker compose logs <service>`. |

**Three panels, three meanings:**

- **Red error panel** — the request failed; nothing shown is trustworthy
- **Staleness banner** — the numbers are real measurements that have not refreshed
- **"Not built yet"** — the endpoint does not exist; nothing is missing, it was never built

**A "Not built yet" panel is not a bug.** `GET /api/posts`,
`/api/platform-connections` and `/api/workspace/*` have no backend. Those screens used
to show seed data, which read as a working feature.
```

- [ ] **Step 2: Add the rule to `.claude/CLAUDE.md`**

Under **Don't:**

```markdown
- **Never add a fallback that fabricates AI output or measured data.** No mock
  captions, no placeholder reports, no synthetic trend series, no fixture branch in
  `apiClient`. If a dependency cannot answer, raise `DependencyUnavailable`
  (FastAPI) or `AiDependencyException` (Spring) with a real `cause` and let the UI
  say so. `scripts/no-synthetic-data.mjs` enforces this in CI, and the
  `Literal["groq"]` / `ContentSource` types make a fallback a runtime error. See
  `docs/superpowers/specs/2026-08-30-remove-synthetic-fallbacks-design.md`.
```

- [ ] **Step 3: Verify the links resolve**

```bash
ls docs/superpowers/specs/2026-08-30-remove-synthetic-fallbacks-design.md scripts/no-synthetic-data.mjs
```

Expected: both listed

- [ ] **Step 4: Commit** *(operator runs this)*

```bash
git add RUNNING.md .claude/CLAUDE.md
git commit -m "docs: explain the unavailability states and the no-fallback rule"
```

---

## Phase 5 exit criteria

- [ ] `node scripts/no-synthetic-data.mjs` — clean
- [ ] `npx vitest run scripts/no-synthetic-data.test.mjs` — 6 pass
- [ ] `cd frontend && npm run test:contract` — all pass against a live stack
- [ ] `cd frontend && npm run test:contract:unavailable` — all pass against the
      no-LLM stack
- [ ] `cd e2e && npx playwright test tests/provenance.spec.ts` — 5 pass
- [ ] All six CI workflows run the guard

## Whole-plan exit criteria

- [ ] Every phase's exit criteria met
- [ ] `cd backend/fastapi-sbert && pytest tests/ -v` — all pass
- [ ] `cd backend/fastapi-transformer && pytest tests/ -v` — all pass
- [ ] `cd backend/spring-boot && ./mvnw test` — all pass
- [ ] `cd frontend && npm test && npx tsc --noEmit && npm run build` — all pass
- [ ] A developer can open any screen and tell, without reading code, whether they
      are looking at real data, old data, a failure, or an unbuilt feature
