# Track 3 — Operator Surfaces

**Spec:** [`2026-09-20-link-attribution-design.md`](../../specs/2026-09-20-link-attribution-design.md) (phase 3)
**Shared contract:** [`00-index.md`](00-index.md) — read it first
**Owns exclusively:** `AttributionLinkController`, the Content Studio "Ad URL" block, their tests

---

## Goal

Give the operator the URL to paste into their ad, and let them choose where it points.

**This track decides whether the feature works at all.** Every other track processes data that only
exists if the operator pasted the *macro* URL rather than the bare link. If the copy block is
unclear, clicks arrive with no ad id, and per-creative attribution silently degrades to
campaign-level — with no error, no warning, and nothing in the logs. Treat the wording as part of
the implementation.

---

## Prerequisite

The foundation, already merged:

| What | Where |
|---|---|
| `AttributionLinkService.urlsFor()` — the three copyable strings | `module4/attribution/link/AttributionLinkService.java` |
| `AttributionLinkDtos.LinkResponse`, `UpdateDestinationRequest`, `UnconvertedClickResponse` | `module4/attribution/link/AttributionLinkDtos.java` |
| Tenant-scoped lookups | `AttributionLinkRepository.findByLinkIdAndBusinessProfileId`, `findByBusinessProfileIdOrderByWindowStartDesc` |
| `apiClient.attributionLinks` + fixtures | `frontend/services/apiClient.ts`, `frontend/services/fixtures/attributionLinks.ts` |
| Types | `frontend/types.ts` — `AttributionLink`, `AttributionLinkUrls`, `UnconvertedClick` |

No dependency on Tracks 2, 4 or 5. You can build and demo the whole track in fixture mode before
Track 2's redirect exists.

---

## Modifications and implementations

### `AttributionLinkController` — new, `module4/attribution/link/`

All JWT-authenticated. Resolve the tenant with `currentBusinessProfile.resolveProfileId()`, the way
`EngagementMetricsController` does.

| Method | Path | Returns |
|---|---|---|
| `GET` | `/api/attribution/links` | `List<LinkResponse>`, newest window first |
| `PATCH` | `/api/attribution/links/{linkId}` | `LinkResponse` |
| `GET` | `/api/attribution/clicks/unconverted?from&to` | `List<UnconvertedClickResponse>` |

**Tenant scoping is not optional here.** Always use `findByLinkIdAndBusinessProfileId`. A link id
alone resolving cross-tenant would let one operator read — and repoint — another's live ad
destination, which is worse than a data leak: it is a redirect hijack.

**`PATCH` semantics.** A null or blank `destinationUrl` means "use CeView's hosted enquiry page"
(tier 2). Do not reject blank as invalid — it is the tier switch. Do validate that a non-blank value
is an absolute `http`/`https` URL; a relative or `javascript:` value would turn the redirect into an
open-redirect gadget.

**`unconverted` window.** Require `from`/`to` and cap the range server-side. An unbounded list is
useless to pick from and unbounded to render.

**`adLabel`.** `UnconvertedClickResponse` carries a label, not just an id. Today the honest value is
derived from the ad id (`"Ad 120214"`); a real creative name needs an Ads API lookup that is out of
scope. Say so in a comment rather than leaving a caller guessing why the label looks like that. For
an untagged click, `adLabel` is null and `untagged` is true — render that as its own thing, not as
an empty string.

### Content Studio — "Ad URL" block

Lives beside the generated caption in `frontend/components/module-3/3.1-content-studio/`. Follow
the existing component patterns there; consult the `tourism-app-branding` skill before styling.

It needs, in this order:

1. **The bare link** — for a caption or link-in-bio.
2. **The Meta ad URL** and **the TikTok ad URL**, each with its own copy button.
3. **One plain sentence** saying where it goes: *"Paste this into your ad's URL parameters field in
   Ads Manager — not into the caption."*

The distinction between the three strings is the entire point of the block. An operator who copies
the first one into an ad gets no creative attribution. Make the ad URLs visually primary and the
bare link secondary, and never present them as interchangeable.

Known constraint worth surfacing in the copy: **Instagram captions do not linkify.** For Instagram
the link belongs on the ad's CTA button or in link-in-bio. Do not generate copy implying a tappable
caption link.

Where an alert-derived link is unavailable (ad-hoc generation with no `demandAlertId`), render
nothing rather than an empty or disabled block.

### Settings or Performance — destination control

A small control calling `setDestination`, showing the current mode. Two states, named in the
operator's language, not ours:

- **"Send visitors to my own page"** — URL input.
- **"Use CeView's booking form"** — the hosted page (Track 4).

Place it next to the link list. Do not invent a new settings section.

---

## Testing

### `AttributionLinkControllerTest` — MockMvc with a minted JWT

Follow `AdInsightsEndpointTest` / `MetricsTenantScopingTest` for setup.

| Case | Asserts |
|---|---|
| `GET /links` | only this operator's links, newest window first |
| `GET /links` with a second operator's JWT | **none of the first operator's links** |
| `PATCH` a link the caller owns | destination updated, `hosted` false |
| `PATCH` with null/blank | `hosted` true, destination cleared |
| `PATCH` with a relative or `javascript:` URL | `400`, unchanged |
| `PATCH` **another operator's** linkId | `404` (not `403` — do not confirm the id exists) |
| `GET /clicks/unconverted` | only in-range, only this operator's, excludes already-converted |
| `GET /clicks/unconverted` with no range | `400` |

The two cross-tenant cases are the important ones. Write them first.

### Frontend — Vitest

- `apiClient.attributionLinks.list/setDestination/performance` hit the right paths in non-fixture
  mode and return fixtures in fixture mode.
- The Ad URL block renders all three strings distinctly, and each copy button copies **its own**
  string (mock `navigator.clipboard`; assert the copied value, not just that the handler fired —
  copying the wrong string is the exact bug that breaks the feature).
- No link available → nothing rendered, no crash.
- Destination control round-trips between the two modes and shows the current one.

---

## Documentation

You own the **operator-facing** material. It matters more here than on any other track: the whole
feature degrades silently when an operator pastes the wrong string, and documentation is the second
line of defence after the copy block itself.

### `LINK_ATTRIBUTION_SETUP.md` — new, repo root

Mirror [`AD_PLATFORM_SETUP.md`](../../../../AD_PLATFORM_SETUP.md)'s structure and tone; it is the
established pattern for "how to actually use an integration" in this repo, and operators and
developers already know where to look.

Cover, in this order:

1. **What this enables and what it does not.** It tracks which *ad creative* produced a booking. It
   does not publish anything, and it cannot see Messenger, phone or walk-in bookings — those are the
   promo code's job. Say this plainly; an operator who expects it to catch every booking will
   conclude it is broken.
2. **Where each of the three strings goes.** Bare link → caption or link-in-bio. Meta ad URL → Ads
   Manager's **URL parameters** field. TikTok ad URL → the TikTok equivalent. Screenshot the Ads
   Manager field if you can; this is the step that gets skipped.
3. **The braces must survive.** `{{ad.id}}` pasted as `%7B%7Bad.id%7D%7D` is never substituted and
   the feature silently fails. Say what correct looks like.
4. **Instagram captions do not linkify.** The link belongs on the ad's CTA button or in link-in-bio.
5. **How to tell it is working** — after the first clicks, the Performance screen shows per-creative
   rows rather than a single "untagged" bucket. Point at Track 5's screen.
6. **Tier 1 vs tier 2 in operator language**: "send visitors to my own page" vs "use CeView's
   booking form", and how to switch.

### `docs/module-3/screens/content-studio.md`

Document the Ad URL block where the rest of that screen is documented. Keep it developer-facing —
what renders, what it reads, what happens when no alert-derived link exists — and link out to
`LINK_ATTRIBUTION_SETUP.md` for the operator instructions rather than repeating them.

### What you do *not* document

Environment variables and the cold-start caveat are Track 2's. `RUNNING.md` §6/§7 are Track 4's.
The Module 4 feature section is Track 5's. If you need to change `RUNNING.md` at all, say so in the
PR rather than editing a section another track owns.

---

## Definition of done

- [ ] An operator can list their links and copy a working Meta or TikTok ad URL.
- [ ] A second operator's JWT cannot read or `PATCH` the first operator's link (`404`, not `403`).
- [ ] A non-absolute or `javascript:` destination is rejected.
- [ ] Blank destination switches the link to the hosted page rather than erroring.
- [ ] Each copy button copies its own string — verified by assertion, not by eye.
- [ ] The block says in plain words that the ad URL goes in Ads Manager, not the caption.
- [ ] `npm test` green; backend failures no worse than the 12 pre-existing.
- [ ] No new migration; no edit to `SecurityConfig` or `ProfileCompletionFilter`.
- [ ] `LINK_ATTRIBUTION_SETUP.md` exists and covers all six points above.
- [ ] `docs/module-3/screens/content-studio.md` documents the Ad URL block.
- [ ] The setup guide passes the same comprehension test as the block: a reader who has not seen
      this plan can say which string goes in the ad.
- [ ] You edited no section of `RUNNING.md` — §5/§10 are Track 2's, §6/§7 are Track 4's.

---

## Manual exploration and testing

The copy block is a comprehension problem, not a rendering problem. Tests cannot tell you whether
an operator understands it — so this manual pass is the real verification for this track.

### Fixture mode (no backend needed)

```powershell
cd frontend
$env:VITE_USE_FIXTURES = "true"
npm run dev     # http://localhost:3001
```

`fixtures/attributionLinks.ts` provides two links: a tier-1 one (`kasabeach.ph/book`) and a tier-2
hosted one. Check both render correctly, including the tier-2 one where `destinationUrl` is null.

### Against the real backend

```powershell
# terminal 1
$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-21.0.11.10-hotspot"
cd backend\spring-boot
& "$env:JAVA_HOME\bin\java.exe" -jar target\ceview-backend-0.1.0.jar `
    --spring.profiles.active=h2 --ceview.cors.allowed-origins=http://localhost:3001

# terminal 2
cd frontend
$env:VITE_USE_FIXTURES = "false"
npm run dev
```

Log in as `ramon.delacruz@ceview.local` / `MoalboalDive2024!`
([`SEED_CREDENTIALS.md`](../../../../backend/spring-boot/src/main/resources/db/migration/SEED_CREDENTIALS.md)).
Links only exist once a surge alert has fired — run forecasting, or insert a row via the H2 console
at http://localhost:8080/h2 (see Track 2's plan for the SQL).

### Walk these by hand

1. **Copy each of the three strings** and paste them into a text editor. Confirm you got three
   *different* strings and that the Meta one contains `{{ad.id}}` literally — braces intact, not
   URL-encoded. An encoded `%7B%7Bad.id%7D%7D` will not be substituted by Meta and the whole feature
   fails silently.
2. **Switch the destination** to `https://example.com/book`, reload, confirm it persisted and the
   mode label changed.
3. **Switch it back to hosted**, confirm it returns to the CeView form mode.
4. **Try to break it:** paste `javascript:alert(1)` and `/relative/path`. Both must be rejected with
   a visible message.
5. **Cross-tenant check by hand.** Log in as a second seeded operator in a private window. Confirm
   you see none of Ramon's links. Then, with the second operator's token, `curl` a `PATCH` against
   Ramon's `linkId` and confirm `404`.
6. **The comprehension test — do this one properly.** Show the block to someone who has not read
   this plan. Ask: *"Which of these goes in the ad?"* If they hesitate or pick the bare link, the
   copy is wrong. Fix the wording and ask someone else. This catches the failure mode no automated
   test can.

---

## Automated testing for verification

```powershell
cd backend\spring-boot
.\mvnw.cmd -o test -Dtest='AttributionLinkControllerTest'
.\mvnw.cmd -o test

cd ..\..\frontend
npx vitest run
npx tsc --noEmit
npm run build
```

**Backend baseline:** `Tests run: 355, Failures: 8, Errors: 4` — 12 pre-existing failures in
`EconomyInsightForexTest`, `EnsureFreshForecastTest`, `MacroInputProvenanceTest`,
`MarketDataIngestionJobForecastTriggerTest`, `DemandAlertRulesTest`, `ReferenceProfileIsolationTest`.
Yours must not add a 13th.

**Frontend baseline:** 555 passing, 0 failing — keep it fully green. `tsc --noEmit` has 2
pre-existing errors in `DemandForecastChart.tsx` and `CalendarView.tsx`; add none.
