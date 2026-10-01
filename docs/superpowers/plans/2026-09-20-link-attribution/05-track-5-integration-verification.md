# Track 5 Integration Verification

Record for [Track 5](04-track-5-performance-rollup.md), executed against
[the implementation plan](../2026-09-21-track-5-performance-rollup-implementation.md).
Last updated 2026-09-22.

## Status by task

| Task | Status | Notes |
|---|---|---|
| 1 — Baseline | Done | See "Test results" below. |
| 2 — Rollup service + tests | Done | Canonical matrix and all named edge cases pass. |
| 3 — Creatives endpoint | Done | `LinkPerformanceController`; Track 3's `AttributionLinkController` does not exist yet. Move the route there if it lands. |
| 4 — Fixtures + hooks | Done | |
| 5 — Per-creative table | Done | Restyled on 2026-09-22 to the design tokens (`card`, `heading-sm`, `body-sm`, brand colours) and given a table caption. |
| 6 — Evidence layout | Done, integration gate open | Code-redemption and lift panels do not exist; their columns show "not available in this build". |
| 7 — Click-match step | Done, integration gate open | Standalone `ClickMatchStep`; no parent to mount it in. |
| 8 — Module 4 docs | Done, gates open | README feature section and Screens row added 2026-09-22. Open items below. |
| 9 — Playwright journey | **Blocked** | Needs Tracks 2, 3 and 4. |
| 10 — Manual checks | **Not done** | Fixture and real-backend walkthroughs and the decision test still need a person. |

Track 5 is **not complete** until the open gates below close.

## Open integration gates

| Gate | Owner | What closes it |
|---|---|---|
| `GET /api/attribution/links` (list) and `GET /api/attribution/clicks/unconverted` | Track 3 | Endpoints exist. Until then, in real (non-fixture) mode the Performance panel shows an API error, not empty data. That is intended. |
| `LINK_ATTRIBUTION_SETUP.md` | Track 3 | File exists. The link in `docs/module-4/README.md` is broken until then. |
| Content Studio ad URL documentation (`linkUrl` / `metaAdUrl` / `tiktokAdUrl`) | Track 3 | `docs/module-3/screens/content-studio.md` documents the three strings. |
| Redirect, enquiry endpoint, hosted enquiry page | Tracks 2 and 4 | Routes exist; then add the public enquiry row to the Module 4 Screens table using the real route, and write `e2e/tests/link-attribution.spec.ts` (Task 9). |
| Code-redemption and statistical-lift panels | Promo-code spec | Pass them into `AttributionEvidenceSection` as `codeEvidence` / `liftEvidence`. |
| `LogBookingAction` + redemption write API | Promo-code spec | Mount `ClickMatchStep`; send its value as `clickId`; verify server-side click ownership and `source='LINK'`. |

## Documentation conflicts for other owners

- `RUNNING.md` §6 says every screen and API needs a JWT. Track 4's public redirect and enquiry
  routes will contradict that. Owner: Track 4. Not edited here (Track 5 does not own `RUNNING.md`).
- The four-document consistency pass cannot finish while two of the four documents
  (`LINK_ATTRIBUTION_SETUP.md`, the Content Studio ad URL section) do not exist. Re-run it when they land.

## Test results (2026-09-22)

Machine note: the plan's `JAVA_HOME` (`jdk-21.0.11.10-hotspot`) is not installed on this machine.
Tests ran with `C:\Program Files\Java\jdk-23`.

**Backend, focused** — `LinkAttributionQueryServiceTest`, `LinkAttributionQueryServiceBulkTest`,
`LinkPerformanceControllerTest`, `AttributionMintTest`: 28 run, 0 failures.

**Backend, full** — `mvnw -o test`: 375 run, 8 failures, 4 errors. All 12 are the known ones in
`ReferenceProfileIsolationTest`, `MacroInputProvenanceTest`,
`MarketDataIngestionJobForecastTriggerTest`, `DemandAlertRulesTest`, `EconomyInsightForexTest`,
`EnsureFreshForecastTest`. No new failures.

**Frontend** — `npm test` with `VITE_USE_FIXTURES=false`: 85 files, 576 tests, all pass.
`npx tsc --noEmit`: only the 2 known errors (`DemandForecastChart.tsx`, `CalendarView.tsx`).
`npm run build` succeeds.

Two things that look like failures but are not caused by this track:

- A local `frontend/.env` with `VITE_USE_FIXTURES=true` makes 17 API/auth tests fail, because
  the client never calls `fetch`. Run the suite with fixtures off.
- `IngestionForm.test.tsx` can hit its 5s timeout when the machine is busy (for example, with the
  backend suite running at the same time). It passes when run alone.

### Live check against local Postgres (2026-09-22)

Seeded with [`e2e/fixtures/link-attribution-postgres.sql`](../../../../e2e/fixtures/link-attribution-postgres.sql)
and called the real endpoint with a real JWT:

- `t5-split` returned exactly 8 / 4 / 1750.50, in the order ad-A, ad-B, untagged, ad-C. The NULL and
  blank ad IDs merged into one untagged row. The out-of-window ₱999 and the MANUAL ₱300 were excluded,
  and the ₱0 enquiry still counted as a conversion.
- `t5-untagged` returned one untagged row; `t5-empty` returned 0 / 0 / 0 with no rows.
- After flipping one converted click to `in_window = FALSE`, the result was 7 / 3 / 750.50: the click
  and its conversion dropped out together.
- Another tenant's link returned 404; no token returned 401.
- The Performance screen, in real mode with only the missing Track 3 list call stubbed in the
  browser, rendered the table, the untagged-only prompt and the empty state correctly at 1440, 1280
  and 390 px. The page never scrolled sideways.

### Local-environment bugs found (not Track 5 code; owners need to fix)

- **H2 console unreachable.** `SecurityConfig` does not exempt `/h2`, so it answers 401. This
  contradicts `RUNNING.md` §3 and the Track 5 spec's manual steps.
- **H2 profile returns 500 for every JWT request that resolves the business profile.** Postgres
  `V26__module1_reference_corpus.sql` added `tbl_business_profile.is_reference`, but `db/h2` has no
  mirror. The tests don't catch it because they build the schema from the entities. Owner: Module 1.
  The H2 seed script (`e2e/fixtures/h2-seed/`) adds the column locally as a workaround.

### Fixed on 2026-09-22

- Performance layout: the link panel took a third of the row, so the Revenue column was clipped
  and creative names broke mid-word. The panel now takes twice the width of each companion panel,
  and cells no longer wrap numbers.
- `attributionLinks.test.ts` passed without asserting anything when fixtures were on. It now always
  asserts, like the other `apiClient` tests.
- The panel's error cards now say which request failed (`label` on `ApiErrorPanel`).

- `useLinkPerformance.test.tsx`: `beforeEach(() => performance.mockReset())` returned the mock, so
  Vitest ran it as a teardown. It then waited on a promise that never resolved, and the "ignores
  completion after unmount" test timed out every time.
- `ClickMatchStep.test.tsx`: the test clicked "None of these" without re-rendering the controlled
  component with the chosen value, so no change event fired.
- `ClickMatchStep`: the radio group name was hard-coded (two pickers on a page would share one
  group), and the "clear a vanished selection" check read a stale `value`.
