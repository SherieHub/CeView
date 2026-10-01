# `PublishingController` (specified, not yet implemented)

**Package (proposed):** `com.ceview.module3.publishing` · **File (proposed):**
`backend/spring-boot/src/main/java/com/ceview/module3/publishing/PublishingController.java`

## Responsibility

Persist and serve social posts — drafts, scheduled, and published — the record that
[Content Studio](../screens/content-studio.md)'s Publish button writes to, and that
[Calendar](../screens/calendar.md) and
[Performance](../../module-4/screens/performance.md)'s "Previously published" section read from.

## Endpoints (proposed)

| Method | Path | Purpose | Called by |
|---|---|---|---|
| `GET` | `/api/posts?operatorId=UUID&from=&to=` | List posts in a date range | Calendar |
| `GET` | `/api/posts?operatorId=UUID&status=` | List by status (draft/scheduled/published) | Content Studio's content board |
| `POST` | `/api/posts/publish` | Publish approved captions to N selected, connected platforms | Content Studio's Publish button |

`POST /publish` request: `{ platforms: string[], captionsByPlatform: {[platform]: string}, mediaRef: string, toggles: {visibility, comments, paid} }`.
One `SocialPost` row is created per platform in the request. Each platform's own approved caption is
used — this is a deliberate correction to v1's prototype behavior, which stages one shared caption
and republishes it verbatim to every selected platform even though the AI already generates
per-platform copy; the real endpoint should accept (and the frontend should send) per-platform
caption text, not one shared string, so a future switch to true per-platform composing doesn't
require an API change.

Actual delivery to each platform's API (Instagram Graph API, TikTok Content Posting API, Facebook
Graph API, Naver Blog API) is a separate integration concern per platform and is out of scope for
this doc — flag as its own backend plan when this controller is built.

## Entity (proposed) — `SocialPost` / `tbl_social_post`

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` PK | |
| `operator_id` | `UUID` FK | |
| `platform` | `TEXT` | one of the four platform keys |
| `caption` | `TEXT` | |
| `media_ref` | `TEXT` | object-storage reference to the pubmat |
| `status` | `TEXT` | `draft` \| `scheduled` \| `published` |
| `scheduled_for` | `TIMESTAMP`, nullable | |
| `published_at` | `TIMESTAMP`, nullable | |
| `market_id` | `TEXT`, nullable | which Module 2 market this post targeted, for reporting |
| `created_at` | `TIMESTAMP` | |

## Frontend contract

`SocialPost` maps directly to the frontend's post type consumed by Content Studio's board, Calendar's
grid/list, and Performance's published-post list — one shape, three readers.

## Fixture stand-in

Until implemented, `apiClient` reads/writes the fixture-backed post list described in the
[Fixture Data Layer card](../../superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/01-foundation.md#card--foundation-fixture-data-layer).
