# Screen — Performance

**Route:** `/performance` · **Module:** 4 (Campaign Analytics & Reporting) · **Access:** authenticated.

**Prototype reference:** [`ui-ux-prototype.html:3757–4103`](../../../ui-ux-prototype.html#L3757)
(`computeMetrics`, `computePes`, `submitCampaign`, `renderPerformance`, `openPostAnalytics`).

**Component:** `components/module-4/4.1-campaign-analytics/CampaignAnalyticsView.tsx` (existing,
re-skinned + extended, not replaced).

## Layout

Two states: an ingestion form (no campaign submitted yet) or the full analytics view.

## Entry state — ingestion form

Seven numeric fields (impressions, clicks, ad spend ₱, revenue ₱, conversions, bookings, new
customers), each with an inline hint describing what it counts. Submitting computes all downstream
metrics client-of-formula (locally derived, not round-tripped through an LLM) and swaps to the full
view. A "New submission" ghost button in the full view clears the campaign and returns here.

## Full view

- **5 KPI cards** — CTR, CPC (inverse-good), ROAS, Conversion Rate, CAC (inverse-good) — each with a
  trend arrow against a fixed benchmark and a one-line description.
- **Flagged-metric banner** (new to this doc; carried from the prototype) — appears when any metric's
  denominator was zero (e.g. `adSpend = 0` blocks CPC/ROAS/CAC). Names exactly which metric(s)
  couldn't be computed and states that their weights were redistributed proportionally so PES still
  spans 0–1.
- **Promotional Effectiveness Score (PES)** — radial gauge (0.00–1.00), qualitative label (Poor <0.40
  / Fair <0.60 / Good <0.80 / Excellent ≥0.80), a contribution-breakdown bar per weighted component,
  and the formula shown verbatim:
  `PES = ROAS×0.35 + CR×0.30 + CAC⁻¹×0.15 + CTR×0.15 + CPC⁻¹×0.05` (min-max normalized against Cebu
  MSME bounds before weighting — see [`MODULE4_SYSTEM_DOCUMENTATION.md`](../MODULE4_SYSTEM_DOCUMENTATION.md)
  for the exact normalization bounds).
- **PES trend** — 4/8-week toggle, line chart with the label-threshold dashed reference lines.
- **Customer journey funnel** — Impressions → Clicks → Conversions → Bookings, drop-off % per
  transition.
- **Efficiency/cost trend charts** — small multi-line charts (ROAS/CTR/CR; CPC/CAC) over the same
  4/8-week window as the PES trend.
- **AI action plan** — executive summary card, then the three funnel transitions ranked by business
  impact (Weakest/Moderate/Alright — **not** by raw drop-size), each paired with a recommendation card
  carrying an urgency chip (Most Urgent/Urgent/Not Very Urgent) and a concrete action.
- **Link-attributed evidence** (new) — A panel showing creative-level performance for tracked campaign links. Includes a link selector (filtered by campaign/window scope) and an evidence table breaking down clicks, conversions (which include zero-revenue enquiries), and revenue by tracked creative ID. Un-tagged traffic is grouped into an "Organic / untagged" bucket. Has distinct evidence labels and does not infer missing inventory (unseen IDs are not listed).
- **Previously published** (new) — All/TikTok/Instagram/Facebook filter tabs over published posts.
  Each row is clickable and opens a `PostAnalyticsModal`.

## Link Attribution Evidence

The link attribution panel appears both in the entry state (above the ingestion form) and in the full view. It uses a standalone link selector scoped to the campaign window. 
Note that counts are a floor and not a census. Conversions include zero-revenue enquiries as well as matched bookings.
The panel is designed to live alongside code-redemption and statistical lift panels, which are implemented via standalone picker integration (`ClickMatchStep`) but are not fully wired up to parent booking actions yet.

## `PostAnalyticsModal` (new component)

Reach, likes, comments, shares, engagement rate as a stat grid, plus a 7-day reach-accumulation line
chart. Posts with zero reach (not yet reported back by the platform) show a "No data yet" empty state
instead of an empty chart.

## API calls

| Call | When | Endpoint |
|---|---|---|
| `apiClient` manual ingest | form submit | `POST /api/analytics/manual` |
| `apiClient` PES | full view load | `GET /api/analytics/pes/{campaignId}` |
| `apiClient` report | full view load | `POST /api/analytics/report` |
| list published posts | full view load | see [`backend/PublishingController.md`](../../module-3/backend/PublishingController.md) |
| post metrics | modal open | see [`backend/post-metrics.md`](../backend/post-metrics.md) — **specified, not yet implemented** |

## Backend requirement

Per-post metrics (reach/likes/comments/shares/7-day series) do not exist as an endpoint today. See
[`backend/post-metrics.md`](../backend/post-metrics.md).
