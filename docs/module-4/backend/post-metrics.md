# Post-level metrics (specified, not yet implemented)

Backs [`screens/performance.md`](../screens/performance.md)'s "Previously published" list and
[`screens/_components/post-analytics-modal.md`](../screens/_components/post-analytics-modal.md).

## Endpoints (proposed)

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/v1/analytics/posts?operatorId=UUID&platform=` | List published posts with summary metrics, optionally filtered by platform |
| `GET` | `/api/v1/analytics/posts/{postId}` | Full detail for one post: reach, likes, comments, shares, engagement rate, 7-day reach-accumulation series |

## Entity (proposed) — `PostMetric` / `tbl_post_metric`

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` PK | |
| `post_id` | `UUID` FK → `tbl_social_post` (see [`docs/module-3/backend/PublishingController.md`](../../module-3/backend/PublishingController.md)) | |
| `reach` | `INTEGER` | |
| `likes` | `INTEGER` | |
| `comments` | `INTEGER` | |
| `shares` | `INTEGER` | |
| `engagement_rate` | `NUMERIC` | percentage |
| `reach_series_json` | `TEXT` (JSON array) | 7 values, one per day since publish |
| `last_synced_at` | `TIMESTAMP` | when this row was last refreshed from the platform's insights API |

## Sourcing

Populated by a per-platform insights poll (Instagram Graph Insights, TikTok Analytics API, Facebook
Page Insights, Naver Blog stats) — a scheduled job analogous to Module 2's
`TrendFetchSchedulerService`, running against `tbl_platform_connection` tokens
(see [`docs/module-3/backend/PlatformConnectionController.md`](../../module-3/backend/PlatformConnectionController.md)).
Design of that scheduler is out of scope for this doc; flag as its own backend plan when this ships.

## Fixture stand-in

Until implemented, `apiClient` returns the fixture-backed post metrics described in the
[Fixture Data Layer card](../../superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/01-foundation.md#card--foundation-fixture-data-layer) —
each fixture post carries a `series[]` (7 values) and summary stats, matching the prototype's
`MOCK_POSTS`.
