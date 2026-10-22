# Frontend → Backend Contract

This pass scaffolds the Spring Boot + FastAPI backend specified by the CeView SDD.
All endpoints exist; behavior is wired to FastAPI stubs that return data shaped
exactly like the frontend's existing types in `frontend/types.ts`.
The frontend can be pointed at `http://localhost:8080` and continue to work.

## Endpoints

| Method | Path | Frontend trigger | Returns |
|---|---|---|---|
| POST | `/api/auth/register` | Create Account form — body `{ firstName, lastName, email, password, contactNumber }`; password must be 8-72 bytes with a letter and a digit (400 `WEAK_PASSWORD`). Emails a 6-digit verification code | `{ operatorId, token, profileCompleted, emailVerified }`; 400 `EMAIL_TAKEN` if the email belongs to a verified, Google, or pre-verification account (an unverified sign-up made after verification shipped is replaced instead) |
| POST | `/api/auth/login` | Sign In form | `{ operatorId, token, profileCompleted, emailVerified }` — an unverified account still gets a token, but see [Email verification](#email-verification--password-reset) |
| POST | `/api/auth/google` | "Continue with Google" — body `{ idToken, intent }` (a Firebase ID token, and `"login"` or `"register"` matching the active tab) | `{ operatorId, token, profileCompleted }`, or 503 if Google sign-in isn't configured (no `FIREBASE_CREDENTIALS_JSON`), 401 on an invalid/expired token, 409 `google_account_already_registered` when `intent: "register"` targets an already-linked Google account, 404 `google_account_not_registered` when `intent: "login"` targets one that was never registered |
| PATCH | `/api/auth/profile` | CompleteProfilePage — body `{ contactNumber }` | `{ profileCompleted: true }` |
| POST | `/api/auth/email-verification/send` | VerifyEmailPage (on arrival, and "Resend code") — auth required | 202 `{ sentTo, resendAvailableInSeconds }`; 409 `ALREADY_VERIFIED`; 429 `RESEND_COOLDOWN` / `SEND_LIMIT` (+ `retryAfterSeconds`); 503 `EMAIL_SEND_FAILED` |
| POST | `/api/auth/email-verification/verify` | VerifyEmailPage — body `{ code }`, auth required | `{ emailVerified: true }`; 400 `INVALID_CODE` (+ `attemptsRemaining`) / `CODE_EXPIRED` / `CODE_LOCKED` / `NO_ACTIVE_CODE` |
| PATCH | `/api/auth/email` | VerifyEmailPage "Wrong email? Change it" — body `{ email }`, auth required, unverified accounts only | `{ email }` and a new code is mailed to it; 400 `EMAIL_TAKEN` / `SAME_EMAIL`; 409 `ALREADY_VERIFIED` |
| POST | `/api/auth/password-reset/request` | ForgotPasswordPage step 1 — body `{ email }`, public | 202 `{ sentTo, resendAvailableInSeconds }`; 404 `ACCOUNT_NOT_FOUND`; 409 `GOOGLE_ACCOUNT` (no password to reset); same 429/503 codes as `send` |
| POST | `/api/auth/password-reset/confirm` | ForgotPasswordPage step 2 — body `{ email, code, newPassword }`, public | `{ operatorId, token, profileCompleted, emailVerified: true }` (signs the user in); 400 `WEAK_PASSWORD` / `INVALID_CODE` / `CODE_EXPIRED` / `CODE_LOCKED` / `NO_ACTIVE_CODE`; 404 `ACCOUNT_NOT_FOUND`; 409 `GOOGLE_ACCOUNT` |
| POST | `/api/classification/analyze` | UniquenessCalibrationForm "Analyze" | `{ categories: CategoryAllocation[] }` |
| POST | `/api/classification/uniqueness` | Onboarding Step 5 "Compute uniqueness score" | `UniquenessResponse` — see [Uniqueness response](#uniqueness-response) |
| GET  | `/api/business-profile?operatorId=` | BusinessProfile load | `BusinessProfileDto` (matches `ProfileData`) |
| PUT  | `/api/business-profile?operatorId=` | BusinessProfile save | `BusinessProfileDto` |
| POST | `/api/business-profile/keywords` | BusinessProfile "Recalibrate" | `string[]` (replaces `generateOptimizedKeywords`) |
| GET  | `/api/notifications` | `DashboardView` initial feed | `{ notifications: NotificationDto[] }` |
| GET  | `/api/forecasting/markets?category=` | `DashboardView` ranking and drawer | `{ markets: MarketDto[] }` |
| POST | `/api/forecasting/ensure?maxAgeHours=` | `DashboardView` initial staleness gate | `204 No Content` or readiness error |
| POST | `/api/forecasting/analyze` | `DashboardView` “Refresh forecast” | `{ markets: MarketDto[] }` |
| GET  | `/api/forecasting/status` | `DashboardView` degraded-mode banner | `{ available: boolean }` |
| POST | `/api/content/generate` | ContentStudioView load | full `MOCK` shape (market, framework, captions, compliance). Each platform's `captions.<platform>` carries `options` (Korea/Japan captions are written entirely in Korean/Japanese) and a parallel `optionsEn` — a meaning-faithful English translation of each option (`""` = none, e.g. USA) |
| POST | `/api/content/translate` | “Show English” toggle (edited captions and captions with no `optionsEn`) | req `{ caption, platform? }` → `{ captionEn, sourceLanguage, source }`. 400 `MOD31_TRANSLATION_VALIDATION` (blank / >8000 chars / bad platform); 503 `MOD31_TRANSLATION_UNAVAILABLE` / `MOD31_TRANSLATION_FAILED` |
| POST | `/api/content/localize` | “Apply to Korean/Japanese” after editing the English | req `{ captionEn, targetLanguage: "ko"\|"ja", platform?, originalCaption? }` → `{ caption, captionEn, targetLanguage, source }`. Same error codes; 400 for any other `targetLanguage` |
| POST | `/api/creative-direction/generate/{profileId}` | VisualDirectionBoard | `{ shotListRecommendations, visualRecommendations, lightingSuggestions, moodboardReferences }` |
| POST | `/api/compliance/evaluate-json` | Smart Optimization Audit (JSON) | `{ score, aligned[], gaps[], ... }` |
| POST | `/api/compliance/evaluate` | Smart Optimization Audit (multipart) | same shape, accepts media upload |
| GET  | `/api/analytics/metrics?start=&end=` | EngagementMetricsBoard | `{ metrics, funnel }` |
| POST | `/api/analytics/manual` | DataIngestionForm submit | `{ metrics, funnel }` (computed) |
| GET  | `/api/analytics/pes/{campaignId}` | PESComputationBoard | `{ overallScore, label, breakdown }` |
| POST | `/api/analytics/report` | AIActionPlanReport "Generate" | `{ executiveSummary, lowestMetric, lowestMetricMeaning, recommendations, otherAreasImprove, weakestStage, secondaryLeaks }` |
| GET  | `/api/analytics/report/{id}/pdf` | "Download PDF" | application/pdf stream |
| GET  | `/api/attribution/codes` | Performance → Code-redemption evidence; dashboard quick log | `AttributionCodeSummary[]` — each code with bookings split by capture kind (`ENQUIRY`, `BOOKING_PLATFORM`, `CLICK_MATCHED`, `CODE_LOGGED`), plus `reportedBookings` (null until a week in the window is submitted) and `trackedExceedsReported` |
| GET  | `/api/attribution/tracked?periodStart=&periodEnd=` | IngestionForm Bookings hint (dates `YYYY-MM-DD`, inclusive, Asia/Manila) | `TrackedPeriodSummary` — tracked bookings by kind and tracked revenue; 400 when `periodEnd` precedes `periodStart` |
| GET  | `/api/attribution/lift/{attributionCodeId}` | Performance → Statistical lift | `AttributionLift` — per-week bookings/revenue in the window vs. the 28 days before, `status` `OK`/`UPCOMING`/`NO_WINDOW_DATA`/`NO_BASELINE`; 404 for another operator's code |
| POST | `/api/attribution/redemptions` | "Log a booking" — body `{ attributionCodeId?, clickId?, bookings?, revenue?, eventAt? }` | `201 AttributionRedemption`; 400 when neither id is sent or `eventAt` is in the future, 404 for another operator's code/click, 409 when the click already has a booking |
| GET  | `/api/attribution/redemptions` | Code-redemption evidence "Recent bookings" | `AttributionRedemption[]`, newest first (max 50) |
| DELETE | `/api/attribution/redemptions/{id}` | "Remove" on a recent booking | `204`; 409 for enquiry- or sync-sourced rows, which the operator did not author |

## Social publishing endpoints

All routes below require the authenticated operator's profile, except the two public OAuth redirect callbacks. Client-supplied operator/profile IDs never select the tenant. Credentials never appear in responses.

| Method | Path | Contract |
|---|---|---|
| GET | `/api/social-connections` | Three `{platform, configured, status, handle, connectedAt}` rows; status is `DISCONNECTED`, `NEEDS_RECONNECT`, `NEEDS_PAGE`, `NO_LINKED_INSTAGRAM`, or `ACTIVE` |
| POST | `/api/ad-connections/meta/authorize` | Shared Meta publishing/ads OAuth URL |
| GET | `/api/ad-connections/{provider}/callback` | Public redirect only; forwards `ad_code`, `ad_provider`, `state` to Settings |
| POST | `/api/ad-connections/{provider}/complete` | `{code,state}`; consumes state and binds it to the authenticated profile, then stores the grant; 204 |
| POST | `/api/social-connections/tiktok/authorize` | TikTok creator OAuth URL (separate from TikTok Ads) |
| GET | `/api/social-connections/tiktok/callback` | Public redirect only; forwards `tiktok_code`, `state` |
| POST | `/api/social-connections/tiktok/complete` | `{code,state}`; authenticated state completion; fresh connection list |
| GET | `/api/social-connections/meta/pages` | First 100 eligible Pages, including linked Instagram username |
| PUT | `/api/social-connections/meta/page` | `{pageId}`; verifies membership before storing Page/Instagram grants |
| DELETE | `/api/social-connections/{platform}` | Discards local publishing credentials; Facebook/Instagram disconnect together; ads connection is retained |
| POST | `/api/media/uploads` | `{contentType,sizeBytes}` → `{mediaId,uploadUrl,publicUrl,kind}` |
| POST | `/api/media/{id}/complete` | Verifies storage and marks the upload ready |
| POST | `/api/posts/publish` | Approved captions, ready media, destinations and optional schedule/ad settings; returns persisted post views |
| GET | `/api/posts?from=&to=&status=` | Tenant-owned post views, optionally filtered by date/status |
| GET | `/api/posts/{id}` | One owned post view; foreign IDs return 404 |
| DELETE | `/api/posts/{id}` | Cancels pending or native scheduled work; conflicts when already in flight, published, or accepted by TikTok |
| GET | `/api/analytics/posts?platform=` | Delivered posts with available metric snapshots |
| GET | `/api/analytics/posts/{id}` | One owned post plus nullable per-post metrics |

`POST /api/posts/publish` accepts:

```json
{
  "requestId": "UUID",
  "platforms": ["instagram"],
  "captionsByPlatform": {"instagram": "Approved caption"},
  "mediaId": "UUID",
  "contentId": null,
  "market": "japan",
  "visibility": "public",
  "approved": true,
  "scheduledFor": null,
  "ad": null
}
```

`requestId` deduplicates a tenant's complete request. Reusing it with different content returns 409. `contentId`, when supplied, must reference the tenant's approved generated content. Platforms are `facebook`, `instagram`, `tiktok`, `meta_ads`. A paid ad requires `ad: {objective, dailyBudgetMinor, startTime, endTime, countries, attributionLinkId, pinCampaign}`. Objectives are `OUTCOME_TRAFFIC` or `OUTCOME_AWARENESS`; budget is integer minor units in the chosen ad account's currency; countries are ISO alpha-2. The attribution link must belong to the tenant. All remote ad objects remain PAUSED for review in Ads Manager.

Post views contain `id,date,platform,caption,status,deliveryStatus,mediaUrl,mediaType,scheduledFor,permalink,adsManagerUrl,errorMessage,metricsAvailable,reach,likes,comments,shares,engagementRate,series`. UI statuses are `processing`, `scheduled`, `published`, `inbox`, `failed`, `cancelled`, `draft` (PAUSED ad). Delivery statuses preserve the backend lifecycle. Metrics are nullable; absent information is unavailable, never a measured zero. Reach history contains up to seven UTC calendar-day samples, including null gaps.

Facebook schedules use native platform scheduling (10 minutes to 6 months ahead); Instagram and TikTok execute through CeView's dispatcher. TikTok delivers a draft to the inbox: users finish publication and choose privacy in TikTok. Video drafts require copying the caption. Instagram images must be JPEG; TikTok photos JPEG or WEBP. Ready media is checked again in storage immediately before delivery. A platform timeout with an uncertain remote write outcome fails safely for operator inspection rather than reposting automatically. Definite rate limits retry up to three delivery attempts; processing polls preserve the remote identifier.

Missing platform configuration returns 503, disconnected/changed accounts 409, foreign resources 404, malformed requests 400, and OAuth completion errors 400/403/502 as applicable. Local tests mock all platform calls. See [setup](../docs/SOCIAL_PUBLISHING_SETUP.md).

## Remaining UI/UX overhaul endpoints

The screens introduced by [`ui-ux-prototype.html`](../ui-ux-prototype.html) need endpoints that don't
exist above. Full detail — request/response shape, entities, migrations — is in each linked doc; this
table is the flat index.

| Method | Path | Frontend trigger | Doc |
|---|---|---|---|
| GET  | `/api/workspace/members?operatorId=` | Settings → Workspace load | [`docs/shared/workspace.md`](../docs/shared/workspace.md) |
| POST | `/api/workspace/invites` | Settings → Workspace "Send invite" | same |
| DELETE | `/api/workspace/members/{id}` | (gap — not in the prototype, needed for a real product) | same |

Also required: `GET /api/forecasting/markets?category=` (or an equivalent per-alert ranking) for
the Dashboard's category-scoped market reveal — see
[`docs/module-2/backend/category-scoped-ranking.md`](../docs/module-2/backend/category-scoped-ranking.md).

Until these are implemented, the frontend runs against a fixture layer — see the
[Fixture Data Layer card](../docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/01-foundation.md#card--foundation-fixture-data-layer)
in the card-by-card [frontend implementation plan](../docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/00-index.md).

## Uniqueness response

`POST /api/classification/uniqueness` → `UniquenessResponse`:

```jsonc
{
  "overallScore":        68,   // the headline; ALWAYS equals semanticPercentile
  "semanticsScore":      37,   // raw distinctiveness 0-100 (scaled mean cosine distance)
  "categoryScore":      100,   // classification confidence — NOT part of overallScore
  "semanticPercentile":  68,   // rank against the cohort's own distance distribution
  "cohortSize":          34,   // businesses actually compared against
  "cohortMedianScore":   41,   // median semanticsScore within that cohort
  "cohortCategories":   ["Adventure & Nature"],
  "categoryDensity":    "dense",   // "dense" | "moderate" | "sparse"
  "sufficientCohort":   true,
  "descriptionFeedback": "…",
  "categoryFeedback":    "…"
}
```

**Two rules the types cannot express, and that this response has previously got wrong:**

1. `overallScore === semanticPercentile`. Nothing else feeds it.
2. `categoryScore` is **not** a component of `overallScore`.

`categoryScore` is a *normalised share* that sums to 100 across the operator's selected
categories — keeping one category yields ~100 mechanically, keeping three yields ~33 each.
It was previously averaged into the headline, which made the score move by tens of points
based on how many chips an operator happened to leave selected. It is also **not comparable
across different numbers of selected categories**, so it must never be charted or trended.

`sufficientCohort: false` is a **valid response, not an error** — it means the cohort is
below the comparison floor. The frontend renders an **empty state** for it, not an error
panel. This case previously returned `overallScore: 100`, indistinguishable on screen from
a genuinely outstanding score.

Distinct from that: if FastAPI returns a result that is **missing** one of the fields above
(`overallScore`, `semanticsScore`, `categoryScore`, `semanticPercentile`, `cohortSize`,
`cohortMedianScore`, `categoryDensity`, `sufficientCohort`), Spring answers **503** with the
dependency-unavailability body (`code`, `message`, `dependency: "fastapi"`, `cause`, `stage`)
rather than defaulting the field to `0`. A `cohortSize: 0` rendered as "compared against 0
businesses" would be a fabricated fact; an absent field is an upstream fault and the screen
shows the error panel. (`descriptionFeedback` / `categoryFeedback` are exempt — an empty
string is a legitimate value for them today.)

The cohort comes from the reference corpus seeded by `V26__module1_reference_corpus.sql`
plus `db/dump/uniqueness-corpus.sql` — see [RUNNING.md §5a](../RUNNING.md). Reference rows
carry `is_reference = TRUE`, have no operator, and must be excluded from every
operator-scoped query; the uniqueness cohort is the only reader that wants them. In Spring,
`BusinessProfileRepository.findAllNonReference()` is the cross-operator read that enforces
this — `findAll()` must not be used for tenant-facing work.

## Email verification & password reset

Every account must prove it owns its email with a 6-digit code before it can use the app.

- **Gate.** An unverified operator can still sign in and receive a JWT, but `EmailVerificationFilter` answers every route outside `/api/auth/**`, `/actuator/**`, `/error` and the public attribution routes with `403 { error: "email not verified", code: "EMAIL_NOT_VERIFIED" }`. It runs before `ProfileCompletionFilter`. The frontend routes such a user to `/verify-email`.
- **Verified means.** `email_verified_at` is set by a correct code, by a completed password reset, or by Google sign-in when Firebase reports `email_verified: true` (no code). Linking Google to an existing *unverified* password account verifies it and clears its password.
- **Existing accounts.** The migration leaves `email_verified_at` NULL for everyone, seeded demo operators included, so each must verify once. It also sets `created_before_verification = TRUE` for them, which makes them ineligible for takeover (below).
- **Codes.** 6 random digits, stored only as a BCrypt hash, valid 10 minutes, locked after 5 wrong guesses, one active code per account and purpose (a new code supersedes the old), 60 s between sends, at most 5 sends per hour per account and purpose. All values are `ceview.email-code.*` in `application.yml`. A code is only valid while it still matches the account's current email.
- **Takeover.** `POST /register` for an email held by an account that is unverified, created after verification shipped, password-based and not linked to Google deletes that account and creates the new one (a fresh `operatorId`, so the old JWT 401s). Any other existing account returns `EMAIL_TAKEN`.
- **Per-IP limit.** `register`, `email-verification/send`, `PATCH /email` and `password-reset/request` share a per-IP budget (default 10 per 15 minutes, `CEVIEW_AUTH_RATE_LIMIT_MAX_REQUESTS`) to protect the email provider's free quota: `429 { code: "RATE_LIMITED", retryAfterSeconds }` with a `Retry-After` header.
- **Error shape.** Failures in these flows are `{ error, code, ...details }` (`error` is a human sentence; clients switch on `code`).
- **Delivery.** `EMAIL_PROVIDER=log` (default) writes the code to the backend log; `resend` sends through Resend's HTTPS API (Render's free tier blocks SMTP). See `RUNNING.md` and `docs/DEPLOY_RENDER.md`.
- **E2E hook.** With `CEVIEW_TEST_SUPPORT_ENABLED=true`, `GET /api/test-support/email-codes/latest?email=` returns `{ code, subject }` for the last email sent to an address. The backend refuses to start with this on and `EMAIL_PROVIDER=resend`.

## Notes

- **Auth**: every route except `/api/auth/**`, `/actuator/**`, `/error` and the public attribution routes (`/r/**`, `/api/public/attribution/**`, the ad-platform OAuth callback) requires a valid JWT, and — see above — a verified email. (An earlier revision of this file described auth as open; that is no longer true.)
- **Notifications and markets are envelope-wrapped** (`{ notifications: [...] }`, `{ markets: [...] }`) — the frontend currently reads bare arrays from constants, so when `geminiService.ts` is swapped over, unwrap one level.
- **PES is computed Spring-side** (no AI call) — pure formula per SDD §4.2.
- **Metrics are computed Spring-side** — SDD §4.1 specifies the math, no model needed.
- **`ml_stubs.py` is gone** — Module 1's deterministic input-hashed mocks were deleted along with the dead local Keras path that was their only caller (classification now goes to the hosted HF Space; the local E5 encoder is used only for embeddings). Nothing substitutes canned classification or uniqueness values any more; an unavailable dependency raises. See `docs/superpowers/plans/2026-08-30-remove-synthetic-fallbacks/`.
- **Gemini is opt-in** — set `ENABLE_GEMINI=true` + `GEMINI_API_KEY=…` in `.env` to activate live calls. Without it, prompts return the same hand-crafted mocks that match the frontend's existing strings.
