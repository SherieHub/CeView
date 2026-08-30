# Slice 4 — Module 3 (Content Studio)

**Depends on:** [`01-foundation.md`](01-foundation.md) Tasks 1–6. Independent of Slices 1–3,
but scheduled last because it is the most AI-dependent.

**This is not a path fix.** The backend endpoints require request bodies the frontend has
never assembled:

- `POST /api/content/generate` takes `{market, businessName, description, categories, trend}`
- `POST /api/compliance/omcs-analyze` rejects a blank `caption` or `imageUrl` with a 400

Today `content.list()` is a bodyless GET to `/api/content` and `omcs.evaluate()` POSTs
nothing. Three components read `MOCK_CONTENT` / `MOCK_OMCS` / `MOCK_POSTS` directly.

**Requires `fastapi-sbert` healthy AND a `GROQ_API_KEY`:**

```bash
cd backend
grep GROQ_API_KEY .env || echo "GROQ_API_KEY=<your key>" >> .env
docker compose up -d
docker compose ps fastapi        # wait for "healthy"
```

Without the key, every task here still completes — the screens render "Setup required"
naming `GROQ_API_KEY`, which is the designed behaviour and is worth verifying deliberately.

---

## Task 22: `content.generate` with a real request body

**Files:**

- Modify: `services/apiClient.ts` (replace the `content` block)
- Test: `tests/contract/module3.contract.test.ts` (create)

- [ ] **Step 1: Write the failing contract test**

Create `tests/contract/module3.contract.test.ts`:

```ts
/**
 * Live contract test — module 3 endpoints.
 * Requires the Docker stack with fastapi-sbert healthy and GROQ_API_KEY set:
 *   cd backend && docker compose up -d && docker compose ps fastapi
 */
import { expect, it } from 'vitest';
import { api, isBackendUp, describeIfBackend } from './backendProbe';

const up = await isBackendUp();

const GENERATE_BODY = {
  market: 'korea',
  businessName: 'Moalboal FreeDive Cebu',
  description: 'Freediving courses and guided sardine-run dives in Moalboal, Cebu.',
  categories: ['Coastal & Island'],
  trend: 'surging',
};

describeIfBackend(up, 'module 3 endpoints', () => {
  it('POST /api/content/generate returns captions for the requested market', async () => {
    const res = await api('/api/content/generate', {
      method: 'POST',
      body: JSON.stringify(GENERATE_BODY),
    });
    // 503 with a structured code is a valid outcome (no GROQ_API_KEY). 404 is not.
    expect([200, 503]).toContain(res.status);
    if (res.status === 503) {
      expect(await res.json()).toHaveProperty('code');
      return;
    }
    const body = await res.json();
    expect(body).toHaveProperty('captions');
    expect(body.market).toMatchObject({ country: expect.any(String) });
  });

  it('POST /api/content/generate rejects a missing market', async () => {
    const res = await api('/api/content/generate', {
      method: 'POST',
      body: JSON.stringify({ ...GENERATE_BODY, market: '' }),
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});
```

- [ ] **Step 2: Run it and record the real response shape**

```bash
cd frontend && npm run test:contract
```

Expected: PASS. If `captions` is nested differently from the fixture's
`ContentResponse`, note the real shape now — Step 3's type depends on it.

- [ ] **Step 3: Replace the client method**

In `services/apiClient.ts`, replace the whole `content` block:

```ts
  content: {
    /**
     * Module 3 FR3.3–FR3.6 — generates market-localized captions.
     * The request body is assembled by the caller from ProfileContext plus the
     * market selected on the dashboard; there is no bodyless "list all content"
     * endpoint, and never was.
     */
    generate: (input: {
      market: string;
      businessName: string;
      description: string;
      categories: string[];
      trend: string;
    }) =>
      USE_FIXTURES
        ? delay(MOCK_CONTENT)
        : request<ContentResponse>('/api/content/generate', {
            method: 'POST',
            body: JSON.stringify(input),
          }),
    /** FR3.10 — operator approves the generated set for a market. */
    approve: (market: string) =>
      USE_FIXTURES
        ? delay({ approvedIds: [], market, count: 0 })
        : request<{ approvedIds: string[]; market: string; count: number }>(
            '/api/content/approve',
            { method: 'POST', body: JSON.stringify({ market }) },
          ),
  },
```

`approve` relies on the `profileId` param becoming optional in
[`01-foundation.md`](01-foundation.md) Task 6.

Add `ContentResponse` to the type import at the top of the file.

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test:contract`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/services/apiClient.ts frontend/tests/contract/module3.contract.test.ts
git commit -m "feat(frontend): replace content.list with a real content.generate call"
```

---

## Task 23: `compliance.omcsAnalyze` with real caption and image

`apiClient.omcs.evaluate()` POSTs nothing to `/api/omcs/evaluate` (404). The real endpoint
is `POST /api/compliance/omcs-analyze`, and it throws
`MOD3_COMPLIANCE_VALIDATION` on a blank `caption` or `imageUrl` — so the UI must not fire
until the operator has both.

**Files:**

- Modify: `services/apiClient.ts` (replace the `omcs` block)
- Modify: `tests/contract/module3.contract.test.ts`

- [ ] **Step 1: Add the contract cases**

Append to the `describeIfBackend` block:

```ts
  it('POST /api/compliance/omcs-analyze scores a caption + image pair', async () => {
    const res = await api('/api/compliance/omcs-analyze', {
      method: 'POST',
      body: JSON.stringify({
        caption: 'Sardine run season is here — join a small-group freedive in Moalboal.',
        imageUrl: 'https://example.invalid/sardine-run.jpg',
      }),
    });
    expect([200, 503]).toContain(res.status);
    if (res.status === 503) return;
    const body = await res.json();
    expect(body).toMatchObject({
      omcsScore: expect.any(Number),
      status: expect.stringMatching(/^(Pass|Fail)$/),
    });
  });

  it('rejects a blank caption with a validation error, not a 500', async () => {
    const res = await api('/api/compliance/omcs-analyze', {
      method: 'POST',
      body: JSON.stringify({ caption: '   ', imageUrl: 'https://example.invalid/x.jpg' }),
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });
```

- [ ] **Step 2: Run to confirm backend behaviour**

Run: `npm run test:contract`

Expected: PASS. If the blank-caption case returns 500, the `IllegalArgumentException` is
not mapped to a 4xx — fix the exception handler before wiring the UI, or the error panel
will report a server fault for what is user input.

- [ ] **Step 3: Replace the client block**

```ts
  compliance: {
    /**
     * OMCS = 0.35·profile_semantic + 0.45·recommendations_picture + 0.20·pubmat_consistency,
     * Pass/Fail at 70. Both arguments are required — the backend 400s on either blank,
     * so callers must gate the call until the operator has a caption and an image.
     */
    omcsAnalyze: (input: { caption: string; imageUrl: string }) =>
      USE_FIXTURES
        ? delay(MOCK_OMCS)
        : request<OmcsAuditResult>('/api/compliance/omcs-analyze', {
            method: 'POST',
            body: JSON.stringify(input),
          }),
  },
```

Delete the old `omcs` block. `omcs.rubric()` had no backend equivalent —
`OMCS_RUBRIC_LABELS` is a static display map, so import it directly in `CompliancePanel`
rather than routing a constant through the network client.

Add `OmcsAuditResult` to the type import.

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test:contract`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/services/apiClient.ts frontend/tests/contract/module3.contract.test.ts
git commit -m "feat(frontend): wire compliance.omcsAnalyze with required caption and image"
```

---

## Task 24: `creativeDirection.generate`

**Files:**

- Modify: `services/apiClient.ts`
- Modify: `types.ts`
- Modify: `tests/contract/module3.contract.test.ts`

- [ ] **Step 1: Add the contract case**

```ts
  it('POST /api/creative-direction/generate works with only a JWT', async () => {
    const res = await api('/api/creative-direction/generate', { method: 'POST' });
    expect([200, 409, 503]).toContain(res.status);
    // Foundation Task 6 added the pathless variant; a 404 means it did not register.
    expect(res.status).not.toBe(404);
    if (res.status !== 200) return;
    expect(await res.json()).toHaveProperty('shotListRecommendations');
  });
```

- [ ] **Step 2: Run to verify**

Run: `npm run test:contract`

Expected: PASS. A 404 means [`01-foundation.md`](01-foundation.md) Task 6 was not
completed — go back and finish it.

- [ ] **Step 3: Add the type**

Append to `types.ts`:

```ts
/** Module 3 creative direction — the VisualDirectionBoard's data. */
export interface CreativeDirection {
  shotListRecommendations: string[];
  visualRecommendations: string[];
  lightingSuggestions: string[];
  moodboardReferences: string[];
}
```

- [ ] **Step 4: Add the client method**

```ts
  creativeDirection: {
    /** Shot list, visual and lighting direction for the VisualDirectionBoard. */
    generate: () =>
      USE_FIXTURES
        ? delay({
            shotListRecommendations: [],
            visualRecommendations: [],
            lightingSuggestions: [],
            moodboardReferences: [],
          })
        : request<CreativeDirection>('/api/creative-direction/generate', { method: 'POST' }),
  },
```

- [ ] **Step 5: Run to verify it passes**

Run: `npm run test:contract`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/services/apiClient.ts frontend/types.ts frontend/tests/contract/module3.contract.test.ts
git commit -m "feat(frontend): add creativeDirection.generate client method"
```

---

## Task 25: Drop fixture imports from module-3 components

**Depends on:** Tasks 22, 23, 24.

Four components read fixtures directly. `ContentBoard` keeps `MOCK_POSTS` — publishing is
spec C, and removing it would break the board with no replacement.

**Files:**

- Modify: `components/module-3/3.1-content-studio/ContentStudioView.tsx:9`
- Modify: `components/module-3/3.1-content-studio/AIContentMatrixPanel.tsx:3`
- Modify: `components/module-3/3.1-content-studio/VisualDirectionBoard.tsx:2`
- Modify: `components/module-3/3.1-content-studio/CompliancePanel.tsx:3`
- Test: `components/module-3/3.1-content-studio/ContentStudioView.test.tsx` (create)

- [ ] **Step 1: Write the failing test**

Create `ContentStudioView.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../../services/apiClient';
import { ApiError } from '../../../services/apiError';
import { ContentStudioView } from './ContentStudioView';
import { ProfileProvider } from '../../../services/profileContext';

const PROFILE = {
  businessProfileId: 'bp-1',
  businessName: 'Moalboal FreeDive Cebu',
  categories: ['Coastal & Island'],
  coreServices: ['guided dives'],
  description: 'Freediving in Moalboal.',
  uvp: 'Small groups.',
  imagePreview: null,
  uniquenessScore: 72,
};

function renderStudio() {
  return render(
    <ProfileProvider initialProfile={PROFILE as never}>
      <ContentStudioView selectedMarket="korea" />
    </ProfileProvider>,
  );
}

describe('ContentStudioView', () => {
  it('builds the generate request from profile and selected market', async () => {
    // ContentResponse.captions is a fixed four-platform object, not an open map,
    // so an empty {} does not typecheck — every platform key must be present.
    const emptyPlatform = { optionNames: [], options: [], optionMetadata: [], guide: [] };
    const generate = vi.spyOn(apiClient.content, 'generate').mockResolvedValue({
      market: { country: 'South Korea', city: 'Seoul', flag: 'KR' },
      framework: 'SOR',
      source: 'groq',
      captions: {
        instagram: emptyPlatform,
        tiktok: emptyPlatform,
        facebook: emptyPlatform,
        naver: emptyPlatform,
      },
    });

    renderStudio();

    await waitFor(() => expect(generate).toHaveBeenCalledWith({
      market: 'korea',
      businessName: 'Moalboal FreeDive Cebu',
      description: 'Freediving in Moalboal.',
      categories: ['Coastal & Island'],
      trend: expect.any(String),
    }));
  });

  it('names GROQ_API_KEY when content generation is unconfigured', async () => {
    vi.spyOn(apiClient.content, 'generate').mockRejectedValue(
      new ApiError({
        status: 503, method: 'POST', path: '/api/content/generate',
        body: { code: 'DEPENDENCY_NOT_CONFIGURED', message: 'GROQ_API_KEY is not set' },
      }),
    );

    renderStudio();

    expect(await screen.findByText(/setup required/i)).toBeInTheDocument();
    expect(screen.getByText(/GROQ_API_KEY is not set/)).toBeInTheDocument();
  });
});
```

Match `ContentStudioView`'s real props and `ProfileProvider`'s real seeding prop first:

```bash
grep -n "function ContentStudioView" -A 8 components/module-3/3.1-content-studio/ContentStudioView.tsx
grep -n "initialProfile\|ProfileProvider" services/profileContext.tsx
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run components/module-3/3.1-content-studio/ContentStudioView.test.tsx`

Expected: FAIL — `generate` is never called; the view reads `MOCK_POSTS`/`MOCK_CONTENT`.

- [ ] **Step 3: Wire `ContentStudioView`**

Delete the `MOCK_POSTS` and `MOCK_CONTENT` imports for content generation and fetch:

```tsx
const { profile } = useProfile();
const [content, setContent] = useState<ContentResponse | null>(null);
const [error, setError] = useState<unknown | null>(null);
const [loading, setLoading] = useState(false);

useEffect(() => {
  // The backend 400s on a blank market, so don't fire until one is chosen.
  if (!selectedMarket || !profile.businessName) return;

  let cancelled = false;
  setLoading(true);
  setError(null);

  apiClient.content
    .generate({
      market: selectedMarket,
      businessName: profile.businessName,
      description: profile.description,
      categories: profile.categories,
      trend: marketTrend ?? 'steady',
    })
    .then((c) => { if (!cancelled) setContent(c); })
    .catch((e) => { if (!cancelled) setError(e); })
    .finally(() => { if (!cancelled) setLoading(false); });

  return () => { cancelled = true; };
}, [selectedMarket, profile, marketTrend]);
```

Render:

```tsx
{error && <ApiErrorPanel error={error} label="Content Studio" />}
```

Pass `content` down to `AIContentMatrixPanel` as a prop instead of letting it import
`MOCK_CONTENT`.

- [ ] **Step 4: Wire `CompliancePanel`**

Replace the `MOCK_OMCS` import. Keep `OMCS_RUBRIC_LABELS` — it is a static display map, not
data:

```tsx
import { OMCS_RUBRIC_LABELS } from '../../../services/fixtures/omcs';
import type { OmcsAuditResult } from '../../../types';
```

Gate the call on both required inputs, since the backend 400s on either blank:

```tsx
async function runAudit() {
  if (!caption.trim() || !imageUrl.trim()) {
    setError(new Error('Add a caption and an image before running the audit.'));
    return;
  }
  setRunning(true);
  setError(null);
  try {
    setAudit(await apiClient.compliance.omcsAnalyze({ caption, imageUrl }));
  } catch (e) {
    setError(e);
  } finally {
    setRunning(false);
  }
}
```

- [ ] **Step 5: Wire `VisualDirectionBoard`**

Replace the `MOCK_CONTENT` import with the real call:

```tsx
useEffect(() => {
  let cancelled = false;
  apiClient.creativeDirection
    .generate()
    .then((d) => { if (!cancelled) setDirection(d); })
    .catch((e) => { if (!cancelled) setError(e); });
  return () => { cancelled = true; };
}, []);
```

- [ ] **Step 6: Leave `ContentBoard` alone**

`ContentBoard.tsx` keeps `MOCK_POSTS`. Add a comment marking it deliberate so a future
reader doesn't take it for an oversight:

```tsx
// Publishing has no backend yet — GET /api/posts is deferred to spec C
// (docs/superpowers/specs/2026-08-29-frontend-backend-connection-design.md §Non-goals).
// This board stays fixture-backed until that lands.
```

- [ ] **Step 7: Verify the intended fixture imports are the only ones left**

```bash
grep -rn "fixtures/" frontend/components/module-3 --include=*.tsx --include=*.ts | grep -v '\.test\.'
```

Expected: exactly two lines — `MOCK_POSTS` in `ContentBoard.tsx` and `OMCS_RUBRIC_LABELS`
in `CompliancePanel.tsx`. Anything else is unfinished.

- [ ] **Step 8: Run all checks**

```bash
cd frontend && npm test && npm run test:contract
```

Expected: both PASS.

- [ ] **Step 9: Verify in the browser, both configured and not**

With `GROQ_API_KEY` set: open Content Studio, pick a market, confirm captions render from
`source: "groq"` and DevTools shows `POST /api/content/generate` 200.

Then unset the key, restart Spring Boot, and reload: the panel reads "Setup required —
GROQ_API_KEY is not set". Both outcomes are correct; verify both.

- [ ] **Step 10: Commit**

```bash
git add frontend/components/module-3
git commit -m "feat(frontend): wire Content Studio to real content, compliance and creative endpoints"
```

---

## Slice 4 Definition of Done

- [ ] Only two fixture imports remain in `components/module-3` — `MOCK_POSTS` in
      `ContentBoard` and `OMCS_RUBRIC_LABELS` in `CompliancePanel`, both commented as deliberate
- [ ] Selecting a market generates captions from the real backend (`source: "groq"`)
- [ ] The OMCS audit refuses to fire without a caption and image, and scores a real pair
- [ ] `VisualDirectionBoard` renders backend-generated shot lists
- [ ] With `GROQ_API_KEY` unset, every affected panel says "Setup required" and names the
      variable — no blank panels, no console-only failures
- [ ] `npm test`, `npm run test:contract`, and `./mvnw test` all pass

---

## Plan-wide Definition of Done

With all four slices merged:

- [ ] `VITE_USE_FIXTURES=false` (the default) renders real data on every screen except the
      three deferred to spec C
- [ ] `VITE_USE_FIXTURES=true` still renders the whole app offline
- [ ] No component outside `services/fixtures/` imports a domain type from a fixture module
- [ ] `npm run test:contract` passes against the Docker stack and skips cleanly without it
- [ ] Playwright e2e walks login → onboarding → dashboard → studio → analytics against the
      real stack
