# Phase 4 — Tier B: Delete the Frontend Fixture Layer (Tasks 30–35)

The flag, the ternaries, and `services/fixtures/` all go. Screens with a backend
already fetch real data (predecessor plan); screens without one say so.

**Prerequisite:** Phases 0–3 complete (Tasks 1–29).

**Order matters inside this phase.** Task 30 builds the panel, 31-32 rehome what is
not a fixture, 33 rewires the consumers, and only then do 34-35 delete the layer. Do
it in the other order and the tree does not compile between commits.

---

### Task 30: `<NotImplementedPanel>`

**Files:**
- Create: `frontend/components/shared/NotImplementedPanel.tsx`
- Create: `frontend/components/shared/NotImplementedPanel.test.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { NotImplementedPanel } from './NotImplementedPanel';

describe('NotImplementedPanel', () => {
  it('names the feature', () => {
    render(<NotImplementedPanel feature="Published posts" endpoint="GET /api/posts" />);

    expect(screen.getByRole('status')).toHaveTextContent('Published posts');
  });

  it('names the endpoint that does not exist', () => {
    render(<NotImplementedPanel feature="Published posts" endpoint="GET /api/posts" />);

    expect(screen.getByTestId('missing-endpoint')).toHaveTextContent('GET /api/posts');
  });

  it('says the data is absent rather than simulated', () => {
    render(<NotImplementedPanel feature="Published posts" endpoint="GET /api/posts" />);

    expect(screen.getByRole('status')).toHaveTextContent('no backend route');
  });

  it('carries an optional tracking note', () => {
    render(
      <NotImplementedPanel
        feature="Workspace members"
        endpoint="GET /api/workspace/members"
        note="Deferred to spec C."
      />,
    );

    expect(screen.getByRole('status')).toHaveTextContent('Deferred to spec C.');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd frontend && npx vitest run components/shared/NotImplementedPanel.test.tsx
```

Expected: FAIL — module not found

- [ ] **Step 3: Implement**

```tsx
/**
 * "This feature has no backend yet" — stated, not simulated.
 *
 * The third of three surfaces, deliberately distinct from its siblings:
 *   ApiErrorPanel     — the request failed; nothing below is trustworthy
 *   StaleDataBanner   — the data is real but old
 *   NotImplementedPanel — there is no data, because there is no endpoint
 *
 * This replaces the fixture arrays that used to fill these screens. Seed data in
 * a screen a developer believes is wired is worse than an empty screen: it looks
 * like a working feature and reads like real tenant data.
 */
import { Construction } from 'lucide-react';

interface Props {
  /** What the user was expecting to see, e.g. "Published posts". */
  feature: string;
  /** The route that would serve it, e.g. "GET /api/posts". */
  endpoint: string;
  /** Optional tracking context, e.g. "Deferred to spec C." */
  note?: string;
}

export function NotImplementedPanel({ feature, endpoint, note }: Props) {
  return (
    <div
      role="status"
      className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-gray-light)] bg-[var(--color-off-white)] p-6"
    >
      <div className="flex items-center gap-2 text-[var(--color-navy-primary)]">
        <Construction size={18} aria-hidden="true" />
        <h3 className="font-semibold">Not built yet</h3>
      </div>

      <p className="mt-2 text-sm text-[var(--color-text-body)]">
        {feature} needs{' '}
        <span data-testid="missing-endpoint" className="font-mono text-xs">
          {endpoint}
        </span>
        , which has no backend route. Nothing is shown here because there is nothing
        to show — not because it failed to load.
      </p>

      {note && <p className="mt-2 text-sm text-[var(--color-text-muted)]">{note}</p>}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd frontend && npx vitest run components/shared/NotImplementedPanel.test.tsx
```

Expected: PASS — 4 passed

- [ ] **Step 5: Commit** *(operator runs this)*

```bash
git add frontend/components/shared/NotImplementedPanel.tsx frontend/components/shared/NotImplementedPanel.test.tsx
git commit -m "feat(shared): add NotImplementedPanel"
```

---

### Task 31: Rehome `OMCS_RUBRIC_LABELS` and the dev seeds

Three things inside `services/fixtures/` are not fixtures. They move out so the
directory can be deleted wholesale in Task 35.

**Files:**
- Create: `frontend/components/module-3/3.1-content-studio/omcsRubric.ts`
- Create: `frontend/components/module-1/onboarding/devSeed.ts`
- Modify: `frontend/components/module-3/3.1-content-studio/CompliancePanel.tsx:5`
- Modify: `frontend/components/module-1/onboarding/obDraft.tsx:62-67`
- Modify: `frontend/components/module-1/onboarding/steps/BasicInfoStep.tsx:28-36,105`
- Modify: `frontend/App.tsx:12,18,44,89-90`

- [ ] **Step 1: Create the rubric labels module**

```typescript
/**
 * Display labels for the seven OMCS rubric keys the compliance model returns.
 *
 * UI vocabulary, not data — the scores themselves come from
 * POST /api/compliance/omcs-analyze. This lived in services/fixtures/omcs.ts
 * alongside MOCK_OMCS purely by proximity; it is not a fixture and outlives them.
 */
export const OMCS_RUBRIC_LABELS: Record<string, string> = {
  visual_business_context_match: 'Visual ↔ business context match',
  visual_intent_consistency: 'Visual intent consistency',
  tone_visual_mood_alignment: 'Tone ↔ visual mood alignment',
  psychological_strategy_support: 'Psychological strategy support',
  target_audience_fit: 'Target audience fit',
  platform_suitability: 'Platform suitability',
  attribute_coverage_consistency: 'Attribute coverage consistency',
};
```

Update `CompliancePanel.tsx:5` to import from `./omcsRubric`.

- [ ] **Step 2: Create the dev seed module**

Copy the object literal out of `services/fixtures/demoBusiness.ts` into
`frontend/components/module-1/onboarding/devSeed.ts`, exported under a name that
cannot be mistaken for tenant data:

```typescript
/**
 * A filled-in onboarding draft, for development only.
 *
 * Renamed from DEMO_BUSINESS: that name reads like a tenant record, and this is a
 * form-filling convenience. Both consumers are gated on import.meta.env.DEV —
 * BasicInfoStep's "Fill with demo business" button and App.tsx's
 * /preview/onboarding route. It must never be imported by a production path.
 */
import type { ObDraft } from './obDraft';

export const DEV_SEED_DRAFT: ObDraft = {
  // …copy the object from services/fixtures/demoBusiness.ts verbatim,
  //   minus the `naver` key inside `socials` (removed in Task 28).
};
```

- [ ] **Step 3: Repoint the consumers**

`obDraft.tsx` — replace the re-export at :62-67 with:

```typescript
export { DEV_SEED_DRAFT as DEMO_OB_DRAFT } from './devSeed';
```

Keep the `DEMO_OB_DRAFT` alias so `App.tsx` and `OnboardingWizard.test.tsx` are
unaffected; the alias is removed only if a later task renames those call sites.

`BasicInfoStep.tsx` — replace the import at :34 and the re-export at :36:

```typescript
import { DEV_SEED_DRAFT } from '../../devSeed';

export { DEV_SEED_DRAFT as DEMO_BUSINESS };
```

and the button handler at :105:

```typescript
            onClick={() => setDraft({ ...draft, ...DEV_SEED_DRAFT })}
```

Update the comment block at :28-33 to point at `devSeed.ts` instead of
`services/fixtures/demoBusiness.ts`.

- [ ] **Step 4: Inline `DEMO_PROFILE` into the dev preview routes**

In `App.tsx`, delete the import at :18 and declare the value inside the
`devPreviewRoutes` block so no production module can reach it:

```typescript
/**
 * DEV-ONLY seed for /preview/dashboard/:mode. Scoped to this block on purpose —
 * a module-level export would be importable from production code, which is how
 * DEMO_PROFILE ended up in services/fixtures/ in the first place.
 */
const DEV_PREVIEW_PROFILE: BusinessProfile = {
  // …copy the object from services/fixtures/profile.ts verbatim.
  // Note uniquenessScore is 0.82 (0–1 scale, DB-canonical), not 82.
};
```

Update the two uses at :89-90 to `DEV_PREVIEW_PROFILE`.

- [ ] **Step 5: Verify**

```bash
cd frontend && npx tsc --noEmit && npm test
```

Expected: clean, all pass

- [ ] **Step 6: Commit** *(operator runs this)*

```bash
git add frontend/components/module-3/3.1-content-studio/omcsRubric.ts frontend/components/module-1/onboarding/devSeed.ts frontend/components/module-1/onboarding/ frontend/components/module-3/3.1-content-studio/CompliancePanel.tsx frontend/App.tsx
git commit -m "refactor(frontend): move non-fixtures out of services/fixtures"
```

---

### Task 32: Zero `DEFAULT_CAMPAIGN_INPUT`; require the fields

The form currently ships with 95,000 impressions / ₱4,000 spend / ₱35,000 revenue. A
developer who clicks Analyze without editing writes those invented numbers into
`tbl_campaign_records`, where they feed a real PES score and a real AI report.

**Files:**
- Modify: `frontend/components/module-4/4.1-campaign-analytics/IngestionForm.tsx:8-14,35,50-54`
- Modify: `frontend/components/module-4/4.1-campaign-analytics/IngestionForm.test.tsx`

- [ ] **Step 1: Write the failing test**

Append to `IngestionForm.test.tsx`:

```typescript
describe('no prefilled campaign values', () => {
  it('starts every field empty', () => {
    render(<IngestionForm onResult={() => {}} />);

    for (const field of screen.getAllByRole('spinbutton')) {
      expect(field).toHaveValue(null);
    }
  });

  it('does not submit while a field is empty', async () => {
    const user = userEvent.setup();
    render(<IngestionForm onResult={() => {}} />);

    await user.click(screen.getByRole('button', { name: /analyz/i }));

    expect(apiClient.campaign.ingest).not.toHaveBeenCalled();
  });

  it('submits once every field has a value', async () => {
    const user = userEvent.setup();
    render(<IngestionForm onResult={() => {}} />);

    for (const field of screen.getAllByRole('spinbutton')) {
      await user.type(field, '10');
    }
    await user.click(screen.getByRole('button', { name: /analyz/i }));

    expect(apiClient.campaign.ingest).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd frontend && npx vitest run components/module-4/4.1-campaign-analytics/IngestionForm.test.tsx
```

Expected: FAIL — fields carry the prefilled values

- [ ] **Step 3: Implement**

Delete the `DEFAULT_CAMPAIGN_INPUT` import at :35. Replace `initialValues()` at
:50-54:

```typescript
/**
 * Empty, not prefilled.
 *
 * These fields used to open with plausible-looking numbers "as a starting form
 * state". Submitting them unedited wrote fabricated metrics to
 * tbl_campaign_records, where they produced a genuine PES score and a genuine AI
 * report — synthetic data laundered through the database. See the spec's Section 3.
 */
function initialValues(): Record<keyof CampaignInput, string> {
  const values = {} as Record<keyof CampaignInput, string>;
  FIELDS.forEach(({ key }) => {
    values[key] = '';
  });
  return values;
}
```

Add a submit guard beside the existing handler:

```typescript
  const complete = FIELDS.every(({ key }) => values[key].trim() !== '');
```

and gate the submit button with `disabled={!complete || submitting}`, plus an
early `if (!complete) return;` at the top of the submit handler.

Update the file-header comment at :10-14 — the paragraph defending
`DEFAULT_CAMPAIGN_INPUT` as "a legitimate starting form state, not fake data
displayed as real" is no longer true of anything in this file and should be deleted.

- [ ] **Step 4: Run the tests**

```bash
cd frontend && npx vitest run components/module-4/4.1-campaign-analytics/IngestionForm.test.tsx
```

Expected: PASS

- [ ] **Step 5: Commit** *(operator runs this)*

```bash
git add frontend/components/module-4/4.1-campaign-analytics/IngestionForm.tsx frontend/components/module-4/4.1-campaign-analytics/IngestionForm.test.tsx
git commit -m "feat(module-4): stop prefilling the ingestion form with invented metrics"
```

---

### Task 33: Point the no-backend screens at `NotImplementedPanel`

`postStore` and `connectionsStore` exist only to serve endpoints that do not exist.
`useConnections` has no non-test consumer at all.

**Files:**
- Delete: `frontend/services/postStore.tsx`, `frontend/services/postStore.test.tsx`
- Delete: `frontend/services/connectionsStore.tsx`, `frontend/services/connectionsStore.test.tsx`
- Modify: `frontend/App.tsx:15-16,151-155`
- Modify: `frontend/components/module-4/4.1-campaign-analytics/PreviouslyPublished.tsx:14-21,34`
- Modify: `frontend/components/module-4/4.1-campaign-analytics/PostAnalyticsModal.tsx:15,25`
- Modify: `frontend/components/module-3/3.1-content-studio/ContentStudioView.tsx:13,29`
- Modify: `frontend/components/settings/PlatformsSettings.tsx`
- Modify: `frontend/components/settings/WorkspaceSettings.tsx`

- [ ] **Step 1: Write the failing test**

Create `frontend/components/module-4/4.1-campaign-analytics/PreviouslyPublished.notimplemented.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import PreviouslyPublished from './PreviouslyPublished';

describe('PreviouslyPublished without a posts endpoint', () => {
  it('declares itself unbuilt instead of listing seeded posts', () => {
    render(<PreviouslyPublished />);

    expect(screen.getByRole('status')).toHaveTextContent('Not built yet');
    expect(screen.getByTestId('missing-endpoint')).toHaveTextContent('GET /api/posts');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd frontend && npx vitest run components/module-4/4.1-campaign-analytics/PreviouslyPublished.notimplemented.test.tsx
```

Expected: FAIL — renders a post list

- [ ] **Step 3: Replace the four screens**

`PreviouslyPublished.tsx` — delete the `usePosts` import at :21, the `posts`
destructure at :34, and the "KNOWN RUNTIME GAP" comment at :14-15. The component
body becomes:

```tsx
export default function PreviouslyPublished() {
  return (
    <NotImplementedPanel
      feature="Previously published posts"
      endpoint="GET /api/posts"
      note="Deferred to spec C — no publishing backend exists yet."
    />
  );
}
```

Delete `PreviouslyPublished.test.tsx`'s filter-tab tests (including the one Task 28
rewrote) — they exercise a list that no longer renders. The new test file from
Step 1 replaces them.

`PostAnalyticsModal.tsx` — delete the `usePosts` import at :15 and the `metricsFor`
destructure at :25; render `<NotImplementedPanel feature="Post analytics"
endpoint="GET /api/posts/{id}/metrics" />` in place of the chart body. Delete
`PostAnalyticsModal.test.tsx`'s data-driven cases.

`ContentStudioView.tsx` — delete the `MOCK_POSTS` import at :13 and change :29:

```tsx
  // No posts backend exists; the published board declares itself unbuilt below
  // rather than seeding from a fixture. Publishing still updates local state so
  // the compose flow remains demonstrable end-to-end.
  const [posts, setPosts] = useState<PublishedPost[]>([]);
```

Where the board renders, show `<NotImplementedPanel feature="Published posts"
endpoint="GET /api/posts" />` when `posts.length === 0`.

`PlatformsSettings.tsx` and `WorkspaceSettings.tsx` are already stubs — replace each
stub body with the corresponding panel:

```tsx
    <NotImplementedPanel
      feature="Platform connections"
      endpoint="GET /api/platform-connections"
      note="Deferred to spec C."
    />
```

```tsx
    <NotImplementedPanel
      feature="Workspace members"
      endpoint="GET /api/workspace/members"
      note="Deferred to spec C."
    />
```

- [ ] **Step 4: Delete the two stores**

```bash
cd frontend && rm services/postStore.tsx services/postStore.test.tsx services/connectionsStore.tsx services/connectionsStore.test.tsx
```

In `App.tsx`, delete the imports at :15-16 and unwrap the two providers at
:151-155, leaving the child element in place. Update the architecture comment at
:119 to note both stores were removed with the fixture layer.

- [ ] **Step 5: Verify**

```bash
cd frontend && npx tsc --noEmit && npm test
```

Expected: clean, all pass

- [ ] **Step 6: Commit** *(operator runs this)*

```bash
git add frontend/
git commit -m "feat(frontend): declare the three no-backend screens unbuilt"
```

---

### Task 34: Strip `USE_FIXTURES` from `apiClient`

**Files:**
- Modify: `frontend/services/apiClient.ts` (whole file)
- Delete: `frontend/services/apiClient.fixtures.test.ts`

- [ ] **Step 1: Write the failing test**

Create `frontend/services/apiClient.noFixtures.test.ts`:

```typescript
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { apiClient } from './apiClient';

/**
 * Every method issues a request. There is no branch that resolves from a local
 * module — that was the whole ambiguity this removes.
 */
describe('apiClient has no fixture branch', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(() =>
      Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ markets: [] }) }),
    ));
  });

  it('markets.list hits the network', async () => {
    await apiClient.markets.list();
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/forecasting/markets'),
      expect.anything(),
    );
  });

  it('exposes no posts, connections or workspace methods', () => {
    expect('posts' in apiClient).toBe(false);
    expect('connections' in apiClient).toBe(false);
    expect('workspace' in apiClient).toBe(false);
  });

  it('does not resolve anything without fetch', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('network down'))));

    await expect(apiClient.notifications.list()).rejects.toThrow('network down');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd frontend && npx vitest run services/apiClient.noFixtures.test.ts
```

Expected: FAIL — `posts` still exists

- [ ] **Step 3: Rewrite the client**

Delete the nine fixture imports (:10-18), the `USE_FIXTURES` const (:37), the
`delay()` helper (:40-43), and the `EMPTY_BUSINESS_PROFILE_DTO` const (:71-80,
used only by the fixture branch). Replace the file header:

```typescript
/**
 * Typed API client. Every method issues a real request against the Spring Boot
 * orchestration API — there is no fixture branch and no environment flag that
 * changes what a screen shows. A dependency that cannot answer produces an
 * ApiError carrying the backend's own cause (services/apiError.ts).
 */
```

Collapse every method to its `request(...)` half, dropping the ternary. For example:

```typescript
  markets: {
    list: () =>
      request<{ markets: Market[] }>('/api/forecasting/markets').then((r) => r.markets),
```

Delete the `posts`, `connections` and `workspace` blocks entirely (:306-327) —
Task 33 removed their only consumers, and a method that cannot succeed is worse
than no method. Delete the now-unused `WorkspaceMemberFixture`, `PlatformConnection`
and `PostMetric` type imports.

- [ ] **Step 4: Delete the fixture test**

```bash
cd frontend && rm services/apiClient.fixtures.test.ts
```

- [ ] **Step 5: Verify**

```bash
cd frontend && npx vitest run services/apiClient.noFixtures.test.ts
cd frontend && npx tsc --noEmit && npm test
```

Expected: PASS. Tests that imported fixtures for their arrange step now fail to
resolve — move each one's data into a local `const` inside the test file. Test
doubles inside test files are fine; the problem was only that production code could
import them.

- [ ] **Step 6: Commit** *(operator runs this)*

```bash
git add frontend/services/apiClient.ts frontend/services/apiClient.noFixtures.test.ts frontend/
git rm frontend/services/apiClient.fixtures.test.ts
git commit -m "feat(frontend): remove the apiClient fixture branch"
```

---

### Task 35: Delete `services/fixtures/` and the flag

**Files:**
- Delete: `frontend/services/fixtures/` (11 modules + `README.md`)
- Modify: `frontend/.env`, `frontend/.env.example`, `frontend/vite-env.d.ts`
- Modify: `frontend/types.ts:86-92`

- [ ] **Step 1: Confirm nothing imports the directory**

```bash
cd frontend && grep -rn "services/fixtures\|from './fixtures" --include=*.ts --include=*.tsx . | grep -v node_modules
```

Expected: no output. Any hit must be resolved before deleting — Tasks 31-34 should
have cleared them all.

- [ ] **Step 2: Delete the directory**

```bash
cd frontend && rm -rf services/fixtures
```

- [ ] **Step 3: Remove the flag**

From `frontend/.env` and `frontend/.env.example`, delete the two comment lines and
the `VITE_USE_FIXTURES=` line. From `frontend/vite-env.d.ts`, delete
`readonly VITE_USE_FIXTURES?: string;`, leaving:

```typescript
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_FIREBASE_APP_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

- [ ] **Step 4: Resolve the two member types**

In `frontend/types.ts`, delete `WorkspaceMemberFixture` and the :86-92 comment
explaining why two member shapes coexisted. `WorkspaceMember` survives as the single
definition, unused until an endpoint lands — mark it so:

```typescript
/**
 * The workspace member shape a real GET /api/workspace/members would return.
 * Currently unreferenced: the endpoint does not exist and Settings → Workspace
 * renders NotImplementedPanel (Task 33). Kept as the target shape.
 */
```

- [ ] **Step 5: Verify the flag is gone everywhere**

```bash
cd .. && grep -rn "VITE_USE_FIXTURES" --include=*.ts --include=*.tsx --include=*.yml --include=*.env* frontend/ render.yaml ; echo "exit=$?"
```

Expected: no output, `exit=1`. (Historical mentions in `docs/` and `ceview/` are
fine — `ceview/` is the frozen build and docs are records.)

- [ ] **Step 6: Verify the app still builds and runs**

```bash
cd frontend && npx tsc --noEmit && npm test && npm run build
```

Expected: clean, all pass, build succeeds

- [ ] **Step 7: Verify against the live stack**

```bash
cd backend && docker compose up -d && sleep 90
cd frontend && npm run test:contract
```

Expected: PASS. Then open the app as a seeded operator and walk all four modules.
Every screen shows real data, a staleness banner, an error panel naming a
dependency, or a "Not built yet" panel — nothing else.

- [ ] **Step 8: Commit** *(operator runs this)*

```bash
git add frontend/
git rm -r frontend/services/fixtures
git commit -m "feat(frontend): delete the fixture layer and its flag"
```

---

## Phase 4 exit criteria

- [ ] `cd frontend && npx tsc --noEmit` — clean
- [ ] `cd frontend && npm test` — all pass
- [ ] `cd frontend && npm run build` — succeeds
- [ ] `cd frontend && npm run test:contract` — all pass against a live backend
- [ ] `grep -rn "VITE_USE_FIXTURES\|services/fixtures" frontend/` returns nothing
- [ ] `ls frontend/services/fixtures` fails — the directory is gone
- [ ] Every screen in all four modules shows real data, a staleness banner, an
      error panel, or a "Not built yet" panel
