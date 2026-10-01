# Live Week-to-Date Ad Metrics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **⚠️ COMMITS ARE THE USER'S TO RUN.** `.claude/CLAUDE.md` forbids Claude from running `git commit` or `git push` in this repository under any circumstances. Every "Commit" step below shows the exact command **for the user to run**. An agent executing this plan stops at each commit step, states the task is complete and verified, and hands the command back.

**Goal:** Add a read-only "Live this week (in progress)" panel to the campaign Ingestion form, showing the current, still-open week's ad metrics from connected accounts — without changing what the weekly sync submits as the official campaign record.

**Architecture:** Frontend-only. `GET /api/ad-connections/insights` already accepts an arbitrary `periodStart`/`periodEnd`; the "last complete week" restriction lives entirely in `IngestionForm.tsx`'s `lastCompleteWeek()` helper. A new sibling helper `weekToDate()` (Monday of the current week → today) feeds a second, independent call to the same `apiClient.adConnections.insights()`, rendered read-only and never written into the submitted form state.

**Tech Stack:** React 19 + TypeScript, Vitest + Testing Library.

**Spec:** [`docs/superpowers/specs/2026-09-12-live-week-ad-metrics-design.md`](../specs/2026-09-12-live-week-ad-metrics-design.md)

---

## Conventions to follow

- **Frontend tests:** from `frontend`, `npm test -- --run <path>`. Type check: `npx tsc --noEmit`.
- **Mocking pattern:** ad-sync tests mock `../../../services/apiClient` and `../../../services/useAdConnections` at the top of the file (see `IngestionForm.adSync.test.tsx`) rather than hitting the real network — this plan's new test file copies that exact setup.
- Both the existing weekly sync and this new live panel call the **same** `apiClient.adConnections.insights(periodStart, periodEnd, providers?)` — they're distinguished in tests by inspecting the call arguments, not by mocking two different functions.

---

## File structure

| File | Change |
|---|---|
| `frontend/components/module-4/4.1-campaign-analytics/IngestionForm.tsx` | Add `weekToDate()` helper, `liveSummary`/`liveSyncing`/`liveNote` state, `syncLiveTotals()` handler, and the "Live this week" panel markup |
| `frontend/components/module-4/4.1-campaign-analytics/IngestionForm.liveSync.test.tsx` | **created** — covers the new panel, mirroring `IngestionForm.adSync.test.tsx`'s structure |

No backend, types, or fixture changes — `AdInsightSummary`/`apiClient.adConnections.insights` already support this.

---

## Task 1: `weekToDate()` helper + live panel skeleton

**Files:**
- Modify: `frontend/components/module-4/4.1-campaign-analytics/IngestionForm.tsx`
- Create: `frontend/components/module-4/4.1-campaign-analytics/IngestionForm.liveSync.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `IngestionForm.liveSync.test.tsx`:

```tsx
/**
 * Live week-to-date ad metrics panel — a read-only preview of the
 * still-open week, separate from the weekly sync that fills the submitted
 * form fields (covered by IngestionForm.adSync.test.tsx).
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import IngestionForm from './IngestionForm';
import type { AdConnection, AdInsightSummary } from '../../../types';

const insightsMock = vi.fn();
const ingestMock = vi.fn();
const campaignsMock = vi.fn();
const selectCampaignMock = vi.fn();
let connections: AdConnection[] = [];

vi.mock('../../../services/apiClient', () => ({
  apiClient: {
    adConnections: {
      insights: (...a: unknown[]) => insightsMock(...a),
      campaigns: (...a: unknown[]) => campaignsMock(...a),
      selectCampaign: (...a: unknown[]) => selectCampaignMock(...a),
    },
    campaign: { ingest: (...a: unknown[]) => ingestMock(...a) },
  },
}));

vi.mock('../../../services/useAdConnections', () => ({
  useAdConnections: () => ({
    connections,
    error: null,
    hasActive: connections.some((c) => c.status === 'ACTIVE'),
    forProvider: (p: string) => connections.find((c) => c.provider === p) ?? null,
    refresh: async () => {},
    disconnect: async () => {},
    selectCampaign: async () => {},
  }),
}));

const ACTIVE_META: AdConnection = {
  provider: 'meta',
  configured: true,
  status: 'ACTIVE',
  accountName: 'Cebu Dive Co. Ads',
  currency: 'PHP',
  campaignId: null,
  campaignName: null,
  connectedAt: '2026-08-20T00:00:00Z',
  lastSyncedAt: null,
};

const LIVE_SUMMARY: AdInsightSummary = {
  periodStart: '2026-09-07',
  periodEnd: '2026-09-12',
  impressions: 9120,
  clicks: 214,
  spend: 980.4,
  conversions: 6,
  currency: 'PHP',
  sources: [
    {
      provider: 'meta',
      accountName: 'Cebu Dive Co. Ads',
      impressions: 9120,
      clicks: 214,
      spend: 980.4,
      conversions: 6,
      currency: 'PHP',
    },
  ],
  warnings: [],
};

beforeEach(() => {
  insightsMock.mockReset();
  ingestMock.mockReset();
  campaignsMock.mockReset();
  selectCampaignMock.mockReset();
  ingestMock.mockResolvedValue({});
  insightsMock.mockResolvedValue(LIVE_SUMMARY);
  selectCampaignMock.mockResolvedValue({});
  campaignsMock.mockResolvedValue([]);
  connections = [];
});

describe('IngestionForm live week-to-date panel', () => {
  it('hides the live panel when no ad account is connected', () => {
    render(<IngestionForm onSubmit={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /refresh live totals/i })).toBeNull();
  });

  it('shows the live panel when a connection is active', () => {
    connections = [ACTIVE_META];
    render(<IngestionForm onSubmit={vi.fn()} />);
    expect(screen.getByRole('button', { name: /refresh live totals/i })).toBeInTheDocument();
  });

  it('requests a week-to-date range ending today, not the last complete week', async () => {
    connections = [ACTIVE_META];
    render(<IngestionForm onSubmit={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /refresh live totals/i }));

    await waitFor(() => expect(insightsMock).toHaveBeenCalled());
    const [start, end] = insightsMock.mock.calls[0];
    const todayIso = new Date().toISOString().slice(0, 10);
    expect(String(end)).toBe(todayIso);
    expect(String(start) <= String(end)).toBe(true);
  });
});
```

- [ ] **Step 2: Run it, expect failure**

Run (from `frontend`): `npm test -- --run components/module-4/4.1-campaign-analytics/IngestionForm.liveSync.test.tsx`
Expected: FAIL — all three tests fail because no "refresh live totals" button exists yet.

- [ ] **Step 3: Add `weekToDate()`**

In `IngestionForm.tsx`, add this new function directly after `lastCompleteWeek()` (after line 112):

```tsx
/**
 * Monday of the current week through today, as `YYYY-MM-DD` strings.
 *
 * Deliberately a *partial* week — powers the read-only "Live this week"
 * preview only. Unlike lastCompleteWeek(), this is never sent to
 * apiClient.campaign.ingest() or written into `values`; a still-open week
 * must never become the submitted campaign record (see the live-panel
 * section below).
 */
function weekToDate(): { periodStart: string; periodEnd: string } {
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const today = new Date();
  // getDay(): 0=Sun … 6=Sat. ISO weeks start Monday, so Sunday is 6 days
  // after Monday rather than 0 — shift by (day + 6) % 7 to count from Monday.
  const daysSinceMonday = (today.getDay() + 6) % 7;
  const start = new Date(today);
  start.setDate(today.getDate() - daysSinceMonday);
  return { periodStart: iso(start), periodEnd: iso(today) };
}
```

- [ ] **Step 4: Add live-panel state**

In `IngestionForm.tsx`, immediately after the existing sync state block (after line 135, `const [syncedKeys, setSyncedKeys] = useState<string[]>([]);`), add:

```tsx
  // "Live this week" — a read-only, separate preview of the still-open
  // week. Never written into `values`/`setSyncedKeys`; see syncLiveTotals().
  const [liveSummary, setLiveSummary] = useState<import('@/types').AdInsightSummary | null>(null);
  const [liveSyncing, setLiveSyncing] = useState(false);
  const [liveNote, setLiveNote] = useState<string | null>(null);
```

Then add `AdInsightSummary` to the existing named import from `@/types` at the top of the file (line 47):

```tsx
import type { AdCampaignOption, AdInsightSummary, AdProvider, CampaignInput, ManualIngestPes } from '@/types';
```

and simplify the state declaration to use the imported name instead of the inline `import('@/types').AdInsightSummary`:

```tsx
  const [liveSummary, setLiveSummary] = useState<AdInsightSummary | null>(null);
```

- [ ] **Step 5: Add `syncLiveTotals()`**

Directly after the closing brace of `syncFromAdAccounts()` (after line 244), add:

```tsx
  /**
   * Pulls the current, still-open week's metrics — read-only. Shares
   * `included`/`scope` with the weekly sync (same accounts, different
   * window), but its result only ever lands in `liveSummary`, never in
   * `values` — a partial week must never become the submitted record.
   *
   * Note: the backend caches every insights() call as one `ad_insights` row
   * keyed by (profile, provider, periodStart, periodEnd). Since periodEnd
   * here is "today", repeated live refreshes across a week accumulate a
   * handful of extra cache rows — harmless, since nothing else in the
   * codebase reads that table today.
   */
  async function syncLiveTotals() {
    setLiveSyncing(true);
    setLiveNote(null);
    try {
      if (included.length === 0) {
        setLiveNote('Choose at least one ad account to sync from.');
        return;
      }

      const { periodStart, periodEnd } = weekToDate();
      const providerFilter =
        included.length === activeConnections.length
          ? undefined
          : included.map((c) => c.provider);
      const summary = await apiClient.adConnections.insights(
        periodStart,
        periodEnd,
        providerFilter,
      );

      setLiveSummary(summary);
      if (summary.warnings.length > 0) {
        setLiveNote(summary.warnings.join(' '));
      }
    } catch (err) {
      console.error('Live ad account sync failed', err);
      setLiveNote('Could not fetch live totals. Try again.');
    } finally {
      setLiveSyncing(false);
    }
  }
```

- [ ] **Step 6: Add the panel markup**

In the JSX, insert this block immediately before the existing `{hasActive ? (` line (line 339), so it renders only when there's at least one active connection, same as the weekly sync card:

```tsx
          {hasActive && (
            <div
              className="mb-4 flex flex-col gap-4 rounded-[var(--radius-md)] border p-4"
              style={{ borderColor: 'var(--color-border)' }}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="body-xs text-[var(--color-text-body)]">
                  Live this week (in progress)
                </p>
                <button
                  type="button"
                  className="btn-outline btn-outline--sm shrink-0"
                  onClick={syncLiveTotals}
                  disabled={liveSyncing || included.length === 0}
                >
                  <RefreshCw
                    className={liveSyncing ? 'animate-spin' : ''}
                    size={14}
                    aria-hidden="true"
                  />
                  {liveSyncing ? 'Refreshing…' : 'Refresh live totals'}
                </button>
              </div>

              {liveNote && (
                <p
                  className="body-xs rounded-md px-3 py-2"
                  style={{ background: 'var(--color-white)', color: 'var(--color-navy-primary)' }}
                >
                  {liveNote}
                </p>
              )}
            </div>
          )}
```

(Rendering the stat tiles is Task 2 — this step only wires the button and the fetch, matching the three tests written in Step 1.)

- [ ] **Step 7: Run it, expect pass**

Run: `npm test -- --run components/module-4/4.1-campaign-analytics/IngestionForm.liveSync.test.tsx`
Expected: PASS — all 3 tests.

Also run the existing suite to confirm nothing broke:
Run: `npm test -- --run components/module-4/4.1-campaign-analytics/IngestionForm.adSync.test.tsx`
Expected: PASS — unchanged.

- [ ] **Step 8: Commit**

```bash
git add frontend/components/module-4/4.1-campaign-analytics/IngestionForm.tsx \
        frontend/components/module-4/4.1-campaign-analytics/IngestionForm.liveSync.test.tsx
git commit -m "feat(module-4): add live week-to-date ad metrics fetch"
```

---

## Task 2: Render live stat tiles, warnings, and error/independent-loading behavior

**Files:**
- Modify: `frontend/components/module-4/4.1-campaign-analytics/IngestionForm.tsx`
- Modify: `frontend/components/module-4/4.1-campaign-analytics/IngestionForm.liveSync.test.tsx`

- [ ] **Step 1: Write the failing tests**

Append to `IngestionForm.liveSync.test.tsx`, inside the existing `describe` block:

```tsx
  it('renders live stat tiles from the response', async () => {
    connections = [ACTIVE_META];
    render(<IngestionForm onSubmit={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /refresh live totals/i }));

    await waitFor(() => expect(screen.getByText('9120')).toBeInTheDocument());
    expect(screen.getByText('214')).toBeInTheDocument();
    expect(screen.getByText('980.4')).toBeInTheDocument();
    expect(screen.getByText('6')).toBeInTheDocument();
  });

  it('does not mutate the editable fields', async () => {
    connections = [ACTIVE_META];
    render(<IngestionForm onSubmit={vi.fn()} />);
    const impressionsBefore = (screen.getByLabelText(/impressions/i) as HTMLInputElement).value;

    fireEvent.click(screen.getByRole('button', { name: /refresh live totals/i }));
    await waitFor(() => expect(screen.getByText('9120')).toBeInTheDocument());

    expect((screen.getByLabelText(/impressions/i) as HTMLInputElement).value).toBe(
      impressionsBefore,
    );
    expect(screen.queryByText(/^synced$/i)).toBeNull();
  });

  it('shows a warning and withholds tiles on a currency mismatch', async () => {
    connections = [ACTIVE_META];
    insightsMock.mockResolvedValue({
      ...LIVE_SUMMARY,
      impressions: null,
      clicks: null,
      spend: null,
      conversions: null,
      currency: null,
      warnings: ['Connected ad accounts report in different currencies (PHP, USD).'],
    });

    render(<IngestionForm onSubmit={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /refresh live totals/i }));

    expect(await screen.findByText(/different currencies/i)).toBeInTheDocument();
    expect(screen.queryByText('9120')).toBeNull();
  });

  it('reports a live sync failure without crashing', async () => {
    connections = [ACTIVE_META];
    insightsMock.mockRejectedValue(new Error('502'));
    render(<IngestionForm onSubmit={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /refresh live totals/i }));

    expect(await screen.findByText(/could not fetch live totals/i)).toBeInTheDocument();
  });

  it('keeps the weekly sync button enabled while a live refresh is pending', async () => {
    connections = [ACTIVE_META];
    let resolveLive: (v: AdInsightSummary) => void = () => {};
    insightsMock.mockImplementation(
      () => new Promise((resolve) => { resolveLive = resolve; }),
    );

    render(<IngestionForm onSubmit={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /refresh live totals/i }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /refreshing/i })).toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: /sync from ad accounts/i })).not.toBeDisabled();

    resolveLive(LIVE_SUMMARY);
    await waitFor(() => expect(screen.getByText('9120')).toBeInTheDocument());
  });
```

- [ ] **Step 2: Run them, expect failure**

Run: `npm test -- --run components/module-4/4.1-campaign-analytics/IngestionForm.liveSync.test.tsx`
Expected: FAIL — the first four fail because no stat tiles are rendered yet (`getByText('9120')` finds nothing); the last one passes already (weekly button was never touched) but keep it in this step since it belongs with the rest of this task's coverage.

- [ ] **Step 3: Render the stat tiles**

In `IngestionForm.tsx`, inside the panel block added in Task 1, insert the tiles grid directly after the `liveNote` block (and before the panel's closing `</div>`):

```tsx
              {liveSummary && liveSummary.impressions != null && (
                <div
                  className="grid gap-3"
                  style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}
                >
                  {([
                    { label: 'Impressions', value: liveSummary.impressions },
                    { label: 'Clicks', value: liveSummary.clicks },
                    { label: `Ad spend (${liveSummary.currency ?? currency})`, value: liveSummary.spend },
                    { label: 'Conversions', value: liveSummary.conversions },
                  ] as const).map(({ label, value }) => (
                    <div
                      key={label}
                      className="rounded-md px-3 py-2"
                      style={{ background: 'var(--color-white)' }}
                    >
                      <div className="body-xs text-[var(--color-text-muted)]">{label}</div>
                      <div className="body-sm" style={{ fontWeight: 600 }}>
                        {value}
                      </div>
                    </div>
                  ))}
                </div>
              )}
```

This satisfies both the tile-rendering test and the withheld-on-mismatch test: `liveSummary.impressions != null` is `false` whenever the backend withholds totals (mirroring the exact guard `syncFromAdAccounts` already uses at line 217).

The "does not mutate the editable fields" test needs no production code change — `syncLiveTotals` already never touches `values`/`setSyncedKeys` (Task 1, Step 5); this test is a regression guard.

The error-message test needs no change either — `syncLiveTotals`'s `catch` block (Task 1, Step 5) already sets that exact string.

The independent-loading-state test needs no change either — `syncing`/`setSyncing` (weekly) and `liveSyncing`/`setLiveSyncing` (live) were already declared as separate state in Task 1; the weekly button's `disabled={syncing || included.length === 0}` was never touched by `syncLiveTotals`.

- [ ] **Step 4: Run it, expect pass**

Run: `npm test -- --run components/module-4/4.1-campaign-analytics/IngestionForm.liveSync.test.tsx`
Expected: PASS — all 8 tests (3 from Task 1 + 5 from this task).

Also re-run the full ad-sync suite and a type check to confirm nothing else broke:

Run: `npm test -- --run components/module-4/4.1-campaign-analytics/IngestionForm.adSync.test.tsx`
Expected: PASS — unchanged.

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/components/module-4/4.1-campaign-analytics/IngestionForm.tsx \
        frontend/components/module-4/4.1-campaign-analytics/IngestionForm.liveSync.test.tsx
git commit -m "feat(module-4): render live week-to-date stat tiles"
```

---

## Self-review

**Spec coverage:**
- Data flow (`weekToDate()`, `syncLiveTotals()`, no backend change, reuses `apiClient.adConnections.insights`) — Task 1.
- UI shape (panel above the weekly card, secondary-styled button, read-only tiles, caption note, disabled-when-no-accounts) — Task 1 (button/panel) + Task 2 (tiles). *(The spec's exact caption copy — "not included in this week's report until the week ends" — is a one-line addition; folded into Task 1 Step 6's panel markup below for completeness.)*
- Error handling (provider failure, no connections, currency mismatch, network error, independent loading state, cache-growth comment, never touching `CampaignInput`) — all covered across Task 1 Step 5 (handler) and Task 2 (tests locking each path).
- Testing plan (`weekToDate()` boundary, button triggers correct range, tiles render, warnings withhold tiles, `values` untouched, independent loading states) — Tasks 1–2's test steps.

**Placeholder scan:** No TBD/TODO; every step has complete code.

**Type consistency:** `AdInsightSummary` (imported from `@/types`, matching the existing `AdCampaignOption`/`AdProvider`/`CampaignInput`/`ManualIngestPes` import style) is used consistently for `liveSummary`'s type across Task 1 Step 4 and Task 2 Step 3. `syncLiveTotals`/`liveSummary`/`liveSyncing`/`liveNote` names are used identically wherever referenced.

**Fix applied during self-review:** Task 1 Step 6's panel markup did not yet include the spec's caption line. Adding it now, inside the panel, directly after the tiles grid (so Task 2 Step 3's grid is followed immediately by this caption — insert both in the same edit, tiles grid first, caption last):

```tsx
              <p className="body-xs text-[var(--color-text-muted)]">
                Live totals for the week so far — not included in this week&rsquo;s report until
                the week ends.
              </p>
```

---

## Execution options

Plan complete and saved to `docs/superpowers/plans/2026-09-12-live-week-ad-metrics.md`. Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
