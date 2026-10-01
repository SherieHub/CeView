# Slice 2 — Module 4 (Campaign Analytics)

**Depends on:** [`01-foundation.md`](01-foundation.md) Tasks 1–6. Independent of Slice 1.

Smallest surface of the four slices. Seed data comes from
`V15__module4_campaign_seed_data.sql`, and no AI service is required for the metrics and
history paths — only `POST /analytics/report` calls out to FastAPI.

---

## Task 13: Tenant-scope `GET /api/v1/analytics/metrics`

**This task must land before Task 16**, and before anything wires the endpoint.

`EngagementMetricsController.metrics()` calls `metricsSvc.defaultMetrics(weeks)` with no
profile scoping — unlike `/history` and `/manual` beside it, which both call
`currentBusinessProfile.resolveProfileId()`. Wiring the frontend to it as-is would expose
one operator's metrics to another, violating the multi-tenant rule in `.claude/CLAUDE.md`.

**Files:**

- Modify: `backend/spring-boot/src/main/java/com/ceview/module4/engagement/EngagementMetricsController.java:62-66`
- Modify: `backend/spring-boot/src/main/java/com/ceview/module4/engagement/MetricsCalculationService.java`
- Test: `backend/spring-boot/src/test/java/com/ceview/module4/engagement/MetricsTenantScopingTest.java`

- [ ] **Step 1: Write the failing test**

Create `src/test/java/com/ceview/module4/engagement/MetricsTenantScopingTest.java`:

```java
package com.ceview.module4.engagement;

import com.ceview.auth.CurrentBusinessProfile;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class MetricsTenantScopingTest {

    private static final UUID PROFILE = UUID.fromString("20000000-0000-0000-0000-000000000001");

    @Test
    void metricsAreScopedToTheAuthenticatedProfile() {
        MetricsCalculationService svc = Mockito.mock(MetricsCalculationService.class);
        CurrentBusinessProfile current = Mockito.mock(CurrentBusinessProfile.class);
        Mockito.when(current.resolveProfileId()).thenReturn(PROFILE);

        EngagementMetricsController controller = newControllerUnderTest(svc, current);
        controller.metrics(4);

        // The isolation guarantee: the profile id reaches the service on every call.
        Mockito.verify(svc).defaultMetrics(PROFILE, 4);
        Mockito.verify(current).resolveProfileId();
    }

    /**
     * Built via the real constructor so the test breaks if a future change drops
     * CurrentBusinessProfile from the controller's dependencies.
     */
    private EngagementMetricsController newControllerUnderTest(
            MetricsCalculationService svc, CurrentBusinessProfile current) {
        return new EngagementMetricsController(
                svc,
                Mockito.mock(CampaignRecordRepository.class),
                Mockito.mock(com.ceview.module4.pes.PESComputationService.class),
                current);
    }
}
```

Adjust the constructor arguments to match the real signature — check it with:

```bash
grep -n "public EngagementMetricsController" -A 10 src/main/java/com/ceview/module4/engagement/EngagementMetricsController.java
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd backend/spring-boot && ./mvnw test -Dtest=MetricsTenantScopingTest
```

Expected: compilation failure — `defaultMetrics` takes only `(int weeks)`.

- [ ] **Step 3: Add the profile parameter to the service**

In `MetricsCalculationService`, change the signature and scope the read to the profile's
own campaign records:

```java
/**
 * Default metrics for the analytics board, scoped to one business profile.
 * Previously took only `weeks` and returned the same demo numbers to every
 * operator — a multi-tenant isolation gap (spec §Risks 2).
 */
public MetricsResponse defaultMetrics(UUID businessProfileId, int weeks) {
    List<CampaignRecord> records = campaignRepo.findByBusinessProfileIdOrderByCreatedAtDesc(
            businessProfileId, PageRequest.of(0, weeks));
    if (records.isEmpty()) {
        return emptyMetrics(weeks);
    }
    return aggregate(records, weeks);
}
```

Keep the existing demo-scaling behaviour for `emptyMetrics(weeks)` so an operator with no
records still renders a populated board rather than a blank one.

- [ ] **Step 4: Scope the controller**

```java
@GetMapping("/metrics")
public MetricsResponse metrics(
        @RequestParam(required = false, defaultValue = "4") int weeks) {
    return metricsSvc.defaultMetrics(currentBusinessProfile.resolveProfileId(), weeks);
}
```

Add `CurrentBusinessProfile` to the controller's constructor if it isn't already injected.

- [ ] **Step 5: Run to verify it passes**

```bash
./mvnw test -Dtest=MetricsTenantScopingTest && ./mvnw test
```

Expected: both PASS.

- [ ] **Step 6: Verify isolation against two seeded operators**

```bash
login() { curl -s -X POST http://localhost:8080/api/v1/auth/login \
  -H 'Content-Type: application/json' -d "{\"email\":\"$1\",\"password\":\"$2\"}" \
  | sed -E 's/.*"token":"([^"]+)".*/\1/'; }

A=$(login ramon.delacruz@ceview.local 'MoalboalDive2024!')
B=$(login nena.villaflor@ceview.local 'LechonCebu2024!')

curl -s http://localhost:8080/api/v1/analytics/metrics -H "Authorization: Bearer $A" > /tmp/a.json
curl -s http://localhost:8080/api/v1/analytics/metrics -H "Authorization: Bearer $B" > /tmp/b.json
diff /tmp/a.json /tmp/b.json && echo "IDENTICAL — scoping did not take effect"
```

Expected: the files **differ**. If `diff` reports them identical and both operators have
campaign records, the scoping is not working — do not proceed.

- [ ] **Step 7: Commit**

```bash
git add backend/spring-boot/src/main/java/com/ceview/module4 backend/spring-boot/src/test/java/com/ceview/module4
git commit -m "fix(backend): scope GET /api/v1/analytics/metrics to the authenticated profile"
```

---

## Task 14: `campaign.history` → real endpoint

`campaign.history()` calls `/api/campaigns/history` (404). The backend serves
`GET /api/v1/analytics/history?weeks=4|8` returning `CampaignHistoryResponse`, whose
`CampaignSnapshot` shape must be mapped to the frontend's `CampaignHistoryEntry`.

**Files:**

- Modify: `services/apiClient.ts` (the `campaign` block)
- Test: `tests/contract/module4.contract.test.ts` (create)

- [ ] **Step 1: Write the failing contract test**

Create `tests/contract/module4.contract.test.ts`:

```ts
/**
 * Live contract test — module 4 endpoints.
 * Requires the Docker stack: cd backend && docker compose up -d
 */
import { expect, it } from 'vitest';
import { api, isBackendUp, describeIfBackend } from './backendProbe';

const up = await isBackendUp();

describeIfBackend(up, 'module 4 endpoints', () => {
  it('GET /api/v1/analytics/history returns chronological snapshots', async () => {
    const res = await api('/api/v1/analytics/history?weeks=4');
    expect(res.status).toBe(200);
    const body = await res.json();
    const rows = body.snapshots ?? body.history ?? body;
    expect(Array.isArray(rows)).toBe(true);
    if (rows.length > 0) {
      expect(rows[0]).toMatchObject({
        periodStart: expect.any(String),
        periodEnd: expect.any(String),
        pesScore: expect.any(Number),
      });
    }
  });

  it('GET /api/v1/analytics/metrics is scoped and returns KPI values', async () => {
    const res = await api('/api/v1/analytics/metrics?weeks=4');
    expect(res.status).toBe(200);
    expect(await res.json()).toHaveProperty('metrics');
  });
});
```

- [ ] **Step 2: Run to confirm the backend shape**

```bash
cd frontend && npm run test:contract
```

Expected: PASS. If the envelope key differs from `snapshots`, the test's
`body.snapshots ?? body.history ?? body` fallback reveals which — note the real key and
use it in Step 3 rather than guessing.

- [ ] **Step 3: Fix the client**

Replace the `campaign` block in `services/apiClient.ts`:

```ts
  campaign: {
    defaultInput: () =>
      USE_FIXTURES
        ? delay(DEFAULT_CAMPAIGN_INPUT)
        : request<{ metrics: Record<string, { value: number }> }>('/api/v1/analytics/metrics?weeks=4'),
    history: (weeks: 4 | 8 = 4) =>
      USE_FIXTURES
        ? delay(MOCK_HISTORY)
        : request<{ snapshots: CampaignHistoryEntry[] }>(
            `/api/v1/analytics/history?weeks=${weeks}`,
          ).then((r) => r.snapshots),
    report: () =>
      USE_FIXTURES
        ? delay(MOCK_REPORT)
        : request<PrescriptiveReport>('/api/v1/analytics/report', { method: 'POST' }),
    /** Operator-entered campaign values — the DataIngestionForm submit path. */
    ingest: (input: CampaignInput) =>
      USE_FIXTURES
        ? delay({ ok: true })
        : request('/api/v1/analytics/manual', {
            method: 'POST',
            body: JSON.stringify(input),
          }),
    pes: (campaignId: string) =>
      USE_FIXTURES
        ? delay({ overallScore: 78, label: 'Good', breakdown: {} })
        : request(`/api/v1/analytics/pes/${campaignId}`),
  },
```

Add the types to the import at the top:

```ts
import type {
  PlatformConnection, PostMetric, BusinessProfileDto, DemandAlert, Market,
  CampaignHistoryEntry, CampaignInput, PrescriptiveReport,
} from '../types';
```

`CampaignSnapshot` and `CampaignHistoryEntry` share field names
(`periodStart`, `periodEnd`, `pesScore`, `pesLabel`, `ctr`, `cpc`, `roas`, `convRate`,
`cac`), so unwrapping the envelope is the whole mapping. If Step 2 showed differing names,
add an explicit `.map()` here rather than renaming the frontend type.

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test:contract`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/services/apiClient.ts frontend/tests/contract/module4.contract.test.ts
git commit -m "fix(frontend): point campaign.history at /api/v1/analytics/history"
```

---

## Task 15: `campaign.report` → real endpoint, with error surface

> ### ⚠ Known defect found during Task 14 — read before implementing
>
> `POST /api/analytics/report` currently answers **200 with a literal empty object `{}`**
> (2 bytes), with `fastapi-sbert` healthy and `GROQ_API_KEY` set (len 56).
>
> Evidence gathered:
>
> - Calling FastAPI's `/internal/report/generate` **directly from inside the spring
>   container** also returns `{}` at 200 — so the empty body originates upstream, not in
>   Spring's mapping.
> - Spring's FR4.26 rule-based fallback in `PrescriptiveReportController` therefore
>   **never fires**: it is in a `catch`, and FastAPI reported success. Confirmed by
>   diffing the container log before/after a single request — that request produces
>   **zero** log lines.
> - `PrescriptiveReportService.buildRuleBasedReport(...)` is fine; it returns a populated
>   4-key map. It simply is not reached.
>
> **Consequence for this task:** the report panel would render blank with no error, and
> `<ApiErrorPanel>` *cannot* fire, because a 200 is not an error. That is precisely the
> "silent nothing" failure this plan exists to remove.
>
> **This task must therefore:**
>
> 1. Treat an empty or field-incomplete report as a **degraded state** with its own
>    visible message — not as success. Something like "The report service returned no
>    content" naming the endpoint, so a developer can act on it.
> 2. Not paper over it by falling back to `MOCK_REPORT`, which would reintroduce
>    fake-data-as-real.
>
> **Root-causing the FastAPI side is out of scope here** and should be its own task:
> either `/internal/report/generate` genuinely produces nothing for this payload, or it
> swallows an error and returns `{}`. Whichever it is, Spring should arguably also treat
> an empty upstream body as a failure and invoke its FR4.26 fallback — a one-line guard
> worth raising separately.


`CampaignAnalyticsView.tsx:62-63` fires both calls with no `.catch()`, so a failed report
leaves the panel blank forever with an unhandled rejection in the console.

**Files:**

- Modify: `components/module-4/4.1-campaign-analytics/CampaignAnalyticsView.tsx:55-65`
- Test: `components/module-4/4.1-campaign-analytics/CampaignAnalyticsView.test.tsx`

- [ ] **Step 1: Write the failing test**

Add to `CampaignAnalyticsView.test.tsx`:

```tsx
it('renders the error panel when the report call fails', async () => {
  vi.spyOn(apiClient.campaign, 'report').mockRejectedValue(
    new ApiError({
      status: 503, method: 'POST', path: '/api/v1/analytics/report',
      body: { code: 'DEPENDENCY_NOT_CONFIGURED', message: 'GROQ_API_KEY is not set' },
    }),
  );
  vi.spyOn(apiClient.campaign, 'history').mockResolvedValue([]);

  render(<CampaignAnalyticsView />);

  expect(await screen.findByText(/setup required/i)).toBeInTheDocument();
  expect(screen.getByText(/GROQ_API_KEY is not set/)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run components/module-4/4.1-campaign-analytics/CampaignAnalyticsView.test.tsx`

Expected: FAIL — no error text; the rejection is unhandled.

- [ ] **Step 3: Add error handling**

Replace the effect at `CampaignAnalyticsView.tsx:55-65`:

```tsx
const [error, setError] = useState<unknown | null>(null);

useEffect(() => {
  let cancelled = false;
  setError(null);

  apiClient.campaign
    .history()
    .then((h) => { if (!cancelled) setHistory(h as CampaignHistoryEntry[]); })
    .catch((e) => { if (!cancelled) setError(e); });

  // The report is a separate AI-backed call: it can fail while history succeeds,
  // so the two share one error surface but not one request.
  apiClient.campaign
    .report()
    .then((r) => { if (!cancelled) setReport(r as PrescriptiveReport); })
    .catch((e) => { if (!cancelled) setError(e); });

  return () => { cancelled = true; };
}, []);
```

Render the panel above the report section:

```tsx
{error && <ApiErrorPanel error={error} label="Campaign Analytics" />}
```

Import both:

```tsx
import { ApiErrorPanel } from '../../shared/ApiErrorPanel';
import type { CampaignHistoryEntry, PrescriptiveReport } from '../../../types';
```

Delete the stale comment block at lines 57–61 about `Promise<unknown>` looseness — the
client is typed now.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run components/module-4/4.1-campaign-analytics/CampaignAnalyticsView.test.tsx`

Expected: PASS.

- [ ] **Step 5: Verify against a live backend with no Groq key**

With `GROQ_API_KEY` unset in `backend/.env`, restart the stack and open Performance. The
report panel shows "Setup required — GROQ_API_KEY is not set", while the KPI cards and
trend charts still render from real campaign records.

- [ ] **Step 6: Commit**

```bash
git add frontend/components/module-4/4.1-campaign-analytics/CampaignAnalyticsView.tsx frontend/components/module-4/4.1-campaign-analytics/CampaignAnalyticsView.test.tsx
git commit -m "feat(frontend): wire campaign report to /api/v1/analytics/report with error surface"
```

---

## Task 16: `IngestionForm` → `POST /api/v1/analytics/manual`

**Depends on:** Task 13 (tenant scoping) merged.

`IngestionForm.tsx` seeds local state from `DEFAULT_CAMPAIGN_INPUT` and never submits, so
operator-entered numbers are discarded on reload.

**Files:**

- Modify: `components/module-4/4.1-campaign-analytics/IngestionForm.tsx:24-25`
- Test: `components/module-4/4.1-campaign-analytics/IngestionForm.test.tsx` (create)

- [ ] **Step 1: Write the failing test**

Create `IngestionForm.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../../services/apiClient';
import { ApiError } from '../../../services/apiError';
import { IngestionForm } from './IngestionForm';

describe('IngestionForm', () => {
  it('submits entered values to the backend', async () => {
    const ingest = vi.spyOn(apiClient.campaign, 'ingest').mockResolvedValue({ ok: true });
    render(<IngestionForm onComputed={() => {}} />);

    await userEvent.clear(screen.getByLabelText(/impressions/i));
    await userEvent.type(screen.getByLabelText(/impressions/i), '120000');
    await userEvent.click(screen.getByRole('button', { name: /compute|submit|analyze/i }));

    await waitFor(() => expect(ingest).toHaveBeenCalledWith(
      expect.objectContaining({ impressions: 120000 }),
    ));
  });

  it('surfaces a submit failure instead of failing silently', async () => {
    vi.spyOn(apiClient.campaign, 'ingest').mockRejectedValue(
      new ApiError({ status: 409, method: 'POST', path: '/api/v1/analytics/manual',
        body: { code: 'MOD22_PROFILE_NOT_READY', message: 'no business profile yet' } }),
    );
    render(<IngestionForm onComputed={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: /compute|submit|analyze/i }));
    expect(await screen.findByText(/complete onboarding/i)).toBeInTheDocument();
  });
});
```

Match the button's real accessible name — check it with:

```bash
grep -n "button" components/module-4/4.1-campaign-analytics/IngestionForm.tsx
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run components/module-4/4.1-campaign-analytics/IngestionForm.test.tsx`

Expected: FAIL — `apiClient.campaign.ingest` is never called.

- [ ] **Step 3: Wire the submit**

In `IngestionForm.tsx`, keep `DEFAULT_CAMPAIGN_INPUT` as the form's initial values (it is a
sensible starting form state, not fake data being displayed as real), and add:

```tsx
const [submitting, setSubmitting] = useState(false);
const [error, setError] = useState<unknown | null>(null);

async function handleSubmit(e: React.FormEvent) {
  e.preventDefault();
  setSubmitting(true);
  setError(null);
  try {
    const result = await apiClient.campaign.ingest(values);
    onComputed(result);
  } catch (err) {
    setError(err);
  } finally {
    setSubmitting(false);
  }
}
```

Render the panel and disable the button while in flight:

```tsx
{error && <ApiErrorPanel error={error} label="Data ingestion" />}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run components/module-4/4.1-campaign-analytics/IngestionForm.test.tsx`

Expected: PASS, 2 tests.

- [ ] **Step 5: Verify persistence end-to-end**

Submit the form in the browser, then reload. The new record appears in the history trend
chart, because `/analytics/manual` persists to `tbl_campaign_records`.

- [ ] **Step 6: Commit**

```bash
git add frontend/components/module-4/4.1-campaign-analytics/IngestionForm.tsx frontend/components/module-4/4.1-campaign-analytics/IngestionForm.test.tsx
git commit -m "feat(frontend): submit IngestionForm to /api/v1/analytics/manual"
```

---

## Task 17: `PesGauge` → `GET /api/v1/analytics/pes/{campaignId}`

**Files:**

- Modify: `components/module-4/4.1-campaign-analytics/PesGauge.tsx`
- Modify: `tests/contract/module4.contract.test.ts`

- [ ] **Step 1: Add the contract case**

Append to the `describeIfBackend` block in `tests/contract/module4.contract.test.ts`:

```ts
  it('GET /api/v1/analytics/pes/{campaignId} returns a scored breakdown', async () => {
    const hist = await (await api('/api/v1/analytics/history?weeks=4')).json();
    const rows = hist.snapshots ?? [];
    if (rows.length === 0) return; // no seeded campaign for this operator

    const id = rows[0].campaignId ?? rows[0].id;
    if (!id) return; // history doesn't expose an id — PES is read via /manual's response

    const res = await api(`/api/v1/analytics/pes/${id}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      overallScore: expect.any(Number),
      label: expect.any(String),
    });
  });
```

- [ ] **Step 2: Run it**

Run: `npm run test:contract`

Expected: PASS, or an early `return` if the history rows carry no id. If it returns early,
`PesGauge` should read the PES value from the `/analytics/manual` response — which already
includes it, per `ManualIngestResponse`'s javadoc — rather than making a second call. Note
which path applies before Step 3.

- [ ] **Step 3: Wire the gauge**

If history exposes a campaign id, fetch on mount:

```tsx
useEffect(() => {
  if (!campaignId) return;
  let cancelled = false;
  apiClient.campaign
    .pes(campaignId)
    .then((p) => { if (!cancelled) setPes(p as { overallScore: number; label: string }); })
    .catch((e) => { if (!cancelled) setError(e); });
  return () => { cancelled = true; };
}, [campaignId]);
```

Otherwise accept the score as a prop from the `/analytics/manual` response and delete
`apiClient.campaign.pes` — an unused client method is worse than none.

- [ ] **Step 4: Run all checks**

```bash
cd frontend && npm test && npm run test:contract
```

Expected: both PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/components/module-4/4.1-campaign-analytics frontend/tests/contract/module4.contract.test.ts
git commit -m "feat(frontend): wire PesGauge to real PES data"
```

---

## Slice 2 Definition of Done

- [ ] Two different seeded operators receive different `/analytics/metrics` responses
- [ ] KPI cards, PES gauge, and trend charts render real values from `tbl_campaign_records`
- [ ] Submitting the ingestion form persists — the new point appears after a reload
- [ ] With `GROQ_API_KEY` unset, the report panel says "Setup required" and names the
      variable, while the rest of the board still renders
- [ ] `npm test`, `npm run test:contract`, and `./mvnw test` all pass
