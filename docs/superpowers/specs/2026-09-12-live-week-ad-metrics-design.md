# Live Week-to-Date Ad Metrics — Design

**Status:** Approved for planning
**Date:** 2026-09-12
**Module:** 4 — Campaign Analytics & Reporting

## Problem

`IngestionForm`'s "Sync from ad accounts" button only ever pulls the **last fully
completed Monday–Sunday week** (`lastCompleteWeek()` in
[IngestionForm.tsx](../../../frontend/components/module-4/4.1-campaign-analytics/IngestionForm.tsx#L101)).
This is deliberate: Module 4's weekly KPI/report math assumes a complete week,
so a partial week must never silently become "this week's official numbers."

But it means an operator with a campaign that started this week (e.g. a Meta ad
set ending today, per the reported case) sees all-zero synced fields, with no
explanation that the sync window is simply the *previous* week and their
campaign hasn't existed for one yet. There is currently no way to see how a
still-running campaign is doing right now.

## Goal

Add a read-only **"Live this week (in progress)"** view of the current,
still-open week's ad metrics, displayed alongside the existing weekly sync —
without changing what gets submitted as the week's official campaign record.

## Non-goals

- Changing what `lastCompleteWeek()` submits, or what a `CampaignInput` record
  represents. The weekly report continues to require a complete week.
- Auto-refreshing or polling. The live panel is refreshed on demand, same as
  the existing weekly sync.
- Any backend change. `GET /api/ad-connections/insights` already accepts an
  arbitrary `periodStart`/`periodEnd` (up to 366 days apart) — the "last
  complete week" restriction lives entirely in the frontend.

## Design

### Data flow

- New pure helper `weekToDate()` in `IngestionForm.tsx`, sibling to
  `lastCompleteWeek()`: `periodStart` = Monday of the current week,
  `periodEnd` = today (both local dates, same `iso()` formatting already
  used by `lastCompleteWeek()`).
- New handler `syncLiveTotals()`, structurally parallel to
  `syncFromAdAccounts()`, but:
  - Calls `apiClient.adConnections.insights(weekToDate().periodStart,
    weekToDate().periodEnd, providerFilter)` — same API client method and
    backend endpoint as the weekly sync, just a different date range.
  - Honors the same `included` (active, non-excluded connections) and
    `scope` (per-provider campaign selection) the weekly sync already
    computes, so both cards always describe the same accounts.
  - Stores the result in its own state (`liveSummary`, `liveSyncing`,
    `liveNote`) — **never** writes into `values`/`setValues`/`setSyncedKeys`,
    so a partial week can never leak into the submitted `CampaignInput`.
- No backend changes.

### UI

A new read-only card, **"Live this week (in progress)"**, placed directly
above the existing weekly "Pull last week's..." sync card in
`IngestionForm.tsx`:

- Header states the live period plainly, e.g. "Sep 7 – Sep 12, 2026 so far,"
  using the same `PROVIDER_LABELS`/currency formatting as the weekly card.
- A **"Refresh live totals"** button, styled as secondary/outline (vs. the
  weekly sync's primary button) to signal "informational," not "the thing
  that populates the form."
- Four read-only stat tiles (Impressions / Clicks / Ad spend / Conversions)
  reusing the existing tile markup, but never rendered as editable inputs.
- Caption under the tiles: "Live totals for the week so far — not included
  in this week's report until the week ends."
- Warnings render via the same pattern as `syncNote` (`liveNote`), directly
  under the button.
- Disabled with the existing "Choose at least one ad account to sync from"
  message when `included.length === 0`.

### Error handling & edge cases

- **Provider failure / no connections / currency mismatch**: identical
  handling to the weekly sync — `InsightsResponse.warnings` renders as
  `liveNote`; when `impressions == null` (withheld due to mismatch or total
  failure) tiles show a placeholder instead of stale numbers.
- **Network/API errors**: same `try/catch`/`finally` shape as
  `syncFromAdAccounts` — `console.error` plus a user-facing `liveNote`
  message; `liveSyncing` always reset in `finally`.
- **Independent loading state**: `liveSyncing` is separate from `syncing` —
  refreshing live totals doesn't disable the weekly sync button, and vice
  versa.
- **Cache growth**: each live refresh upserts one `ad_insights` row keyed by
  `(profile, provider, Monday, today)` via the existing
  `AdInsightSyncService.upsertInsight`. Since `periodEnd` advances daily, a
  week of repeated live refreshes can accumulate up to 7 rows per provider.
  This is harmless — no other code in the repo reads `AdInsight` rows today
  (confirmed by search) — but add a one-line comment at the live-panel call
  site noting this so a future reader doesn't mistake these rows for a real
  reporting-period record.
- **Not persisted into `CampaignInput`**: explicitly out of scope — the live
  panel never writes into `values`, so there is no risk of a partial week
  accidentally becoming "this week's official report."

### Testing

Extend `IngestionForm.test.tsx` or a new `IngestionForm.liveSync.test.tsx`
(mirroring the existing `IngestionForm.adSync.test.tsx` split), covering:

- `weekToDate()` boundary math (Monday start, today end).
- Clicking "Refresh live totals" calls `apiClient.adConnections.insights`
  with the computed week-to-date range and renders the four stat tiles from
  the mocked response.
- Warnings/currency-mismatch/no-connections paths render `liveNote` and
  withhold tiles, mirroring the existing weekly-sync tests.
- A live refresh does **not** mutate `values` (assert the editable inputs
  are untouched after a live refresh).
- The two loading states are independent (a pending live fetch leaves the
  weekly sync button enabled, and vice versa).

## Open questions

None — scope, placement, time window, and trigger behavior were confirmed
during brainstorming.
