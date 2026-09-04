# `PlatformConnectionController` (specified, not yet implemented)

**Package (proposed):** `com.ceview.module3.connections` · **File (proposed):**
`backend/spring-boot/src/main/java/com/ceview/module3/connections/PlatformConnectionController.java`

## Responsibility

Own the per-operator OAuth connection state for the four publishing platforms (Instagram, TikTok,
Facebook, Naver Blog). Backs [`settings-platforms.md`](../screens/settings-platforms.md) and gates
the platform picker in [`content-studio.md`](../screens/content-studio.md).

## Endpoints (proposed)

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/platform-connections?operatorId=UUID` | List connection state for all four platforms |
| `POST` | `/api/platform-connections/{platform}/connect` | Initiate OAuth (returns a redirect URL) |
| `POST` | `/api/platform-connections/{platform}/callback` | OAuth callback — exchanges code for token, persists it |
| `DELETE` | `/api/platform-connections/{platform}` | Disconnect — revokes/discards the stored token |

`{platform}` is one of `instagram`, `tiktok`, `facebook`, `naver`.

## Entity (proposed) — `PlatformConnection` / `tbl_platform_connection`

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` PK | |
| `operator_id` | `UUID` FK → `tbl_msme_operator` | |
| `platform` | `TEXT` | one of the four platform keys |
| `access_token` | `TEXT`, encrypted at rest | never returned to the frontend |
| `refresh_token` | `TEXT`, encrypted at rest, nullable | platform-dependent |
| `connected_at` | `TIMESTAMP` | |
| `scopes` | `TEXT[]` or comma-joined | the three scopes the prototype lists: read metadata, publish, read insights |

Unique constraint on `(operator_id, platform)`.

## Frontend contract

`GET` returns booleans only (`{ instagram: true, facebook: true, tiktok: false, naver: false }`) —
tokens never reach the client. This is the shape [Content Studio](../screens/content-studio.md)'s
publish picker and [Settings → Platforms](../screens/settings-platforms.md) both read.

## Relationship to onboarding

[Onboarding step 4](../../module-1/screens/onboarding-wizard.md#4--assets--links-stepsassetslinkssteptsx)
collects social **handles** (plain text), which is not the same as an OAuth grant through this
controller — a filled-in handle should not be reported as `connected: true`. See
[`docs/module-1/backend/schema-delta.md`](../../module-1/backend/schema-delta.md).

## Fixture stand-in

Until implemented, `apiClient` returns/mutates the fixture-backed connection map described in the
[Fixture Data Layer card](../../superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/01-foundation.md#card--foundation-fixture-data-layer).
