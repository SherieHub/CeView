# Schema delta — Module 3 new surfaces

Two new tables are required for the UI/UX overhaul's Module 3 surfaces. Neither exists today. This is
a **specification**, not yet implemented.

## `tbl_platform_connection`

See [`PlatformConnectionController.md`](PlatformConnectionController.md) for the full column list.
Backs [Settings → Platforms](../screens/settings-platforms.md) and the publish-gating rule in
[Content Studio](../screens/content-studio.md).

## `tbl_social_post`

See [`PublishingController.md`](PublishingController.md) for the full column list. Backs
[Content Studio's publish action + content board](../screens/content-studio.md),
[Calendar](../screens/calendar.md), and
[Performance's published-post list](../../module-4/screens/performance.md).

## Migration

A new Flyway migration adds both tables (next available version after Module 1's most recent —
coordinate the version number across modules at merge time, since Flyway versions are global to the
schema, not per-module).

## Relationship to Module 4

`tbl_social_post` is the join point between Module 3 (what was published) and Module 4 (how it
performed) — see [`docs/module-4/backend/post-metrics.md`](../../module-4/backend/post-metrics.md)
for `PostMetric`, which references `tbl_social_post.id`.
