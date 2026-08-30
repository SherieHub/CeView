# Slice 3 — Module 1 (Onboarding)

**Depends on:** [`01-foundation.md`](01-foundation.md) Tasks 1–6. Independent of Slices 1 and 2.

The onboarding wizard currently makes **zero** network calls — `grep -rn "fetch(\|apiClient"
frontend/components/module-1/` returns nothing. This slice gives it its first. Everything
the wizard collects is discarded on reload, and `uniquenessScore` is never persisted, so
`ProfileCompletionGate`'s redirect decides against fixture state rather than real state.

**Requires `fastapi-sbert`.** Its lifespan hook downloads a ~1.1GB E5 encoder before
`/healthz` serves (`start_period: 600s` in `docker-compose.yml`). Start it and wait:

```bash
cd backend && docker compose up -d
docker compose ps fastapi        # wait for "healthy"
```

---

## Task 18: `classification.analyze` client method

`POST /api/v1/classification/analyze` exists and returns `{ categories: CategoryAllocation[] }`
per [`backend/CONTRACT.md`](../../../../backend/CONTRACT.md). No client method calls it.

**Files:**

- Modify: `services/apiClient.ts` (new `classification` block)
- Modify: `types.ts` (add `CategoryAllocation`)
- Test: `tests/contract/module1.contract.test.ts` (create)

- [ ] **Step 1: Write the failing contract test**

Create `tests/contract/module1.contract.test.ts`:

```ts
/**
 * Live contract test — module 1 endpoints.
 * Requires the Docker stack WITH fastapi-sbert healthy:
 *   cd backend && docker compose up -d && docker compose ps fastapi
 */
import { expect, it } from 'vitest';
import { api, isBackendUp, describeIfBackend } from './backendProbe';

const up = await isBackendUp();

const SAMPLE = {
  businessName: 'Moalboal FreeDive Cebu',
  description: 'Freediving courses and guided sardine-run dives in Moalboal, Cebu.',
  coreServices: ['freediving lessons', 'guided dives', 'equipment rental'],
};

describeIfBackend(up, 'module 1 endpoints', () => {
  it('POST /api/v1/classification/analyze returns category allocations', async () => {
    const res = await api('/api/v1/classification/analyze', {
      method: 'POST',
      body: JSON.stringify(SAMPLE),
    });
    // 503 is acceptable and meaningful: sbert not up yet. 404 is not.
    expect([200, 503]).toContain(res.status);
    if (res.status === 503) {
      expect(await res.json()).toHaveProperty('code');
      return;
    }
    const body = await res.json();
    expect(Array.isArray(body.categories)).toBe(true);
    expect(body.categories[0]).toMatchObject({
      category: expect.any(String),
      percentage: expect.any(Number),
    });
  });
});
```

- [ ] **Step 2: Run it and record the real shape**

```bash
cd frontend && npm run test:contract
```

Expected: PASS (200 or a structured 503). If it 404s, the route differs — check with
`grep -n "analyze" backend/spring-boot/src/main/java/com/ceview/module1/businessinput/ClassificationAnalyzeController.java`
and correct the path before continuing. If the response field names differ from
`category`/`percentage`, use the real ones in Step 3.

- [ ] **Step 3: Add the type**

Append to `types.ts`:

```ts
/** One category and its share of the business's classification, from SBERT. */
export interface CategoryAllocation {
  category: string;
  percentage: number;
}
```

- [ ] **Step 4: Add the client method**

In `services/apiClient.ts`, add a new top-level block:

```ts
  classification: {
    /** Module 1 FR1.x — SBERT classification of the operator's free-text profile. */
    analyze: (input: {
      businessName: string;
      description: string;
      coreServices: string[];
    }) =>
      USE_FIXTURES
        ? delay({ categories: [{ category: 'Coastal & Island', percentage: 100 }] })
        : request<{ categories: CategoryAllocation[] }>('/api/v1/classification/analyze', {
            method: 'POST',
            body: JSON.stringify(input),
          }).then((r) => r.categories),
  },
```

Add `CategoryAllocation` to the type import at the top of the file.

- [ ] **Step 5: Run to verify it passes**

Run: `npm run test:contract`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/services/apiClient.ts frontend/types.ts frontend/tests/contract/module1.contract.test.ts
git commit -m "feat(frontend): add classification.analyze client method"
```

---

## Task 19: `classification.uniqueness` client method

`POST /api/v1/classification/uniqueness` returns `DetailedCalibrationResultDTO` — the
uniqueness score the whole onboarding gate depends on.

**Files:**

- Modify: `services/apiClient.ts`
- Modify: `types.ts`
- Modify: `tests/contract/module1.contract.test.ts`

- [ ] **Step 1: Add the contract case**

Append to the `describeIfBackend` block:

```ts
  it('POST /api/v1/classification/uniqueness returns a score', async () => {
    const res = await api('/api/v1/classification/uniqueness', {
      method: 'POST',
      body: JSON.stringify({ ...SAMPLE, categories: ['Coastal & Island'], uvp: 'Small-group freediving with certified local guides.' }),
    });
    expect([200, 503]).toContain(res.status);
    if (res.status === 503) return;
    const body = await res.json();
    expect(typeof body.uniquenessScore).toBe('number');
    expect(body.uniquenessScore).toBeGreaterThanOrEqual(0);
    expect(body.uniquenessScore).toBeLessThanOrEqual(100);
  });
```

- [ ] **Step 2: Run it and record the real field name**

Run: `npm run test:contract`

Expected: PASS. If the field is not `uniquenessScore`, inspect the DTO and use the real
name — do not rename the backend to match the test:

```bash
grep -rn "record DetailedCalibrationResultDTO" -A 15 backend/spring-boot/src/main/java
```

- [ ] **Step 3: Add the type**

Append to `types.ts`:

```ts
/** Result of the uniqueness-scoring pass — Module 1 FR1.x, ARCHITECTURE_SPEC §Module 1. */
export interface UniquenessResult {
  uniquenessScore: number;
  /** Per-dimension breakdown; keys vary by rubric version, so kept open. */
  breakdown?: Record<string, number>;
  explanation?: string;
}
```

- [ ] **Step 4: Add the client method**

Inside the `classification` block:

```ts
    /** Scores differentiation against the local cohort. Requires fastapi-sbert. */
    uniqueness: (input: {
      businessName: string;
      description: string;
      coreServices: string[];
      categories: string[];
      uvp: string;
    }) =>
      USE_FIXTURES
        ? delay({ uniquenessScore: 72 })
        : request<UniquenessResult>('/api/v1/classification/uniqueness', {
            method: 'POST',
            body: JSON.stringify(input),
          }),
```

- [ ] **Step 5: Run to verify it passes**

Run: `npm run test:contract`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/services/apiClient.ts frontend/types.ts frontend/tests/contract/module1.contract.test.ts
git commit -m "feat(frontend): add classification.uniqueness client method"
```

---

## Task 20: `businessProfile.save()` and remove the cast

`BusinessProfileSettings.tsx:67-70` reaches into `apiClient.businessProfile` through an
`as { … }` cast because no save method exists. The backend has served
`PUT /api/v1/business-profile` all along.

**Files:**

- Modify: `services/apiClient.ts` (the `businessProfile` block)
- Modify: `components/settings/BusinessProfileSettings.tsx:65-75`
- Test: `services/apiClient.businessProfile.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `services/apiClient.businessProfile.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { apiClient } from './apiClient';

describe('businessProfile.save', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ businessProfileId: 'bp-1', businessName: 'Moalboal FreeDive Cebu' }),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('PUTs to /api/v1/business-profile', async () => {
    await apiClient.businessProfile.save({
      businessName: 'Moalboal FreeDive Cebu',
      categories: ['Coastal & Island'],
      coreServices: ['guided dives'],
      description: 'Freediving in Moalboal.',
      uvp: 'Small groups, local guides.',
      imagePreview: null,
      uniquenessScore: 72,
      businessProfileId: null,
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/v1/business-profile');
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body).uniquenessScore).toBe(72);
  });
});
```

This test runs offline — it stubs `fetch`, so it belongs in the default `npm test` run, not
`tests/contract/`.

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run services/apiClient.businessProfile.test.ts`

Expected: FAIL — `apiClient.businessProfile.save is not a function`.

- [ ] **Step 3: Add the method**

In `services/apiClient.ts`:

```ts
  businessProfile: {
    load: () =>
      USE_FIXTURES
        ? delay(EMPTY_BUSINESS_PROFILE_DTO)
        : request<BusinessProfileDto>('/api/v1/business-profile'),
    /** Persists the onboarding result. Returns the saved DTO so callers refresh from the server's view. */
    save: (profile: BusinessProfileDto) =>
      USE_FIXTURES
        ? delay(profile)
        : request<BusinessProfileDto>('/api/v1/business-profile', {
            method: 'PUT',
            body: JSON.stringify(profile),
          }),
  },
```

- [ ] **Step 4: Remove the cast from settings**

In `BusinessProfileSettings.tsx`, delete the comment at lines 65–69 and the cast, and call
the real method:

```tsx
await apiClient.businessProfile.save(profile);
```

- [ ] **Step 5: Run to verify it passes**

```bash
npx vitest run services/apiClient.businessProfile.test.ts && npm test
```

Expected: both PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/services/apiClient.ts frontend/services/apiClient.businessProfile.test.ts frontend/components/settings/BusinessProfileSettings.tsx
git commit -m "feat(frontend): add businessProfile.save and drop the settings cast"
```

---

## Task 21: Wire `AnalysisStep` and wizard completion

**Depends on:** Tasks 18, 19, 20.

**Files:**

- Modify: `components/module-1/onboarding/steps/AnalysisStep.tsx`
- Modify: `components/module-1/onboarding/OnboardingWizard.tsx`
- Modify: `components/module-1/onboarding/steps/BasicInfoStep.tsx:34`
- Test: `components/module-1/onboarding/steps/AnalysisStep.test.tsx` (create)

- [ ] **Step 1: Write the failing test**

Create `AnalysisStep.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../../../services/apiClient';
import { ApiError } from '../../../../services/apiError';
import { AnalysisStep } from './AnalysisStep';

const DRAFT = {
  businessName: 'Moalboal FreeDive Cebu',
  description: 'Freediving courses in Moalboal, Cebu.',
  coreServices: ['guided dives'],
  categories: [],
  uvp: 'Small groups, local guides.',
};

describe('AnalysisStep', () => {
  it('runs classification then uniqueness and shows the score', async () => {
    vi.spyOn(apiClient.classification, 'analyze')
      .mockResolvedValue([{ category: 'Coastal & Island', percentage: 100 }]);
    vi.spyOn(apiClient.classification, 'uniqueness')
      .mockResolvedValue({ uniquenessScore: 72 });

    render(<AnalysisStep draft={DRAFT} onComplete={() => {}} />);

    expect(await screen.findByText(/72/)).toBeInTheDocument();
    await waitFor(() =>
      expect(apiClient.classification.uniqueness).toHaveBeenCalledWith(
        expect.objectContaining({ categories: ['Coastal & Island'] }),
      ),
    );
  });

  it('names the missing dependency when sbert is unavailable', async () => {
    vi.spyOn(apiClient.classification, 'analyze').mockRejectedValue(
      new ApiError({
        status: 503, method: 'POST', path: '/api/v1/classification/analyze',
        body: { code: 'DEPENDENCY_UNREACHABLE', message: 'fastapi-sbert unreachable at http://localhost:8000' },
      }),
    );

    render(<AnalysisStep draft={DRAFT} onComplete={() => {}} />);

    expect(await screen.findByText(/setup required/i)).toBeInTheDocument();
    expect(screen.getByText(/fastapi-sbert unreachable/)).toBeInTheDocument();
  });
});
```

Match `AnalysisStep`'s real props — check them first:

```bash
grep -n "interface\|function AnalysisStep" components/module-1/onboarding/steps/AnalysisStep.tsx
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run components/module-1/onboarding/steps/AnalysisStep.test.tsx`

Expected: FAIL — no network call is made, no score renders.

- [ ] **Step 3: Wire the two calls**

In `AnalysisStep.tsx`:

```tsx
const [result, setResult] = useState<UniquenessResult | null>(null);
const [error, setError] = useState<unknown | null>(null);

useEffect(() => {
  let cancelled = false;

  (async () => {
    try {
      // Classification must finish first — uniqueness scores against the
      // categories it returns, not against the operator's free text.
      const categories = await apiClient.classification.analyze({
        businessName: draft.businessName,
        description: draft.description,
        coreServices: draft.coreServices,
      });
      if (cancelled) return;

      const scored = await apiClient.classification.uniqueness({
        businessName: draft.businessName,
        description: draft.description,
        coreServices: draft.coreServices,
        categories: categories.map((c) => c.category),
        uvp: draft.uvp,
      });
      if (cancelled) return;

      setResult(scored);
      onComplete({ categories: categories.map((c) => c.category), uniquenessScore: scored.uniquenessScore });
    } catch (e) {
      if (!cancelled) setError(e);
    }
  })();

  return () => { cancelled = true; };
}, [draft, onComplete]);
```

Render:

```tsx
{error && <ApiErrorPanel error={error} label="Business analysis" />}
{result && <p className="text-3xl font-semibold">{result.uniquenessScore}</p>}
```

- [ ] **Step 4: Persist on wizard completion**

In `OnboardingWizard.tsx`, the final step must save before redirecting — otherwise
`ProfileCompletionGate` reads a `uniquenessScore` of `null` and bounces the operator back
to onboarding:

```tsx
async function handleFinish() {
  setSaving(true);
  setError(null);
  try {
    const saved = await apiClient.businessProfile.save({
      businessProfileId: profile.businessProfileId,
      businessName: draft.businessName,
      categories: draft.categories,
      coreServices: draft.coreServices,
      description: draft.description,
      uvp: draft.uvp,
      imagePreview: draft.imagePreview ?? null,
      uniquenessScore: draft.uniquenessScore,
    });
    setProfile({ ...profile, ...saved });
    navigate('/dashboard');
  } catch (e) {
    setError(e);
  } finally {
    setSaving(false);
  }
}
```

- [ ] **Step 5: Drop `DEMO_BUSINESS` from `BasicInfoStep`**

Delete the import at line 34 and any prefill that used it. An empty first step is correct:
the operator is entering their own business, and prefilled demo text has been mistaken for
saved data.

If a prefill is wanted for dev, gate it behind the fixture flag rather than importing
unconditionally:

```tsx
const initial = import.meta.env.VITE_USE_FIXTURES === 'true' ? DEMO_BUSINESS : EMPTY_DRAFT;
```

- [ ] **Step 6: Run to verify it passes**

Run: `npx vitest run components/module-1 && npm test`

Expected: both PASS.

- [ ] **Step 7: Verify the full onboarding round-trip**

Register a brand-new account (not a seeded one), complete the wizard, and confirm:

1. The analysis step shows a real score from sbert
2. After finishing, `/dashboard` loads rather than bouncing back to `/onboarding`
3. Reloading keeps you on the dashboard — the score persisted

```bash
TOKEN=<the new account's token>
curl -s http://localhost:8080/api/v1/business-profile -H "Authorization: Bearer $TOKEN"
```

Expected: `uniquenessScore` is a number, not `null`.

- [ ] **Step 8: Verify no fixture imports remain in module 1**

```bash
grep -rn "fixtures/" frontend/components/module-1 --include=*.tsx --include=*.ts | grep -v '\.test\.'
```

Expected: no output, or only the flag-gated `DEMO_BUSINESS` from Step 5.

- [ ] **Step 9: Commit**

```bash
git add frontend/components/module-1
git commit -m "feat(frontend): wire onboarding to classification, uniqueness and profile save"
```

---

## Slice 3 Definition of Done

- [ ] `grep -rn "fetch(\|apiClient" frontend/components/module-1/` now returns matches
- [ ] A new account can complete onboarding and reach the dashboard without bouncing back
- [ ] `uniquenessScore` is persisted and survives a reload
- [ ] With `fastapi-sbert` stopped, the analysis step says "Setup required" and names the
      service, rather than hanging or showing a blank panel
- [ ] `npm test`, `npm run test:contract`, and `./mvnw test` all pass
