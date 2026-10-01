# Track 4 — Hosted Enquiry (Tier 2)

**Spec:** [`2026-09-20-link-attribution-design.md`](../../specs/2026-09-20-link-attribution-design.md) (phase 4)
**Shared contract:** [`00-index.md`](00-index.md) — read it first
**Owns exclusively:** `EnquiryService`, `EnquiryController`, the public enquiry page, their tests

---

## Goal

Let a traveller who clicked an ad book without the operator instrumenting anything.

This is the only path that produces a **machine-observed** conversion. Every other route to a
booking depends on the operator logging it by hand, which is the recall problem the whole attribution
effort exists to work around. It also makes the feature usable by operators who have no website at
all — which, per the research behind the complementary promo-code spec, is most of them.

---

## Prerequisite

The foundation, already merged:

| What | Where |
|---|---|
| `AttributionEnquiry` entity + repository (`existsByClickId`) | `module4/attribution/link/` |
| `AttributionClick` lookup by id | `AttributionClickRepository.findByClickId` |
| `AttributionRedemption` with `source='LINK'` + `attributionClickId` | `module4/attribution/AttributionRedemption.java` |
| `existsByAttributionClickId` guard | `AttributionRedemptionRepository` |
| `AttributionLinkDtos.EnquiryRequest` / `EnquiryAck` | `module4/attribution/link/AttributionLinkDtos.java` |
| `/api/public/attribution/**` exempted from auth | `config/SecurityConfig.java`, `auth/ProfileCompletionFilter.java` |
| `AttributionWindow.covers(...)` | `module4/attribution/AttributionWindow.java` |

**Do not** add a migration, and **do not** touch `SecurityConfig` or `ProfileCompletionFilter` —
both are already correct and shared with Track 2.

**Coordinate one thing with Track 2:** the path of your hosted page. Their redirect sends the
traveller there when a link's `destinationUrl` is null. Agree the string, nothing else.

---

## Correction to the spec — read before you start

The spec says the enquiry "raises an in-app notification". **There is no generic notification
store.** `NotificationService.getNotificationsForProfile` assembles `NotificationsResponse` by
reading `tbl_demand_alert` directly, and `getKeywordTrendNotifications` does the same against
`tbl_keyword_trend_alert`. `NotificationDto` is shaped around markets and alerts —
`market`, `trend`, `upliftPct`, `windowOpenDate` — and an enquiry fits none of it.

**Do this instead**, following the `keyword-trends` precedent exactly: a third notification source
backed by its own table, with its own endpoint and its own shape.

- `GET /api/attribution/enquiries` — JWT, tenant-scoped, a pure read of `tbl_attribution_enquiry`
  via `findByBusinessProfileIdOrderByCreatedAtDesc`.
- Its own DTO. Do not contort `NotificationDto`.
- The frontend surfaces it wherever notifications already appear.

The table already exists; you are adding the read path, not schema. Amend the spec's Components
section when you land this.

---

## Modifications and implementations

### `EnquiryController` — new, `module4/attribution/link/`

Two endpoints, with **opposite** auth postures — keep that distinction visible in the code:

| Method | Path | Auth |
|---|---|---|
| `POST` | `/api/public/attribution/enquiries` | **public** |
| `GET` | `/api/attribution/enquiries` | JWT, tenant-scoped |

The public one takes `EnquiryRequest` (already defined, already `@Valid`-annotated) and returns
`EnquiryAck`.

**`EnquiryAck` is deliberately thin — keep it that way.** It confirms receipt and nothing else: no
enquiry id, no business details, no echo of the submission. This endpoint answers to anyone on the
internet, so every field it returns is a field an attacker can enumerate.

### `EnquiryService` — new

**Validate the `clickId` properly.** It is the only thing tying a submission to an ad, and the only
thing stopping this endpoint being posted to blind. Checking it is a well-formed UUID is not
validation. Require all of:

1. The click resolves (`findByClickId`).
2. Its link's window covers now — `AttributionWindow.covers(...)`.
3. No enquiry exists for it — `existsByClickId`.
4. No redemption exists for it — `existsByAttributionClickId`.

Fail all of these the same way: a generic `400`. Do not distinguish "unknown click" from "already
used" in the response — that difference is an oracle for probing valid click ids.

Rate limit on IP hash, reusing whatever Track 2 lands for `BotFilter`; coordinate rather than
building a second mechanism.

**One transaction** writes three things:

1. the `AttributionEnquiry`,
2. an `AttributionRedemption` with `source = SOURCE_LINK`, `attributionClickId` set,
   `eventAt = now`, `bookings = 1`, `revenue = 0`,
3. nothing else — the operator-facing read is the `GET` endpoint above.

Revenue is zero on purpose: an enquiry is not a confirmed peso amount, and inventing one would
corrupt ROAS on the Performance screen. Track 5 renders conversions and revenue as separate columns
precisely so an enquiry can count as one without faking the other. The operator can attach a real
amount later through the promo-code spec's logging flow.

The click carries `businessProfileId` and the code link comes via the click's link — resolve, don't
trust anything in the request body beyond `clickId` and the traveller's own fields.

### Public enquiry page — frontend

A public, unauthenticated route. **No app chrome, no sidebar, no login prompt** — the person looking
at it has never heard of CeView and is trying to book a room.

- Reads `cv` from the query string. Missing or malformed `cv` → a plain "this link has expired"
  page, never a stack trace or a raw error.
- Fields per `AttributionEnquiryInput`: name and contact required; party size, dates, message
  optional.
- Shows the **operator's business name** and nothing else about them. No other tenant data belongs
  on a page served to the public.
- On success, a plain confirmation. On failure, one neutral message — matching the deliberately
  undifferentiated backend errors above.
- Mobile-first. Essentially every visitor arrives from Instagram or TikTok on a phone, frequently
  through an in-app browser. Test at 360px width.

Consult the `tourism-app-branding` skill before styling.

---

## Testing

### `EnquiryControllerTest` — MockMvc, mostly **without** a JWT

| Case | Asserts |
|---|---|
| Valid in-window `clickId` | `200`; enquiry + `LINK` redemption both persisted |
| The redemption | `attributionClickId` set, `bookings = 1`, `revenue = 0`, `source = LINK` |
| Unknown `clickId` | `400`, nothing persisted |
| Out-of-window `clickId` | `400`, nothing persisted |
| Duplicate submit, same `clickId` | `400`; still exactly **one** enquiry and one redemption |
| Unknown vs. already-used | **identical** response body and status |
| Missing `contactName` / `contactValue` | `400` |
| `partySize = 0` or `501` | `400` |
| No `Authorization` header | **not** `401` — guards against a `SecurityConfig` change breaking live ads |
| Rate limit exceeded | `429` |
| `GET /api/attribution/enquiries`, second operator's JWT | none of the first operator's enquiries |

Atomicity is worth its own test: force a failure on the redemption write and assert **no** orphan
enquiry row survives.

### Frontend — Vitest

- Valid `cv` renders the form; missing `cv` renders the expired state, no crash.
- Required-field validation before submit.
- Success and failure states both render.
- The page renders nothing about the operator beyond the business name.

---

## Documentation

You own `RUNNING.md` **§6 and §7**, and the reason is not housekeeping — **your track invalidates a
security claim the document currently makes.**

### `RUNNING.md` §6 — the opening sentence is about to become false

It reads today:

> The app requires login — every screen is gated behind a Sign In page, and every `/api/**` backend
> route requires a valid JWT.

Your public enquiry page breaks the first half and `POST /api/public/attribution/enquiries` breaks
the second. Left as-is, a teammate auditing the app's security posture reads a flat statement that
no longer holds, and either trusts it wrongly or assumes the exemption is a bug and "fixes" it —
which would break every live ad.

Rewrite it to state the rule *and* its exceptions precisely:

- Every **operator-facing** screen is gated behind Sign In.
- Every `/api/**` route requires a JWT **except** the deliberately public ones:
  `/api/auth/**`, `/api/ad-connections/*/callback` (a browser redirect from Meta/TikTok, no header
  to carry), and `/api/public/attribution/**` (a traveller who has never heard of CeView).
- `/r/**` sits outside `/api` entirely and is public by design.
- Each exemption carries its own tenancy mechanism rather than relying on a JWT: an OAuth state
  token, a random slug, an in-window click id. Say which, so the pattern is legible rather than
  looking like three holes.

### `RUNNING.md` §7 — the verification step

§7 currently tells the reader to confirm `curl /api/business-profile` without a header returns
`401`. Keep that, and add the counterpart: confirm the enquiry endpoint and `/r/{slug}` **do not**
401 without a header. Both directions are the check — "everything is locked down" and "these three
things are deliberately not" are each verifiable, and only testing one of them is how an exemption
gets silently removed later.

Add the public enquiry page to §7's walkthrough as its own short step, since it is the one screen
you reach *without* logging in.

### What you do *not* document

`RUNNING.md` §5 and §10 are Track 2's — coordinate with them if your rate limiter adds a variable
rather than editing §5 yourself. Operator-facing material is Track 3's. The Module 4 feature section
is Track 5's.

### The spec amendment

Land the notification correction from the section above into
[`the spec's Components table`](../../specs/2026-09-20-link-attribution-design.md) when you ship. A
correction discovered in implementation and left only in a plan file is a correction the next reader
of the spec never sees.

---

## Definition of done

- [ ] A traveller with a valid in-window `cv` can submit and gets a confirmation.
- [ ] One transaction writes enquiry + `LINK` redemption, or neither.
- [ ] A double-submit produces exactly one booking.
- [ ] Unknown, expired and already-used click ids are indistinguishable in the response.
- [ ] The endpoint is rate limited.
- [ ] The public page shows no operator data beyond the business name, and works at 360px.
- [ ] `GET /api/attribution/enquiries` is tenant-scoped and has its own DTO — `NotificationDto` untouched.
- [ ] The spec's Components section is amended to record the notification correction.
- [ ] `npm test` green; backend failures no worse than the 12 pre-existing.
- [ ] No new migration; no edit to `SecurityConfig` or `ProfileCompletionFilter`.
- [ ] `RUNNING.md` §6 no longer claims every screen and every `/api/**` route is authenticated, and
      names each exemption with the tenancy mechanism that replaces the JWT.
- [ ] `RUNNING.md` §7 verifies **both** directions: protected routes 401 without a header, and the
      public ones do not.
- [ ] The public enquiry page appears in §7's walkthrough.
- [ ] You touched only §6 and §7 of `RUNNING.md` — Track 2 owns §5 and §10.

---

## Manual exploration and testing

Two things automated tests will not catch: whether the page is usable on a phone from an in-app
browser, and whether an operator ever notices the enquiry arrived. The second is a known,
unmitigated product risk — see below.

### Setup

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

You need a click id. If Track 2 has landed, click `http://localhost:8080/r/<slug>` and take the
`cv=` value out of the URL bar. If not, insert a link and a click directly in the H2 console
(http://localhost:8080/h2, JDBC `jdbc:h2:mem:ceview`, user `sa`, no password) — Track 2's plan has
the link SQL; add a matching `tbl_attribution_click` row and note its `click_id`.

### Walk these by hand

1. **Happy path.** Open the enquiry page with `?cv=<clickId>`, submit, confirm the acknowledgement.
   Then in H2: `SELECT * FROM tbl_attribution_enquiry;` and
   `SELECT source, bookings, revenue, attribution_click_id FROM tbl_attribution_redemption;` —
   expect one row each, `LINK`, `bookings = 1`, `revenue = 0`.
2. **Double submit.** Press back and submit again. Confirm the error, and confirm the counts in H2
   are still one and one.
3. **Bad `cv`.** Try a random UUID, then no `cv` at all. Both should give a plain expired/error page
   — no stack trace, no JSON blob, no mention of whether the id existed.
4. **Expired window.** Set the link's `window_end` to the past in H2 and submit again. Confirm
   rejection, and confirm the message is **identical** to the unknown-id case.
5. **Phone.** DevTools device emulation at 360px. Then open it on an actual phone over your LAN.
   Check the keyboard does not cover the submit button and the date pickers are usable — this is
   where in-app browsers usually fall apart.
6. **Operator side.** Log in as the operator (`ramon.delacruz@ceview.local` /
   `MoalboalDive2024!`) and confirm the enquiry is visible, with the traveller's contact details.
7. **Cross-tenant.** Log in as a second seeded operator in a private window. Confirm the enquiry is
   **not** visible.
8. **The risk worth measuring.** Time how long it takes an operator who is not watching for it to
   notice the enquiry. There is no email — the backend has no mail capability and adding one is out
   of scope — so a missed enquiry is a lost booking. **Do not solve this by pulling in a mail
   dependency.** Write down what you observe, so the deferred email spec is argued from evidence.

---

## Automated testing for verification

```powershell
cd backend\spring-boot
.\mvnw.cmd -o test -Dtest='EnquiryControllerTest'
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
