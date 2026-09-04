# Frontend → Backend Contract

This pass scaffolds the Spring Boot + FastAPI backend specified by the CeView SDD.
All endpoints exist; behavior is wired to FastAPI stubs that return data shaped
exactly like the frontend's existing types in `frontend/types.ts`.
The frontend can be pointed at `http://localhost:8080` and continue to work.

## Endpoints

| Method | Path | Frontend trigger | Returns |
|---|---|---|---|
| POST | `/api/auth/register` | Create Account form | `{ operatorId, token, profileCompleted }` |
| POST | `/api/auth/login` | Sign In form | `{ operatorId, token, profileCompleted }` |
| POST | `/api/auth/google` | "Continue with Google" — body `{ idToken, intent }` (a Firebase ID token, and `"login"` or `"register"` matching the active tab) | `{ operatorId, token, profileCompleted }`, or 503 if Google sign-in isn't configured (no `FIREBASE_CREDENTIALS_JSON`), 401 on an invalid/expired token, 409 `google_account_already_registered` when `intent: "register"` targets an already-linked Google account, 404 `google_account_not_registered` when `intent: "login"` targets one that was never registered |
| PATCH | `/api/auth/profile` | CompleteProfilePage — body `{ contactNumber }` | `{ profileCompleted: true }` |
| POST | `/api/classification/analyze` | UniquenessCalibrationForm "Analyze" | `{ categories: CategoryAllocation[] }` |
| POST | `/api/classification/uniqueness` | Onboarding Step 5 "Compute uniqueness score" | `UniquenessResponse` — see [Uniqueness response](#uniqueness-response) |
| GET  | `/api/business-profile?operatorId=` | BusinessProfile load | `BusinessProfileDto` (matches `ProfileData`) |
| PUT  | `/api/business-profile?operatorId=` | BusinessProfile save | `BusinessProfileDto` |
| POST | `/api/business-profile/keywords` | BusinessProfile "Recalibrate" | `string[]` (replaces `generateOptimizedKeywords`) |
| GET  | `/api/notifications` | HomeView | `{ notifications: Notification[] }` |
| GET  | `/api/forecasting/markets` | MarketRadarView | `{ markets: Market[] }` |
| POST | `/api/forecasting/analyze/{profileId}` | "Analyze Markets" | `{ markets: Market[] }` |
| POST | `/api/content/generate` | ContentStudioView load | full `MOCK` shape (market, framework, captions, compliance) |
| POST | `/api/creative-direction/generate/{profileId}` | VisualDirectionBoard | `{ shotListRecommendations, visualRecommendations, lightingSuggestions, moodboardReferences }` |
| POST | `/api/compliance/evaluate-json` | Smart Optimization Audit (JSON) | `{ score, aligned[], gaps[], ... }` |
| POST | `/api/compliance/evaluate` | Smart Optimization Audit (multipart) | same shape, accepts media upload |
| GET  | `/api/analytics/metrics?start=&end=` | EngagementMetricsBoard | `{ metrics, funnel }` |
| POST | `/api/analytics/manual` | DataIngestionForm submit | `{ metrics, funnel }` (computed) |
| GET  | `/api/analytics/pes/{campaignId}` | PESComputationBoard | `{ overallScore, label, breakdown }` |
| POST | `/api/analytics/report` | AIActionPlanReport "Generate" | `{ executiveSummary, lowestMetric, lowestMetricMeaning, recommendations, otherAreasImprove, weakestStage, secondaryLeaks }` |
| GET  | `/api/analytics/report/{id}/pdf` | "Download PDF" | application/pdf stream |

## New endpoints — UI/UX overhaul (specified, not yet implemented)

The screens introduced by [`ui-ux-prototype.html`](../ui-ux-prototype.html) need endpoints that don't
exist above. Full detail — request/response shape, entities, migrations — is in each linked doc; this
table is the flat index.

| Method | Path | Frontend trigger | Doc |
|---|---|---|---|
| GET  | `/api/platform-connections?operatorId=` | Settings → Platforms load; Content Studio publish-gate check | [`docs/module-3/backend/PlatformConnectionController.md`](../docs/module-3/backend/PlatformConnectionController.md) |
| POST | `/api/platform-connections/{platform}/connect` | Settings → Platforms "Connect" | same |
| POST | `/api/platform-connections/{platform}/callback` | OAuth redirect callback | same |
| DELETE | `/api/platform-connections/{platform}` | Settings → Platforms "Disconnect" | same |
| GET  | `/api/posts?operatorId=&from=&to=` | Calendar load | [`docs/module-3/backend/PublishingController.md`](../docs/module-3/backend/PublishingController.md) |
| GET  | `/api/posts?operatorId=&status=` | Content Studio content board | same |
| POST | `/api/posts/publish` | Content Studio "Publish now" | same |
| GET  | `/api/analytics/posts?operatorId=&platform=` | Performance "Previously published" | [`docs/module-4/backend/post-metrics.md`](../docs/module-4/backend/post-metrics.md) |
| GET  | `/api/analytics/posts/{postId}` | Post analytics modal | same |
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
below the comparison floor. The frontend renders a distinct state for it. This case
previously returned `overallScore: 100`, indistinguishable on screen from a genuinely
outstanding score.

The cohort comes from the reference corpus seeded by `V26__module1_reference_corpus.sql`
plus `db/dump/uniqueness-corpus.sql` — see [RUNNING.md §5a](../RUNNING.md). Reference rows
carry `is_reference = TRUE`, have no operator, and must be excluded from every
operator-scoped query; the uniqueness cohort is the only reader that wants them.

## Notes

- **Auth is open in scaffolding**: `SecurityConfig` permits everything under `/api/**` so the existing frontend (which has no login flow yet) can hit endpoints. Lock this down once the React side has an auth screen.
- **Notifications and markets are envelope-wrapped** (`{ notifications: [...] }`, `{ markets: [...] }`) — the frontend currently reads bare arrays from constants, so when `geminiService.ts` is swapped over, unwrap one level.
- **PES is computed Spring-side** (no AI call) — pure formula per SDD §4.2.
- **Metrics are computed Spring-side** — SDD §4.1 specifies the math, no model needed.
- **`ml_stubs.py` is gone** — Module 1's deterministic input-hashed mocks were deleted along with the dead local Keras path that was their only caller (classification now goes to the hosted HF Space; the local E5 encoder is used only for embeddings). Nothing substitutes canned classification or uniqueness values any more; an unavailable dependency raises. See `docs/superpowers/plans/2026-08-30-remove-synthetic-fallbacks/`.
- **Gemini is opt-in** — set `ENABLE_GEMINI=true` + `GEMINI_API_KEY=…` in `.env` to activate live calls. Without it, prompts return the same hand-crafted mocks that match the frontend's existing strings.
