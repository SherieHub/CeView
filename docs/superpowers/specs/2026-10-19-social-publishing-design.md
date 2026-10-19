# Social account connection, publishing and Meta Ads handoff — design

Ticket: CVW-55 · Date: 2026-10-19 · Status: draft for review

## Problem

The Facebook/Instagram/TikTok connect flow in Settings → Platforms is a mock (a 1.3 s delay and a fake scope modal), and "Confirm & Publish" in Content Studio only creates in-memory posts. Media exists only as a browser data URL (images only), so no platform can fetch it. Module 4's Meta/TikTok connection is a separate, read-only `ads_read` grant (`AD_PLATFORM_SETUP.md`, `V41`).

## Goal

An operator connects Facebook, Instagram and TikTok once, then sends an approved caption and media to the chosen platform. They can also create a Meta ad from the same media and caption, which they review in Ads Manager before launching.

## Platform constraints (all APIs free)

| Target | Handoff | Notes |
|---|---|---|
| Facebook Page | API publish, or native scheduling (`scheduled_publish_time`, at least 10 min ahead) | Pages only; no personal profiles. Meta's policy forbids prefilled captions via share links, so a link-only redirect is not used. |
| Instagram Business/Creator | API publish via container then `media_publish` | No draft state and no native scheduling, so a CeView job publishes at the scheduled time. Account must be linked to the Page. |
| TikTok | Content Posting API inbox upload (draft) | The user finishes in the TikTok app. Photo drafts carry a caption; video inbox drafts do not, so the UI copies the caption to the clipboard and says so. Media must come from a verified URL prefix. |
| Meta Ads | Marketing API creates PAUSED campaign, ad set and ad; Ads Manager opens on it | Needs `ads_management`. |

Dev-mode apps only serve accounts with a role on the app (testers). Public use needs Meta App Review plus Business Verification and a TikTok audit. These are free but take weeks and are out of scope; the steps are documented in Phase 0.

## Decisions (confirmed with the user)

- Full API approach; demo/capstone testers only.
- Images and video.
- Media on AWS S3 + CloudFront (existing distribution, new `/media/*` behavior).
- Facebook and Instagram: publish now or schedule. TikTok: draft sent at the scheduled time.
- Meta Ads: minimal form in the Publish modal under "Run as Paid Ad" (objective, daily budget, dates, countries prefilled from the market). The ad links to the Module 4 attribution link via `AdUrlBuilder`.
- One Meta login covers Page publishing, IG publishing and ads. The Module 4 Meta connection is upgraded to reuse it; existing operators reconnect once.
- A new TikTok for Developers app is needed (separate from the TikTok For Business ads app).
- Posts are persisted and per-post metrics flow into Module 4.
- Media uploads are signed with a dedicated least-privilege IAM user (`ceview-media`) rather than the server's `ceview-box` key; the media bucket also grants `s3:ListBucket` so a missing object is a 404, not a 403.

## Architecture

```
PublishModal ──POST /api/posts/publish──▶ PublishingService ──▶ PlatformPublisher (FB | IG | TikTok | MetaAds)
      │                                        │  ▲                      │
      │ presigned PUT                          │  └─ SocialPostDispatcher (@Scheduled, SKIP LOCKED)
      ▼                                        ▼
  S3 (/media/* via CloudFront)           tbl_social_post ◀── PostMetricsSyncJob ──▶ tbl_post_metric
                                               ▲
PlatformsSettings ──/api/social-connections──▶ tbl_publishing_account (tokens via TokenCipher)
```

Units, each with one purpose:

- **`module3.media`**: `MediaStorage` (S3 and local implementations), `MediaController`. Hands out presigned upload URLs and public URLs. Keys are prefixed with `business_profile_id`.
- **`module3.social` (connections)**: `SocialConnectionController`, `PublishingAccount` entity, `MetaGraphClient`, `TikTokContentClient`. Owns OAuth completion, Page/IG discovery and token storage.
- **`module3.social.publish`**: `PublishingService`, one `PlatformPublisher` per platform, `SocialPostDispatcher`. Owns the post lifecycle.
- **`module4.adconnections` (extended)**: `MetaAdsClient` gets the wider scope list and the campaign/ad-set/creative/ad write methods; `AdConnectionService` state handling is reused for the TikTok creator flow.
- **`module4.postmetrics`**: `PostMetricsSyncJob` plus read endpoints.

Existing code reused: `TokenCipher`, `AdConnectionService.mintState/consumeState`, the callback pattern in `AdConnectionController`, `AdUrlBuilder`, `CurrentBusinessProfile`, `AdAccountPickerModal`, `apiClient.request`.

## Data model (next free migration number is V48)

- **V48 `tbl_media_asset`**: id, business_profile_id, kind (image|video), content_type, size, storage_key, public_url, status, created_at.
- **V49 `tbl_publishing_account`**: business_profile_id, platform (facebook|instagram|tiktok), external_id, display name/handle, encrypted access and refresh tokens, token_expires_at, scopes, status (ACTIVE|NEEDS_RECONNECT|REVOKED), nullable FK to `tbl_ad_platform_connection`. UNIQUE (business_profile_id, platform). Also widens `chk_ad_state_provider` to include `tiktok_creator`.
- **V50 `tbl_social_post`**: id, business_profile_id, nullable content_id, market, platform (facebook|instagram|tiktok|meta_ads), caption, media_asset_id, visibility, scheduled_for, status (PENDING|SCHEDULED_ON_PLATFORM|PUBLISHING|PUBLISHED|SENT_TO_INBOX|FAILED), external ids, permalink, ads_manager_url, error_message, attempts, timestamps.
- **V51 `tbl_post_metric`**: as in `docs/module-4/backend/post-metrics.md`, keyed to `tbl_social_post`.

## API

- `POST /api/media/uploads`, `POST /api/media/{id}/complete`
- `GET /api/social-connections`, `POST /api/social-connections/tiktok/authorize`, `GET /api/social-connections/tiktok/callback` (public, state-token protected), `GET /meta/pages`, `PUT /meta/page`, `DELETE /{platform}`
- `POST /api/posts/publish`, `GET /api/posts`, `GET /api/posts/{id}`, `DELETE /api/posts/{id}`
- `GET /api/analytics/posts`, `GET /api/analytics/posts/{postId}`

All authenticated routes resolve the tenant through `CurrentBusinessProfile`. No response ever contains a token. `backend/CONTRACT.md` is updated to match.

## Data flow

1. **Connect:** the browser is redirected to the platform's OAuth screen. The callback burns the state token, stores encrypted tokens, and redirects to the frontend. For Meta the user then picks the ad account and the Page; the linked IG account is auto-detected.
2. **Upload:** the composer requests a presigned URL, PUTs the file to S3, and keeps a local preview. The draft stores `mediaId` and `mediaType`.
3. **Publish:** the modal posts to `/api/posts/publish`. "Now" runs synchronously and returns permalinks. "Scheduled" writes `PENDING` rows (or hands scheduling to Facebook) and the dispatcher claims due rows.
4. **Redirect:** on success the frontend opens the Facebook/Instagram permalink, shows the TikTok inbox instruction (copying the caption for video), or opens Ads Manager for ads.
5. **Ads:** campaign, then ad set, then media upload, then creative, then ad, all PAUSED. Each step is idempotent per post row so a partial failure can resume. The new campaign is optionally pinned as the Module 4 reporting campaign.
6. **Metrics:** a daily job fetches per-post figures and appends to the reach series.

## Error handling

- Platform error envelopes are mapped to `AdPlatformException`-style errors, never leaking tokens or full request URLs.
- Dispatcher retries up to 3 times with backoff, then `FAILED` with the platform message shown in the Content Library.
- Expired or revoked tokens set the account to `NEEDS_RECONNECT` and the UI prompts a reconnect.
- Missing configuration (`TOKEN_ENCRYPTION_KEY`, app credentials, bucket) returns 503 on the affected endpoints, like the existing ads connection.
- TikTok metrics may be unavailable if the status API doesn't return the published post id; the row then reads "metrics unavailable".

## Risks and open items to verify during implementation

- The Graph API default `v21.0` is old; bump the configured version and re-check field names (IG insight metrics changed in later versions).
- The exact Ads Manager deep link format (`selected_campaign_ids`) is unverified; fall back to the account's campaign list.
- TikTok `PULL_FROM_URL` requires URL prefix verification for `https://ceview.online/media/`.
- Facebook/Instagram have no private visibility; the toggle is disabled for them. TikTok private maps to `SELF_ONLY`.
- Local testing against real platforms needs a free `cloudflared` tunnel.
- Instagram's publish API reportedly accepts JPEG only and TikTok photo posts JPEG/WEBP only; the composer accepts PNG/JPG/WEBP. Phase 3 publishers must validate or convert (verify against current docs).

## Delivery phases (each gets its own implementation plan, TDD)

0. Platform and AWS setup docs and config (`docs/SOCIAL_PUBLISHING_SETUP.md`, IAM, compose, SSM mapping)
1. Media storage
2. Connections (Meta unified login, TikTok creator OAuth, Platforms settings screen)
3. Publishing and scheduling
4. Meta Ads paused campaign and Ads Manager redirect
5. Per-post metrics into Module 4

## Testing

- JUnit with MockWebServer for every Graph/TikTok call, including partial-failure chains; MockMvc tenant-isolation and no-token-leak tests; dispatcher claim/retry tests.
- Vitest for the settings redirect and picker, modal ad-form validation, publish-to-API behaviour, and video preview.
- Playwright publish journey on fixtures.
- Manual end-to-end with tester accounts on every platform.

## Cost

Platform APIs are free. AWS adds S3 storage (cents per GB-month at pilot scale) and CloudFront egress inside the always-free 1 TB/month. No new paid services; encryption and scheduling reuse existing components.
