# Phase 0 — Foundation

**Depends on:** nothing. This file must complete before any slice file starts.

All frontend paths are relative to `frontend/`. All backend paths are relative to
`backend/spring-boot/`.

Run frontend tests with `npm test` from `frontend/`. Run a single file with
`npx vitest run <path>`.

> Commits: per [`00-index.md`](00-index.md), Claude must not run `git commit`. Show the
> command, hand it to the operator.

---

## Task 1: Extract domain types into `types.ts`

Today 15+ components import domain types from fixture modules
(`import type { Market } from '../../../services/fixtures/markets'`). That makes fixtures
load-bearing for types, so no fixture can be changed or removed without breaking
components. Everything else in this plan depends on breaking that coupling first.

**Files:**

- Modify: `types.ts` (append)
- Modify: `services/fixtures/markets.ts`, `notifications.ts`, `campaign.ts`, `omcs.ts`, `content.ts`, `posts.ts`
- Modify: all component files importing types from `services/fixtures/*`
- Test: `tests/contract/typeExtraction.test.ts` (new)

- [ ] **Step 1: Write the failing test**

This is a structural guarantee, so the test asserts on source text — no DOM, no backend.
It fails the moment someone reintroduces a type import from a fixture module.

Create `tests/contract/typeExtraction.test.ts`:

```ts
/**
 * Structural contract: domain types live in types.ts, never in fixture modules.
 * Fixtures may import types; components may not import types FROM fixtures.
 * See docs/superpowers/plans/2026-08-29-frontend-backend-connection/01-foundation.md Task 1.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

const REQUIRED_TYPES = [
  'Market', 'ChartDataPoint', 'Airline', 'DemandAlert',
  'CampaignInput', 'CampaignHistoryEntry', 'PrescriptiveReport',
  'FunnelDiagnostic', 'Recommendation',
  'PublishedPost', 'OmcsAuditResult', 'CaptionMetadata',
  'PlatformCaptions', 'ContentResponse',
];

describe('domain types live in types.ts', () => {
  const typesSrc = readFileSync(resolve(root, 'types.ts'), 'utf8');

  it.each(REQUIRED_TYPES)('types.ts declares %s', (name) => {
    expect(typesSrc).toMatch(new RegExp(`export (interface|type) ${name}\\b`));
  });

  it('no file outside services/fixtures imports a type from a fixture module', () => {
    const offenders: string[] = [];
    for (const file of walk(root)) {
      if (file.includes(join('services', 'fixtures'))) continue;
      const src = readFileSync(file, 'utf8');
      // Matches: import type { X } from '.../fixtures/y'
      if (/import\s+type\s+[^;]*from\s+['"][^'"]*fixtures\/[^'"]+['"]/.test(src)) {
        offenders.push(file.slice(root.length + 1));
      }
    }
    expect(offenders).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/contract/typeExtraction.test.ts`

Expected: FAIL. The `it.each` cases fail because `types.ts` declares none of these yet, and
the offenders test fails listing ~20 component files.

- [ ] **Step 3: Append the types to `types.ts`**

Copy these declarations verbatim to the end of `types.ts`. They are the current fixture
declarations, moved — with two deliberate changes noted inline.

```ts
// ─── Module 2 — Market Radar ──────────────────────────────────────────────

export interface ChartDataPoint {
  week: string;
  history: number | null;
  forecast: number | null;
  seasonality: number;
  forex: number;
  gdp: number;
  spike: 0 | 1;
}

export interface Airline {
  name: string;
  code: string;
  frequency: string;
  direct: boolean;
  /** Present on backend AirlineDto; absent from older fixtures. */
  duration?: string;
  /** Present on backend AirlineDto; absent from older fixtures. */
  tier?: string;
}

export interface Market {
  id: string;
  rank: number;
  name: string;
  city: string;
  flag: string;
  matchScore: number;
  directive: string;
  directFlight: boolean;
  flightHours: string;
  distanceKm: number;
  nearestAirport: string;
  destinationAirport: string;
  accessibilityScore: number;
  flightFrequency: number;
  avgFlightPrice: string;
  airlines: Airline[];
  peakMonths: string[];
  currency: string;
  forexLabel: string;
  gdpValue: number;
  forexValue: number;
  seasonalityScore: number;
  /**
   * No backing database column exists (spec §Risks 1). The backend returns null;
   * the Seasonal Patterns tab renders an explicit "not available" state.
   */
  yoyRatio: number | null;
  spikeIndicator: boolean;
  economyInsight: string;
  seasonalityInsight: string;
  gdpTrend: { year: number; value: number }[];
  forexTrend: { date: string; value: number }[];
  chartData: ChartDataPoint[];
}

export interface DemandAlert {
  id: string;
  date: string;
  title: string;
  market: string;
  marketId: string;
  category: string;
  trend: string;
  isRead: boolean;
  alertLevel: 'INFO' | 'WARNING';
  alertMessage: string;
}

// ─── Module 4 — Campaign Analytics ────────────────────────────────────────

export interface CampaignInput {
  impressions: number;
  clicks: number;
  adSpend: number;
  revenue: number;
  conversions: number;
  bookings: number;
  newCustomers: number;
}

export interface CampaignHistoryEntry {
  periodStart: string;
  periodEnd: string;
  pesScore: number;
  pesLabel: string;
  ctr: number;
  cpc: number;
  roas: number;
  convRate: number;
  cac: number;
}

export interface FunnelDiagnostic {
  stage: string;
  rank: string;
  dropRate: string;
  insight: string;
}

export interface Recommendation {
  stage: string;
  urgency: string;
  title: string;
  action: string;
}

export interface PrescriptiveReport {
  executiveSummary: string;
  recommendedPlatform: string;
  funnelDiagnostics: FunnelDiagnostic[];
  recommendations: Recommendation[];
}

// ─── Module 3 — Content Studio ────────────────────────────────────────────

export interface CaptionMetadata {
  core_business_context: string;
  market_cultural_localization: string;
  psychological_elements: string;
  creative_tone_atmosphere: string;
  algorithmic_platform_architecture: string;
}

export interface PlatformCaptions {
  optionNames: string[];
  options: string[];
  optionMetadata: CaptionMetadata[];
  guide: string[];
}

export interface ContentResponse {
  market: { country: string; city: string; flag: string };
  framework: string;
  source: string;
  /** Fixed four-platform object, not an open map — matches the fixture's real shape. */
  captions: {
    instagram: PlatformCaptions;
    tiktok: PlatformCaptions;
    facebook: PlatformCaptions;
    naver: PlatformCaptions;
  };
}

export interface OmcsAuditResult {
  profileSemanticScore: number;
  /** Nested scores/total, not a flat map — matches OmcsAuditResultDTO. */
  rubricEvaluationData: {
    scores: Record<string, number>;
    total: number;
  };
  recommendationsPictureScore: number;
  pubmatConsistencyScore: number;
  consistencyExplanation: string;
  omcsScore: number;
  status: 'Pass' | 'Fail';
  feedback: string;
}

export interface PublishedPost {
  id: string;
  date: string;
  platform: PlatformId;
  caption: string;
  status: 'published' | 'draft';
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  engagementRate: number;
  series: number[];
}
```

Two changes from the fixture originals, both deliberate:

- `Airline.duration` and `Airline.tier` are added as optional — the backend `AirlineDto`
  returns them and the frontend previously dropped them.
- `Market.yoyRatio` is `number | null` — see Task 10 and spec §Risks 1.

- [ ] **Step 4: Make fixtures import instead of declare**

In each fixture file, delete the `export interface` block that Step 3 moved, and import it.
For `services/fixtures/markets.ts`, replace the `ChartDataPoint`, `Airline`, and `Market`
declarations with:

```ts
import type { ChartDataPoint, Airline, Market } from '../../types';

export type { ChartDataPoint, Airline, Market };
```

The `export type { … }` re-export keeps existing fixture-internal imports working while
components migrate. Apply the same pattern to `notifications.ts` (`DemandAlert`),
`campaign.ts` (`CampaignInput`, `CampaignHistoryEntry`, `FunnelDiagnostic`,
`Recommendation`, `PrescriptiveReport`), `omcs.ts` (`OmcsAuditResult`), `content.ts`
(`CaptionMetadata`, `PlatformCaptions`, `ContentResponse`), and `posts.ts`
(`PublishedPost`).

- [ ] **Step 5: Repoint component imports**

Rewrite every component-side type import to come from `types.ts`. From `frontend/`:

```bash
grep -rln "from '.*fixtures/" components layout App.tsx --include=*.tsx --include=*.ts \
  | grep -v '\.test\.' \
  | xargs sed -i -E "s#from '(\.\./)+services/fixtures/[a-zA-Z]+'#from '@/types'#g"
```

`@` is already aliased to the frontend root in `vite.config.ts`, so `@/types` resolves
everywhere without counting `../` levels.

Two files import *values*, not types, and must NOT be rewritten by that command — handle
them in their own slices:

- `components/module-1/onboarding/steps/BasicInfoStep.tsx` imports `DEMO_BUSINESS` (Task 21)
- `components/module-2/2.2-market-radar/MarketRadarDrawer.tsx` imports `MOCK_MARKETS` (Task 12)

Verify none were clobbered:

```bash
grep -rn "DEMO_BUSINESS\|MOCK_MARKETS\|MOCK_CONTENT\|MOCK_OMCS\|MOCK_POSTS" components --include=*.tsx | grep -v '\.test\.'
```

Expected: value imports still point at `services/fixtures/*`.

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run tests/contract/typeExtraction.test.ts`

Expected: PASS — all 14 type cases green, `offenders` empty.

- [ ] **Step 7: Run the full suite for regressions**

Run: `npm test`

Expected: PASS. This step is a large mechanical import rewrite; any failure here is a
missed or over-eager `sed` replacement, not a logic error.

- [ ] **Step 8: Commit**

```bash
git add frontend/types.ts frontend/services/fixtures frontend/components frontend/layout frontend/App.tsx frontend/tests/contract/typeExtraction.test.ts
git commit -m "refactor(frontend): extract domain types from fixtures into types.ts"
```

---

## Task 2: `ApiError` with backend code passthrough

`request()` currently throws `new Error("Request to /x failed with 404")`, discarding the
structured `{code, message}` body Spring already returns (`MOD22_MARKETS_FAILED`,
`MOD22_PROFILE_NOT_READY`). Without this task the error panel in Task 3 has nothing to show.

**Files:**

- Create: `services/apiError.ts`
- Modify: `services/apiClient.ts:28-42` (the `request` function)
- Test: `services/apiError.test.ts`

- [ ] **Step 1: Write the failing test**

Create `services/apiError.test.ts`:

```ts
import { describe, expect, it, vi, afterEach } from 'vitest';
import { ApiError, isMissingDependency } from './apiError';

describe('ApiError', () => {
  it('carries status, method, path and the backend code', () => {
    const err = new ApiError({
      status: 503,
      method: 'GET',
      path: '/api/v1/forecasting/markets',
      body: { code: 'MOD22_MARKETS_FAILED', message: 'transformer unreachable' },
    });
    expect(err.status).toBe(503);
    expect(err.method).toBe('GET');
    expect(err.path).toBe('/api/v1/forecasting/markets');
    expect(err.code).toBe('MOD22_MARKETS_FAILED');
    expect(err.message).toContain('transformer unreachable');
  });

  it('is an instanceof Error so existing catch blocks still work', () => {
    const err = new ApiError({ status: 404, method: 'GET', path: '/x' });
    expect(err).toBeInstanceOf(Error);
  });

  it('falls back to a readable message when the body has none', () => {
    const err = new ApiError({ status: 404, method: 'GET', path: '/x' });
    expect(err.message).toBe('GET /x failed with 404');
  });

  it('recognises a missing-dependency code', () => {
    expect(isMissingDependency(new ApiError({
      status: 503, method: 'POST', path: '/api/v1/content/generate',
      body: { code: 'DEPENDENCY_NOT_CONFIGURED', message: 'GROQ_API_KEY not set' },
    }))).toBe(true);
    expect(isMissingDependency(new ApiError({
      status: 503, method: 'GET', path: '/x',
      body: { code: 'MOD22_MARKETS_FAILED', message: 'boom' },
    }))).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run services/apiError.test.ts`

Expected: FAIL with "Failed to resolve import ./apiError".

- [ ] **Step 3: Write the implementation**

Create `services/apiError.ts`:

```ts
/**
 * Structured transport error. Spring returns { code, message } for module 2/3
 * failures and the AI gateway returns DEPENDENCY_* codes (see Task 5); this
 * class carries them to the UI instead of stringifying them away.
 */
export interface ApiErrorInit {
  status: number;
  method: string;
  path: string;
  body?: unknown;
}

function readString(body: unknown, key: string): string | undefined {
  if (typeof body !== 'object' || body === null) return undefined;
  const value = (body as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : undefined;
}

export class ApiError extends Error {
  readonly status: number;
  readonly method: string;
  readonly path: string;
  readonly code?: string;
  readonly body?: unknown;

  constructor({ status, method, path, body }: ApiErrorInit) {
    super(readString(body, 'message') ?? `${method} ${path} failed with ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.method = method;
    this.path = path;
    this.code = readString(body, 'code');
    this.body = body;
  }
}

/** Codes meaning "this dependency was never configured", not "it failed". */
const MISSING_DEPENDENCY_CODES = new Set([
  'DEPENDENCY_NOT_CONFIGURED',
  'DEPENDENCY_UNREACHABLE',
]);

export function isMissingDependency(err: unknown): boolean {
  return err instanceof ApiError && !!err.code && MISSING_DEPENDENCY_CODES.has(err.code);
}

/** 409 from CurrentBusinessProfile — onboarding incomplete, not a failure. */
export function isProfileNotReady(err: unknown): boolean {
  return err instanceof ApiError
    && (err.status === 409 || err.code === 'MOD22_PROFILE_NOT_READY');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run services/apiError.test.ts`

Expected: PASS, 4 tests.

- [ ] **Step 5: Throw `ApiError` from `request()`**

In `services/apiClient.ts`, add the import at the top:

```ts
import { ApiError } from './apiError';
```

Replace the whole `request` function (currently lines 28–42) with:

```ts
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const tokens = loadTokens();
  const method = init?.method ?? 'GET';
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(tokens ? { Authorization: `Bearer ${tokens.accessToken}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    // Parse the body for Spring's { code, message }; a non-JSON error body
    // (proxy HTML, empty 502) must not mask the real status.
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      body = undefined;
    }
    throw new ApiError({ status: res.status, method, path, body });
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
```

- [ ] **Step 6: Run the full suite**

Run: `npm test`

Expected: PASS. `services/apiClient.auth.test.ts` asserts on failure behaviour — if it
asserts an exact `Error` message string, update it to assert `ApiError` fields instead.

- [ ] **Step 7: Commit**

```bash
git add frontend/services/apiError.ts frontend/services/apiError.test.ts frontend/services/apiClient.ts
git commit -m "feat(frontend): throw structured ApiError carrying backend error codes"
```

---

## Task 3: `<ApiErrorPanel>`

One error surface, three cases. Every wired screen in slices 1–4 renders this; without it
each slice would invent its own.

**Files:**

- Create: `components/shared/ApiErrorPanel.tsx`
- Test: `components/shared/ApiErrorPanel.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `components/shared/ApiErrorPanel.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ApiError } from '../../services/apiError';
import { ApiErrorPanel } from './ApiErrorPanel';

describe('ApiErrorPanel', () => {
  it('names the missing dependency and does not show a retry', () => {
    render(<ApiErrorPanel error={new ApiError({
      status: 503, method: 'POST', path: '/api/v1/content/generate',
      body: { code: 'DEPENDENCY_NOT_CONFIGURED', message: 'GROQ_API_KEY is not set' },
    })} />);
    expect(screen.getByText(/setup required/i)).toBeInTheDocument();
    expect(screen.getByText(/GROQ_API_KEY is not set/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /retry/i })).not.toBeInTheDocument();
  });

  it('treats profile-not-ready as guidance, not failure', () => {
    render(<ApiErrorPanel error={new ApiError({
      status: 409, method: 'GET', path: '/api/v1/forecasting/markets',
      body: { code: 'MOD22_PROFILE_NOT_READY', message: 'no business profile yet' },
    })} />);
    expect(screen.getByText(/complete onboarding/i)).toBeInTheDocument();
    expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument();
  });

  it('shows status, method, path and backend code for a genuine failure', () => {
    render(<ApiErrorPanel error={new ApiError({
      status: 503, method: 'GET', path: '/api/v1/forecasting/markets',
      body: { code: 'MOD22_MARKETS_FAILED', message: 'transformer unreachable' },
    })} />);
    expect(screen.getByText(/GET \/api\/forecasting\/markets/)).toBeInTheDocument();
    expect(screen.getByText(/503/)).toBeInTheDocument();
    expect(screen.getByText(/MOD22_MARKETS_FAILED/)).toBeInTheDocument();
  });

  it('renders a retry button when onRetry is supplied', () => {
    render(<ApiErrorPanel
      error={new ApiError({ status: 500, method: 'GET', path: '/x' })}
      onRetry={() => {}}
    />);
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/shared/ApiErrorPanel.test.tsx`

Expected: FAIL with "Failed to resolve import ./ApiErrorPanel".

- [ ] **Step 3: Write the implementation**

Create `components/shared/ApiErrorPanel.tsx`. Colours come from the branding tokens in
`styles/index.css` — do not introduce new hex values.

```tsx
/**
 * The single error surface for every backend-wired screen.
 * Plan: docs/superpowers/plans/2026-08-29-frontend-backend-connection/01-foundation.md Task 3
 *
 * Three cases, visually distinct because a developer needs to tell them apart
 * without opening the console:
 *   missing dependency -> names the exact setup step
 *   profile not ready  -> guidance, not a failure
 *   genuine failure    -> status, method, path, backend code, message
 */
import { AlertTriangle, Settings, UserPlus } from 'lucide-react';
import { ApiError, isMissingDependency, isProfileNotReady } from '../../services/apiError';

interface Props {
  error: unknown;
  /** Omitted for cases a retry cannot fix (missing dependency, profile not ready). */
  onRetry?: () => void;
  /** Optional context, e.g. "Market Radar". */
  label?: string;
}

export function ApiErrorPanel({ error, onRetry, label }: Props) {
  const api = error instanceof ApiError ? error : null;
  const missing = isMissingDependency(error);
  const notReady = isProfileNotReady(error);

  const Icon = missing ? Settings : notReady ? UserPlus : AlertTriangle;
  const tone = notReady ? 'text-[var(--color-navy-primary)]' : 'text-[var(--color-coral-cta)]';

  const heading = missing
    ? 'Setup required'
    : notReady
      ? 'Complete onboarding first'
      : 'Something went wrong';

  return (
    <div
      role="alert"
      className="rounded-[var(--radius-md)] border border-[var(--color-gray-light)] bg-[var(--color-off-white)] p-6"
    >
      <div className={`flex items-center gap-2 ${tone}`}>
        <Icon size={18} aria-hidden="true" />
        <h3 className="font-semibold">{heading}</h3>
      </div>

      {label && <p className="mt-1 text-sm text-[var(--color-text-muted)]">{label}</p>}

      <p className="mt-2 text-sm text-[var(--color-text-body)]">
        {missing
          ? 'A backend dependency is not configured for this environment.'
          : notReady
            ? 'This screen needs a saved business profile before it can load data.'
            : 'The request to the backend did not succeed.'}
      </p>

      {api && (
        <dl className="mt-4 space-y-1 font-mono text-xs text-[var(--color-text-muted)]">
          <div>
            <dt className="sr-only">Request</dt>
            <dd>{api.method} {api.path}</dd>
          </div>
          <div>
            <dt className="sr-only">Status</dt>
            <dd>{api.status}{api.code ? ` · ${api.code}` : ''}</dd>
          </div>
          <div>
            <dt className="sr-only">Message</dt>
            <dd className="whitespace-pre-wrap">{api.message}</dd>
          </div>
        </dl>
      )}

      {onRetry && !missing && !notReady && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 rounded-[var(--radius-pill)] bg-[var(--color-coral-cta)] px-4 py-2 text-sm font-semibold text-[var(--color-text-inverse)] hover:bg-[var(--color-coral-cta-hover)]"
        >
          Retry
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run components/shared/ApiErrorPanel.test.tsx`

Expected: PASS, 4 tests.

- [ ] **Step 5: Verify branding compliance**

Run: `npx vitest run tests/integration/brand-tokens.test.ts`

Expected: PASS — confirms no off-palette colour was introduced.

- [ ] **Step 6: Commit**

```bash
git add frontend/components/shared/ApiErrorPanel.tsx frontend/components/shared/ApiErrorPanel.test.tsx
git commit -m "feat(frontend): add shared ApiErrorPanel with dependency/not-ready/failure cases"
```

---

## Task 4: Contract-test harness with auto-skip

The check that would have caught `/api/markets` drifting from
`/api/v1/forecasting/markets`. It must auto-skip when no backend answers, so it never
breaks CI for someone without Docker.

**Files:**

- Create: `tests/contract/backendProbe.ts`
- Modify: `package.json` (add `test:contract`)
- Test: exercised by the slice contract tests (Tasks 7, 14, 18, 22)

- [ ] **Step 1: Write the harness**

Create `tests/contract/backendProbe.ts`:

```ts
/**
 * Live contract-test support. Probes the backend once per run; when nothing
 * answers, suites call describeIfBackend(...) and are skipped rather than failed.
 *
 * Requires the Docker stack: cd backend && docker compose up -d
 * Seeded operator credentials:
 *   backend/spring-boot/src/main/resources/db/migration/SEED_CREDENTIALS.md
 */
import { describe } from 'vitest';

// `||` (not `??`) deliberately: the repo's .env ships `VITE_API_BASE_URL=` blank,
// which is '' — a value `??` would NOT fall back from, silently leaving BASE_URL
// empty so the probe never detects a backend. services/apiClient.ts uses `||`
// for the same reason.
export const BASE_URL = process.env.VITE_API_BASE_URL || 'http://localhost:8080';

/** Seeded demo operator — Moalboal FreeDive Cebu, category "Coastal & Island". */
export const SEED_OPERATOR = {
  email: 'ramon.delacruz@ceview.local',
  password: 'MoalboalDive2024!',
};

let reachable: boolean | null = null;

export async function isBackendUp(): Promise<boolean> {
  if (reachable !== null) return reachable;
  try {
    const res = await fetch(`${BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(SEED_OPERATOR),
      signal: AbortSignal.timeout(3000),
    });
    reachable = res.status < 500;
  } catch {
    reachable = false;
  }
  return reachable;
}

let cachedToken: string | null = null;

/** Logs in as the seeded operator and caches the JWT for the whole run. */
export async function seedToken(): Promise<string> {
  if (cachedToken) return cachedToken;
  const res = await fetch(`${BASE_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(SEED_OPERATOR),
  });
  if (!res.ok) {
    throw new Error(
      `Seeded login failed with ${res.status}. Is Flyway seed V2 applied? ` +
      `Run: cd backend && docker compose up -d`,
    );
  }
  const { token } = (await res.json()) as { token: string };
  cachedToken = token;
  return token;
}

/** Authenticated fetch against the live backend. */
export async function api(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const token = await seedToken();
  return fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  });
}

/**
 * describe() that skips the whole suite when no backend is reachable.
 * Vitest needs the skip decision synchronously, so the probe runs at module
 * load via a top-level await in each contract suite.
 */
export function describeIfBackend(up: boolean, name: string, fn: () => void) {
  const d = up ? describe : describe.skip;
  d(name, fn);
  if (!up) {
    console.warn(`[contract] skipped "${name}" — no backend at ${BASE_URL}`);
  }
}
```

- [ ] **Step 2: Add the npm script**

In `package.json`, add to `scripts`:

```json
"test:contract": "vitest run tests/contract --passWithNoTests"
```

`--passWithNoTests` matters: Vitest exits 1 when a filter matches no test files, and at
this point `tests/contract/` holds only the harness module. Without it this step fails
before any contract suite exists.

And exclude contract tests from BOTH offline runs so they stay offline-safe:

```json
"test": "vitest run --exclude \"tests/contract/**\" --exclude \"node_modules/**\"",
"test:unit": "vitest run --exclude \"tests/integration/**\" --exclude \"tests/contract/**\" --exclude \"node_modules/**\""
```

`test:unit` needs the exclusion too. It currently only excludes `tests/integration/**`, so
once Task 7 adds the first `tests/contract/*.test.ts`, a live-backend suite would silently
leak into the unit run.

Note `tests/contract/typeExtraction.test.ts` from Task 1 is a pure source-text test with no
backend dependency. Move it to `tests/integration/typeExtraction.test.ts` so it keeps
running under `npm test`:

```bash
git mv frontend/tests/contract/typeExtraction.test.ts frontend/tests/integration/typeExtraction.test.ts
```

Then fix its `root` constant, which walks up two levels — the path is unchanged
(`../..` from `tests/integration/` is still `frontend/`), so no edit is needed.

- [ ] **Step 3: Verify auto-skip works with no backend**

With the stack **down**:

Run: `npm run test:contract`

Expected: PASS with 0 tests run, and no suites failing. Nothing exists in
`tests/contract/` yet besides the harness, so this confirms the script and exclusions are
wired, not the probe.

- [ ] **Step 4: Verify the probe reaches a live backend**

Start the stack and confirm the seeded login works:

```bash
cd backend && docker compose up -d
curl -s -X POST http://localhost:8080/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"ramon.delacruz@ceview.local","password":"MoalboalDive2024!"}'
```

Expected: JSON containing `token`, `operatorId`, `profileCompleted`. If this 401s, the
Flyway seed did not apply — check `docker compose logs spring-boot` for migration errors
before continuing.

- [ ] **Step 5: Run the full suite**

Run: `npm test`

Expected: PASS, contract directory excluded.

- [ ] **Step 6: Commit**

```bash
git add frontend/tests/contract/backendProbe.ts frontend/tests/integration/typeExtraction.test.ts frontend/package.json
git commit -m "test(frontend): add live contract-test harness with backend auto-skip"
```

---

## Task 5: Surface unconfigured AI dependencies

> **Rewritten during execution.** The original task assumed Spring should throw a new
> `AiDependencyException` when an AI dependency was missing. Inspecting the running system
> showed two things that make that wrong:
>
> 1. **Unreachability is already handled.** `common/ApiExceptionHandler` maps
>    `WebClientRequestException` → 503 `ai_service_unreachable` and
>    `WebClientResponseException` → 502 `ai_service_unavailable`. A new exception type would
>    duplicate this.
> 2. **A missing `GROQ_API_KEY` produces no error at all.** `fastapi-sbert`'s
>    `services/gemini_client.py` documents that "when GROQ_API_KEY is missing, every
>    function returns a deterministic" mock, and returns `{"source": "fallback"}` instead of
>    `{"source": "groq"}`. The caption agent likewise "returns mock captions."
>
> So the real risk is not an unhelpful error — it is **silent fake content**. A developer
> debugging against the real backend sees plausible captions and cannot tell they are
> stubbed. That directly defeats this plan's purpose. This task makes both states visible
> using signals the system already emits.

**Files:**
- Modify: `frontend/services/apiError.ts`
- Modify: `frontend/types.ts`
- Test: `frontend/services/apiError.test.ts`

- [ ] **Step 1: Make `ApiError.code` fall back to the backend's `error` field**

`ApiExceptionHandler.body()` emits `{error, status, traceId, code, message}`, where `code`
is populated only when MDC carries one — so AI failures arrive with `error:
"ai_service_unreachable"` and **no** `code`. `isMissingDependency()` reads `code`, so it
would never fire today.

Add the fallback in `services/apiError.ts`:

```ts
    // Spring's ApiExceptionHandler puts its slug in `error` and only sets `code`
    // when MDC carries one, so AI failures arrive as { error: "ai_service_unreachable" }
    // with no code. Fall back to `error` so those still classify.
    this.code = readString(body, 'code') ?? readString(body, 'error');
```

And extend the recognised set:

```ts
const MISSING_DEPENDENCY_CODES = new Set([
  'DEPENDENCY_NOT_CONFIGURED',
  'DEPENDENCY_UNREACHABLE',
  // Emitted by common/ApiExceptionHandler when FastAPI is down or erroring.
  'ai_service_unreachable',
  'ai_service_unavailable',
]);
```

- [ ] **Step 2: Add a test for the real backend shape**

Append to `services/apiError.test.ts`:

```ts
  it('classifies Spring\'s ai_service_unreachable as a missing dependency', () => {
    // The exact body ApiExceptionHandler produces — note `error`, not `code`.
    const err = new ApiError({
      status: 503, method: 'POST', path: '/api/v1/content/generate',
      body: { error: 'ai_service_unreachable', status: 503, message: 'Connection refused: localhost:8000' },
    });
    expect(isMissingDependency(err)).toBe(true);
    expect(err.code).toBe('ai_service_unreachable');
  });

  it('prefers an explicit code over the error slug', () => {
    const err = new ApiError({
      status: 409, method: 'GET', path: '/x',
      body: { error: 'request_failed', code: 'MOD22_PROFILE_NOT_READY', message: 'no profile' },
    });
    expect(err.code).toBe('MOD22_PROFILE_NOT_READY');
  });
```

- [ ] **Step 3: Type the stubbed-content signal**

`ContentResponse.source` already carries `"groq"` (real) or `"fallback"` (stubbed). Make
that explicit in `types.ts` so consumers can't ignore it:

```ts
/**
 * Where generated content came from. "fallback" means fastapi-sbert served a
 * deterministic mock because GROQ_API_KEY is unset — the content looks real but
 * is not. Screens MUST surface this (see 05-module-3.md Task 25).
 */
export type ContentSource = 'groq' | 'gemini' | 'fallback' | 'template';
```

Change `ContentResponse.source` from `string` to `ContentSource`. If the live backend
emits a value not in this union, add it rather than widening back to `string`.

- [ ] **Step 4: Run the tests**

```bash
cd frontend
npx vitest run services/apiError.test.ts
npm test
```

Expected: `apiError.test.ts` passes with 6 tests; full suite stays green.

- [ ] **Step 5: Commit** (operator runs it)

```bash
git add frontend/services/apiError.ts frontend/services/apiError.test.ts frontend/types.ts
git commit -m "feat(frontend): classify AI-unavailable responses and type the stubbed-content signal"
```

### Follow-up recorded, not done here

Making `source: "fallback"` *visible in the UI* belongs to the screens that render generated
content — [`05-module-3.md`](05-module-3.md) Task 25. That task must show a banner reading
roughly "Showing stubbed content — `GROQ_API_KEY` is not set", because silent mock content is
the single most misleading state in this whole plan.

---

## Task 5b (deferred): server-side config errors

The original Task 5's `AiDependencyException` is **not needed** and is not implemented.
Should a future need arise to distinguish "unset key" from "service down" *server-side*,
the change belongs in `fastapi-sbert` — returning a structured code instead of silently
mocking — not in Spring. Recorded here so the decision is not silently lost.

<details>
<summary>Original Task 5 text, superseded</summary>

`<ApiErrorPanel>`'s "Setup required" case needs the backend to say *"this was never
configured"* rather than returning a generic 503. Without this, a developer missing a
`GROQ_API_KEY` sees an indistinguishable server error.

**Files:**

- Create: `src/main/java/com/ceview/ai/AiDependencyException.java`
- Modify: `src/main/java/com/ceview/ai/AIInferenceGatewayService.java`
- Modify: `src/main/java/com/ceview/common/ApiExceptionHandler.java` (path may differ — locate with the command in Step 2)
- Test: `src/test/java/com/ceview/ai/AiDependencyExceptionTest.java`

- [ ] **Step 1: Write the failing test**

Create `src/test/java/com/ceview/ai/AiDependencyExceptionTest.java`:

```java
package com.ceview.ai;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import static org.assertj.core.api.Assertions.assertThat;

class AiDependencyExceptionTest {

    @Test
    void notConfiguredCarriesTheConfiguredCodeAndNamesTheSetting() {
        AiDependencyException ex = AiDependencyException.notConfigured("GROQ_API_KEY");
        assertThat(ex.getCode()).isEqualTo("DEPENDENCY_NOT_CONFIGURED");
        assertThat(ex.getMessage()).contains("GROQ_API_KEY");
        assertThat(ex.getStatus()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
    }

    @Test
    void unreachableNamesTheServiceAndItsAddress() {
        AiDependencyException ex = AiDependencyException.unreachable("fastapi-sbert", "http://localhost:8000");
        assertThat(ex.getCode()).isEqualTo("DEPENDENCY_UNREACHABLE");
        assertThat(ex.getMessage()).contains("fastapi-sbert").contains("http://localhost:8000");
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend/spring-boot && ./mvnw test -Dtest=AiDependencyExceptionTest
```

Expected: compilation failure — `AiDependencyException` does not exist.

Locate the existing exception handler so Step 4 edits the right file:

```bash
grep -rln "RestControllerAdvice\|ControllerAdvice" src/main/java
```

- [ ] **Step 3: Write the implementation**

Create `src/main/java/com/ceview/ai/AiDependencyException.java`:

```java
package com.ceview.ai;

import org.springframework.http.HttpStatus;

/**
 * Distinguishes "this AI dependency was never configured for this environment"
 * from "it was configured and failed". The frontend's ApiErrorPanel renders the
 * former as a setup instruction naming the exact missing setting, so a developer
 * without a GROQ_API_KEY is told what to set rather than shown a server error.
 *
 * Plan: docs/superpowers/plans/2026-08-29-frontend-backend-connection/01-foundation.md Task 5
 */
public class AiDependencyException extends RuntimeException {

    public static final String NOT_CONFIGURED = "DEPENDENCY_NOT_CONFIGURED";
    public static final String UNREACHABLE = "DEPENDENCY_UNREACHABLE";

    private final String code;

    private AiDependencyException(String code, String message) {
        super(message);
        this.code = code;
    }

    /** A required setting is absent from this environment. */
    public static AiDependencyException notConfigured(String settingName) {
        return new AiDependencyException(NOT_CONFIGURED,
                settingName + " is not set — this screen needs it. See RUNNING.md §5.");
    }

    /** The service is configured but nothing is listening. */
    public static AiDependencyException unreachable(String serviceName, String address) {
        return new AiDependencyException(UNREACHABLE,
                serviceName + " unreachable at " + address
                        + " — start it with: cd backend && docker compose up -d " + serviceName);
    }

    public String getCode() {
        return code;
    }

    public HttpStatus getStatus() {
        return HttpStatus.SERVICE_UNAVAILABLE;
    }
}
```

- [ ] **Step 4: Map it in the exception handler**

In the `@RestControllerAdvice` class found in Step 2, add:

```java
@ExceptionHandler(AiDependencyException.class)
public ResponseEntity<Map<String, Object>> handleAiDependency(AiDependencyException ex) {
    return ResponseEntity.status(ex.getStatus())
            .body(Map.of("code", ex.getCode(), "message", ex.getMessage()));
}
```

This matches the `{code, message}` shape module 2 already returns, so `ApiError` parses it
with no client-side special-casing.

- [ ] **Step 5: Throw it from the gateway**

In `AIInferenceGatewayService`, replace the connection-failure and missing-key paths.
Find where a `WebClientRequestException` or connection error is caught and rethrow:

```java
catch (WebClientRequestException e) {
    throw AiDependencyException.unreachable("fastapi-sbert", sbertBaseUrl);
}
```

And where a missing API key is detected before dispatching:

```java
if (groqApiKey == null || groqApiKey.isBlank()) {
    throw AiDependencyException.notConfigured("GROQ_API_KEY");
}
```

Keep every existing caller-side fallback intact — this task changes what is thrown when a
fallback is unavailable, not whether fallbacks run.

- [ ] **Step 6: Run test to verify it passes**

```bash
./mvnw test -Dtest=AiDependencyExceptionTest
```

Expected: PASS, 2 tests.

- [ ] **Step 7: Run the backend suite for regressions**

```bash
./mvnw test
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add backend/spring-boot/src/main/java/com/ceview/ai backend/spring-boot/src/test/java/com/ceview/ai backend/spring-boot/src/main/java/com/ceview/common
git commit -m "feat(backend): distinguish unconfigured AI dependencies from failures"
```

---

</details>

---

## Task 6: JWT-derived endpoint variants

Four endpoints require `profileId` as a path variable or a mandatory query param. The
frontend has no `profileId` until `businessProfile.load()` resolves — login returns only
`operatorId` — so wiring them as-is would give every module-2/3 call a hidden ordering
dependency on the profile fetch.

`CurrentBusinessProfile.resolveOrValidate(null)` already derives the profile from the JWT,
so `/forecasting/markets`, `/notifications`, and `/content/generate` already work without
the param. Only these four need new variants.

**Files:**

- Modify: `src/main/java/com/ceview/module2/ForecastingController.java`
- Modify: `src/main/java/com/ceview/module3/CreativeDirectionController.java`
- Modify: `src/main/java/com/ceview/module3/ContentController.java`
- Test: `src/test/java/com/ceview/module2/ForecastingControllerJwtVariantTest.java`

- [ ] **Step 1: Write the failing test**

Create `src/test/java/com/ceview/module2/ForecastingControllerJwtVariantTest.java`:

```java
package com.ceview.module2;

import com.ceview.auth.CurrentBusinessProfile;
import com.ceview.module2.dto.MarketDtos.MarketsResponse;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class ForecastingControllerJwtVariantTest {

    private static final UUID PROFILE = UUID.fromString("20000000-0000-0000-0000-000000000001");

    @Test
    void analyzeWithoutPathVariableResolvesProfileFromJwt() {
        ForecastingService service = Mockito.mock(ForecastingService.class);
        CurrentBusinessProfile current = Mockito.mock(CurrentBusinessProfile.class);
        Mockito.when(current.resolveOrValidate(null)).thenReturn(PROFILE);
        Mockito.when(service.forecastForProfile(PROFILE, true))
               .thenReturn(new MarketsResponse(List.of()));

        ForecastingController controller = new ForecastingController(service, current);

        assertThat(controller.analyze().getStatusCode().value()).isEqualTo(200);
        Mockito.verify(current).resolveOrValidate(null);
        Mockito.verify(service).forecastForProfile(PROFILE, true);
    }

    @Test
    void ensureWithoutPathVariableResolvesProfileFromJwt() {
        ForecastingService service = Mockito.mock(ForecastingService.class);
        CurrentBusinessProfile current = Mockito.mock(CurrentBusinessProfile.class);
        Mockito.when(current.resolveOrValidate(null)).thenReturn(PROFILE);
        Mockito.when(service.ensureFreshForecast(PROFILE, 12L))
               .thenReturn(new MarketsResponse(List.of()));

        ForecastingController controller = new ForecastingController(service, current);

        assertThat(controller.ensure(12L).getStatusCode().value()).isEqualTo(200);
        Mockito.verify(service).ensureFreshForecast(PROFILE, 12L);
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend/spring-boot && ./mvnw test -Dtest=ForecastingControllerJwtVariantTest
```

Expected: compilation failure — no no-arg `analyze()` / single-arg `ensure(long)`.

- [ ] **Step 3: Add the variants**

In `ForecastingController`, add alongside the existing path-variable methods (which stay
for compatibility):

```java
/**
 * JWT-derived "Refresh Forecast" — the profile comes from the token, so the
 * frontend never needs to know its own profileId. Delegates to the same service
 * call as the path-variable form.
 */
@PostMapping("/analyze")
public ResponseEntity<?> analyze() {
    UUID resolvedProfileId = currentBusinessProfile.resolveOrValidate(null);
    try {
        return ResponseEntity.ok(forecastingService.forecastForProfile(resolvedProfileId, true));
    } catch (ResponseStatusException rse) {
        return structuredError(rse, "MOD22_FORECAST_FAILED");
    } catch (Exception e) {
        return ResponseEntity.status(503)
                .body(Map.of("code", "MOD22_FORECAST_FAILED", "message", e.getMessage()));
    }
}

/** JWT-derived counterpart of {@link #ensure(UUID, long)}. */
@PostMapping("/ensure")
public ResponseEntity<?> ensure(@RequestParam(defaultValue = "12") long maxAgeHours) {
    UUID resolvedProfileId = currentBusinessProfile.resolveOrValidate(null);
    try {
        return ResponseEntity.ok(forecastingService.ensureFreshForecast(resolvedProfileId, maxAgeHours));
    } catch (ResponseStatusException rse) {
        return structuredError(rse, "MOD22_FORECAST_FAILED");
    } catch (IllegalArgumentException iae) {
        return ResponseEntity.status(409)
                .body(Map.of("code", "MOD22_PROFILE_NOT_READY", "message", iae.getMessage()));
    } catch (Exception e) {
        return ResponseEntity.status(503)
                .body(Map.of("code", "MOD22_FORECAST_FAILED", "message", e.getMessage()));
    }
}
```

In `CreativeDirectionController`, add:

```java
/** JWT-derived counterpart of {@link #generate(UUID)}. */
@PostMapping("/generate")
public ResponseEntity<?> generate() {
    return generate(currentBusinessProfile.resolveOrValidate(null));
}
```

In `ContentController`, make `approve`'s `profileId` optional so the same route serves
both callers — `resolveOrValidate` already rejects a mismatched supplied id:

```java
@PostMapping("/approve")
public ResponseEntity<Map<String, Object>> approve(
        @RequestParam(required = false) UUID profileId,
        @RequestBody Map<String, String> body) {
    UUID resolvedProfileId = currentBusinessProfile.resolveOrValidate(profileId);
    // …existing body unchanged…
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
./mvnw test -Dtest=ForecastingControllerJwtVariantTest
```

Expected: PASS, 2 tests.

- [ ] **Step 5: Verify the routes against a live backend**

```bash
cd backend && docker compose up -d
TOKEN=$(curl -s -X POST http://localhost:8080/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"ramon.delacruz@ceview.local","password":"MoalboalDive2024!"}' \
  | sed -E 's/.*"token":"([^"]+)".*/\1/')

curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:8080/api/v1/forecasting/ensure \
  -H "Authorization: Bearer $TOKEN"
```

Expected: `200` (or `409` with `MOD22_PROFILE_NOT_READY` if the seeded operator has no
profile — either proves the route resolves the JWT rather than 404ing on a missing path
variable). A `404` means the mapping did not register.

- [ ] **Step 6: Run the backend suite**

```bash
cd backend/spring-boot && ./mvnw test
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/spring-boot/src/main/java/com/ceview/module2 backend/spring-boot/src/main/java/com/ceview/module3 backend/spring-boot/src/test/java/com/ceview/module2
git commit -m "feat(backend): add JWT-derived variants for analyze/ensure/creative-direction/approve"
```

---

## Foundation Definition of Done

- [ ] `npm test` passes from `frontend/`
- [ ] `npm run test:contract` passes (skips cleanly with the stack down, runs with it up)
- [ ] `./mvnw test` passes from `backend/spring-boot/`
- [ ] No file outside `services/fixtures/` imports a type from a fixture module
- [ ] `POST /api/v1/forecasting/ensure` returns 200 or 409 — never 404 — with only a JWT

Proceed to [`02-module-2.md`](02-module-2.md).
