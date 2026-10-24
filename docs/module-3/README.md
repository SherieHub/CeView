# Module 3 — Content Studio

Generates market-localized social captions and visual direction, gates them behind a compliance
audit, and publishes them to the operator's connected platforms.

## Screens

| Screen | Route | Doc |
|---|---|---|
| Content Studio | `/content` | [`screens/content-studio.md`](screens/content-studio.md) |
| Calendar | `/calendar` | [`screens/calendar.md`](screens/calendar.md) |
| Settings → Platforms | `/settings/platforms` | [`screens/settings-platforms.md`](screens/settings-platforms.md) |

One screen (Content Studio) now surfaces what used to be three separate transactions — 3.1 content
generation, 3.2 creative direction, 3.3 compliance — as one page's caption matrix, visual direction
board, and compliance panel respectively. The transactions themselves, and their backend pipelines,
are unchanged.

## Backend

| Component | Doc |
|---|---|
| `SocialConnectionController` (Meta Page/Instagram/TikTok OAuth) | [`backend/PlatformConnectionController.md`](backend/PlatformConnectionController.md) |
| `PublishingController` (persisted delivery, schedules and PAUSED ads) | [`backend/PublishingController.md`](backend/PublishingController.md) |
| Schema delta (media, publishing grants, posts and metric snapshots) | [`backend/schema-delta.md`](backend/schema-delta.md) |

Existing, unchanged backend for content generation (3.1), creative direction (3.2), and compliance
(3.3) — `ContentController`, `CreativeDirectionController`, `ComplianceController`, the LangGraph
caption agent, Groq visual direction, and the OMCS audit pipeline — is documented in full in
[`MODULE3_SYSTEM_DOCUMENTATION.md`](MODULE3_SYSTEM_DOCUMENTATION.md) and the transaction subfolders
below.

| Submodule | Endpoint | Scope |
|---|---|---|
| [`3.1-content-generation/`](3.1-content-generation/) | `POST /api/content/generate` | LangGraph caption generation |
| [`3.2-creative-direction/`](3.2-creative-direction/) | `POST /api/creative-direction/generate/{profileId}` | Groq visual direction |
| [`3.3-compliance/`](3.3-compliance/) | `POST /api/compliance/evaluate` | OMCS audit |

## Promote as an ad (CVW-43)

For operators who have never run a paid ad. A **Promote as an ad** card in Content Studio opens a
side drawer: the operator says what they want ("get seen by 5,000 people in South Korea", booking-
page visits, or Messenger conversations) and picks Facebook & Instagram or TikTok. CeView fills in
the plan — objective, location, language, surge-window dates, ad text with the attribution code,
the tracked link — and walks them through Ads Manager step by step with a copy button on every
value. The budget estimate comes only from the operator's own past ad costs
(`GET /api/analytics/cost-rates`); with no history it says so instead of guessing.

The guide drawer does not create anything on the platform. Separately, the **Publish** window's
**Run as Paid Ad** creates a **paused** Meta campaign, ad set and ad for the operator to review and
launch in Ads Manager (never launched by CeView). It aims the ad at the forecast market's country and
language, with optional Meta interests, and is held to the business's own daily and total spending
limits and to Meta's minimum budget; see
[`SOCIAL_PUBLISHING_SETUP.md`](../SOCIAL_PUBLISHING_SETUP.md) and
[`backend/CONTRACT.md`](../../backend/CONTRACT.md). The research behind the guide, and why it stays
copy-and-paste for TikTok: [`MSME_AD_SUPPORT_RESEARCH.md`](MSME_AD_SUPPORT_RESEARCH.md).

## Diagrams

[`class.puml`](class.puml) · [`sequence.puml`](sequence.puml) · [`er.puml`](er.puml) — module-level,
covering all three transactions. Per-submodule diagrams live inside each transaction folder above.

## Changed in the UI/UX overhaul

Source of truth: [`ui-ux-prototype.html`](../../ui-ux-prototype.html). Full rationale and card-by-card
build plan: [`docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/`](../superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/00-index.md)
(Content Studio, Calendar, Platforms, Workspace cards: [`04-module-3.md`](../superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/04-module-3.md)).

- `ContentStudioView.tsx` now also owns publish gating (connected-platform check), a content board
  (draft/published list), and the publish action itself — previously out of scope for this screen.
- The prototype ships two Content Studio designs; **v1 (`screen-content`) is canonical**. Its
  per-platform-shared-caption approach is kept, with one deviation ported from the alternate design:
  the publish-to picker is gated on platform connection state. See
  [`screens/content-studio.md`](screens/content-studio.md) for the full rationale.
- [Calendar](screens/calendar.md) reads persisted posts; [Settings → Platforms](screens/settings-platforms.md)
  connects real publishing grants. Shipped endpoints and delivery states are in
  [the API contract](../../backend/CONTRACT.md#social-publishing-endpoints).
