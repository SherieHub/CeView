# Implementation Research — Support for MSMEs Who Don't Know Meta Ads (CVW-43)

**Date:** 2026-10-20
**Ticket:** CVW-43 — Implementation Research: MSME non-Meta-Ads user support
**Source:** *CeView Expert Interview Validation Findings*, tab 2, recommendation #8
**Module:** 3 (Content Studio), reading Module 4 (ad cost history, attribution links and codes)

> **Recommendation #8 (DTI) — Direct · Now · High.**
> "Support MSMEs who do not know Meta Ads: guide them or offer simplified ad creation (e.g.,
> 'reach 5,000 people in Korea') that publishes to Facebook or TikTok." Reason given: requiring ad
> skills excludes the businesses that need CeView most.

> **Implementation status (2026-10-20):** the **guided** half of the recommendation is built on
> branch `CVW-43-implementation-research-msme-non-meta-a-ds-user-support` — see §5. The
> **publishing** half (CeView creating the ad on Facebook or TikTok itself) is **not built**; §6
> explains why it could not be done in this session and what unblocks it.

---

## 1. The problem in CeView today

CeView's flow ends where the hardest step for a first-time advertiser begins:

1. Module 2 tells the operator a surge is coming from, say, Korea.
2. Module 3 writes market-localised captions, audits them, and "publishes".
3. Module 4 can read ad results back once an ad account is connected.

Between 2 and 3 the operator is expected to open Meta or TikTok Ads Manager and build a campaign
alone: choose an objective, set an audience, a budget and dates, paste the caption, and paste the
tracked link into the right field. For an operator who has never done this, every one of those is
a decision with no guidance. That is exactly the gap DTI flagged.

## 2. Current state (audited 2026-10-20)

| Area | State | Where |
|---|---|---|
| Ad account connection (Meta, TikTok) | **Read-only.** OAuth with `ads_read` (Meta) pulls impressions, clicks, spend, conversions into Module 4 | `module4/adconnections`, [`AD_PLATFORM_SETUP.md`](../../AD_PLATFORM_SETUP.md) |
| Organic publishing to Facebook/Instagram/TikTok | **Not built.** "Publish" in Content Studio records the post in the browser only | `ContentStudioView.publish()`; spec: [`backend/PublishingController.md`](backend/PublishingController.md), [`backend/PlatformConnectionController.md`](backend/PlatformConnectionController.md) |
| Ad creation | **Not built.** No campaign, ad set or creative is ever created on a platform | — |
| Tracked ad URL with platform macros | Built; the operator is told to paste it into Ads Manager themselves | `AdUrlBlock.tsx` (CVW-42 / link attribution) |
| Attribution code in captions | Built (CVW-42) | `AttributionCodeCaptions` |
| Media storage | **None server-side.** Staged media lives in the browser as a data URL | `PublishComposer` |

## 3. Options evaluated

### 3.1 Guide them (built)

CeView turns a plain-language goal into a complete ad plan and walks the operator through Ads
Manager field by field, with every value ready to copy:

- **Goal**, in the operator's words: *Get seen* (reach N people), *Get booking-page visits*
  (N visits through the tracked link) or *Get messages* (N Messenger conversations).
- **Platform**: Facebook & Instagram, or TikTok.
- **Plan**: objective name as Ads Manager shows it, location and language for the market, the
  surge window as start and end dates, ad text (the caption, which already carries the code),
  and the tracked link split into Meta's *Website URL* and *URL parameters* fields.
- **Budget estimate** from the operator's **own** past cost per 1,000 views or per click, never an
  invented benchmark (see §4).

This works for every operator today, needs no platform approval, and keeps the operator in
control of spending their money.

### 3.2 Simplified creation that publishes (not built — §6)

CeView creates the campaign itself through the Meta Marketing API / TikTok Marketing API from the
same plan. This is the stronger answer to the recommendation but needs write access to ad
accounts, platform app review, a funded ad account, and server-side media storage — none of which
exist yet.

### 3.3 "Boost post" shortcuts

Both platforms offer a one-tap promote/boost inside their own apps. It is simpler than Ads Manager
but cannot take CeView's URL parameters for attribution as reliably, and is not something CeView
can drive. The guide therefore targets Ads Manager, where every field it fills in exists.
(Whether boosts can be created through the APIs was **not verified** in this research.)

## 4. Design decisions

| Decision | Choice | Rationale |
|---|---|---|
| Where it lives | "Promote as an ad" card in Content Studio, opening a side drawer | Promotion follows writing the caption; a drawer stays open beside Ads Manager in another tab |
| Budget source | Operator's own last 12 paid weeks (`GET /api/analytics/cost-rates`) | A benchmark CeView made up would look authoritative and be wrong for Cebu. No history → no estimate, with a note saying why |
| Reach budget | Shown as "at least" | People see an ad more than once, so N views is a floor on the cost of reaching N people |
| Message ads | Meta only | The Meta flow (Engagement → Messaging apps) is well established; TikTok's equivalent was not confirmed, so the guide does not pretend to cover it |
| Schedule | The surge window (14 days from the alert's window opening; from today if already open) | Same window the attribution code and link use, so results line up |
| TikTok ad text | Shortened to ~100 characters, always keeping the code | TikTok's ad text field is short; the code is what makes a booking attributable |
| TikTok media | Warns when the staged media is an image | TikTok's own feed needs video |

## 5. What was built

| Piece | Where |
|---|---|
| Cost rates from the operator's own paid weeks (cost per 1,000 views, per click), tenant-scoped | `module4/engagement/AdCostRatesController` — `GET /api/analytics/cost-rates` |
| Ad plan logic: objective mapping, dates in Manila time, budget estimate, TikTok text shortening, availability rules, Meta and TikTok step lists | `frontend/components/module-3/3.1-content-studio/adPlan.ts` |
| "Promote as an ad" card and drawer: goal, target number, platform, plan summary, numbered steps with copy buttons, progress, links to Ads Manager and Settings → Platforms | `AdPlannerDrawer.tsx`, `ContentStudioView.tsx` |
| Tests | `AdCostRatesControllerTest`, `adPlan.test.ts`, `AdPlannerDrawer.test.tsx` |

Known limitations:

- **Ads Manager labels drift.** Field names were written against the platforms' current set-up
  flows; the drawer says to look for the same name nearby if a field has moved. Re-check them
  when either platform redesigns its flow.
- **Progress is not saved.** Ticked steps reset when the drawer closes.
- **Estimates need history.** A first-time advertiser gets no budget figure until they have
  submitted at least one week with ad spend on the Performance screen.

## 6. Not built in this session — and why

**"Simplified ad creation that publishes to Facebook or TikTok"** — CeView creating the campaign
itself — could not be built and verified here. Each blocker sits outside the codebase:

1. **Write permission on the ad account.** CeView's Meta app asks only for `ads_read`. Creating
   campaigns needs `ads_management`, and a Page-backed ad also needs Page permissions
   (`pages_show_list`, `pages_read_engagement`, and Page ad permissions). TikTok needs its
   Marketing API ad-management permission. Each is a new OAuth scope the operator must grant.
2. **Platform review.** Meta grants those permissions to real users only after **App Review** and
   **Business Verification** (calendar weeks; see `AD_PLATFORM_SETUP.md` §1). TikTok's Marketing
   API app also needs approval for ad management. None of this was available in this session.
3. **Something to test against.** Verifying ad creation means calling the live APIs with an
   authorised test account (Meta's developer sandbox ad accounts or TikTok's sandbox — to be
   confirmed when setting up). No credentials were available, so any code written now would be
   built from documentation alone and could not be shown to work.
4. **Media hosting.** An ad needs its image or video uploaded to the platform from a server. Content
   Studio keeps media only in the browser; there is no server-side media store yet. Organic
   publishing (`PublishingController`) has the same dependency and is also unbuilt.
5. **Spending safeguards.** CeView would be spending the operator's money. Before this ships, the
   design needs: campaigns created **paused** for the operator to review and switch on in Ads
   Manager, a hard spend cap, and a clear confirmation step. These are product decisions, not
   just code.

**What is already in place for it:** the plan this feature builds is exactly the payload a
creation API needs (objective, targeting, budget, schedule, text, URL with tracking parameters),
and `module4/adconnections` provides the OAuth, encrypted-token and per-operator connection
pattern to extend with write scopes.

**Unblocked by, in order:**

1. A product decision on the safeguards in point 5.
2. Server-side media storage (shared with organic publishing).
3. A Meta app (and TikTok app) configured for ad creation, with sandbox or test ad accounts, then
   App Review / Business Verification for real operators.
4. Then a spec: "create paused campaign from ad plan", Meta first, reusing `adPlan.ts` as the
   source of the payload.

## 7. Open questions

1. Should CeView ever *activate* an ad, or only create it paused? (Recommendation: paused only.)
2. Is a minimum budget guide worth adding? Platform minimums vary by currency and objective and
   were not verified here, so the guide currently states none.
3. Would operators prefer Facebook Page *boost* over Ads Manager for their first ad, even at the
   cost of weaker attribution? Worth asking in the same operator survey as CVW-42 §6.1.

## 8. References

- [`AD_PLATFORM_SETUP.md`](../../AD_PLATFORM_SETUP.md) — ad account connection, App Review, Business Verification
- [`docs/superpowers/specs/2026-09-06-ad-platform-connections-design.md`](../superpowers/specs/2026-09-06-ad-platform-connections-design.md)
- [`docs/superpowers/specs/2026-09-20-link-attribution-design.md`](../superpowers/specs/2026-09-20-link-attribution-design.md) — tracked link and URL macros
- [`docs/module-4/CONVERSION_CAPTURE_RESEARCH.md`](../module-4/CONVERSION_CAPTURE_RESEARCH.md) — CVW-42
- [`backend/PublishingController.md`](backend/PublishingController.md), [`backend/PlatformConnectionController.md`](backend/PlatformConnectionController.md)
