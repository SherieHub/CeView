# Post-level metrics (implemented)

`com.ceview.module4.postmetrics` implements V51 `tbl_post_metric`, daily refresh and the authenticated `/api/analytics/posts` list/detail routes. Both routes use JWT profile ownership and the common post view. The daily job defaults to 03:00 UTC and reads Facebook/Instagram insights; TikTok inbox status must expose public post IDs before Display API metrics can be read. Views are never substituted for unique reach. Individual metrics and engagement rate remain null when unavailable. The first seven UTC days since publication form the reach series; missing days are null and repeated same-day sync replaces that day's sample. API details: [contract](../../../backend/CONTRACT.md#social-publishing-endpoints).

The earlier proposal below is historical; the implementation uses the publishing-account grants and actual post lifecycle from the October social-publishing design.

Paid Meta ads read ad-level reach through the accepted ad account's user grant. Organic interaction counts and engagement rate remain unavailable for that metric source. Creating a PAUSED ad does not establish a publication timestamp or reach history. Performance includes such an ad only after the platform reports positive reach; launching and pausing remain actions in Ads Manager.

> **Still unimplemented.** The ad-connection work of September 2026 delivered
> account-level *ad* metrics (`tbl_ad_insight`), not per-post organic insights.
> Per-post metrics need a publishing connection with `pages_read_engagement` /
> `instagram_manage_insights` — a different grant from the `ads_read` scope that
> feature uses.

Backs [`screens/performance.md`](../screens/performance.md)'s "Previously published" list and
[`screens/_components/post-analytics-modal.md`](../screens/_components/post-analytics-modal.md).

## Endpoints (proposed)

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/analytics/posts?operatorId=UUID&platform=` | List published posts with summary metrics, optionally filtered by platform |
| `GET` | `/api/analytics/posts/{postId}` | Full detail for one post: reach, likes, comments, shares, engagement rate, 7-day reach-accumulation series |

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
