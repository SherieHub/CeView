# Track 2 — Redirect and Click Capture

**Spec:** [`2026-09-20-link-attribution-design.md`](../../specs/2026-09-20-link-attribution-design.md) (phase 2)
**Shared contract:** [`00-index.md`](00-index.md) — read it first
**Owns exclusively:** `RedirectController`, `ClickTrackingService`, `BotFilter`, their tests

---

## Goal

Make `GET /r/{slug}` work: a traveller who clicks an ad lands on the right page, and CeView records
which **ad creative** sent them.

This is the only part of the feature that runs on a stranger's critical path. Everything downstream
— the enquiry, the rollup, the per-creative split — is worthless if this hop is slow, wrong, or
loses the ad id. Nothing else in the feature can produce a creative-attributed booking without it.

---

## Prerequisite

The foundation, already merged. Specifically you need:

| What | Where |
|---|---|
| `AttributionLink` + `findBySlug` | `module4/attribution/link/AttributionLinkRepository.java` |
| `AttributionClick` entity + repository | `module4/attribution/link/` |
| `/r/**` exempted from auth | `config/SecurityConfig.java`, `auth/ProfileCompletionFilter.java` |
| The macro strings operators actually paste | `module4/attribution/link/AdUrlBuilder.java` |
| `tbl_attribution_click` | `db/migration/V44__module4_link_attribution.sql` |

**Do not** add a migration, and **do not** touch `SecurityConfig` or `ProfileCompletionFilter` —
both are already correct and both are shared with Track 4.

No dependency on Tracks 3, 4 or 5. Track 4 owns the hosted enquiry page your redirect sends
traveller to when `destinationUrl` is null; agree the path string with them and nothing else.

---

## Modifications and implementations

### `RedirectController` — new, `module4/attribution/link/`

`GET /r/{slug}`, unauthenticated, returns `302`.

Register it at `/r/{slug}`, **not** under `/api`. `ProfileCompletionFilter` and the CORS config both
treat `/api/**` as authenticated app traffic, and this URL has to be short enough to sit inside an
ad.

Behaviour:

| Case | Response |
|---|---|
| Unknown slug | `404` |
| Known slug, `destinationUrl` set | `302` to `destinationUrl` with `cv={clickId}` appended |
| Known slug, `destinationUrl` null | `302` to the hosted enquiry page (Track 4) with `cv={clickId}` |
| Known slug, window closed | **Still `302`.** Record the click with `inWindow = false` |
| Bot | `302` as normal, but write no click row |

The closed-window case is deliberate: an ad that outlives its window is common, and 404ing a real
traveller to keep the data tidy is the wrong trade. Mark the click and let the rollup exclude it.

### `ClickTrackingService` — new

Builds and persists the `AttributionClick`, then returns the destination URL.

**Macro parsing.** Read `cmp`, `set`, `ad` into `externalCampaignId`, `externalAdsetId`,
`externalAdId`. Infer `platform`:

- any value matching TikTok's `__…__` form → `TIKTOK`
- otherwise, a numeric id present → `META`
- nothing resolved → `UNKNOWN`

**Treat unsubstituted macros as absent.** If the operator pasted the macro string somewhere the
platform doesn't expand it, the parameter arrives literally as `{{ad.id}}` or `__CID__`. That is an
untagged click, not a creative named `{{ad.id}}`. Filter both brace-wrapped and
double-underscore-wrapped literals before storing.

**Click token.** Store `fbclid` or `ttclid` in `clickToken` if present. Nothing reads it today; it
exists so a later Conversions-API tier can report the booking back. It cannot be decoded into an ad
id — do not try to use it as one.

**IP.** Hash it with a salt from configuration. Never persist the raw address. `AttributionClick`
has `ipHash` and no raw-IP column, on purpose.

**Destination assembly.** Append `cv={clickId}` correctly:

```
https://kasabeach.ph/book          → https://kasabeach.ph/book?cv=<id>
https://kasabeach.ph/book?ref=ig   → https://kasabeach.ph/book?ref=ig&cv=<id>
https://kasabeach.ph/book#deals    → https://kasabeach.ph/book?cv=<id>#deals
```

Use `UriComponentsBuilder` rather than string concatenation — the fragment case in particular is
silently wrong if you append naively.

### `BotFilter` — new

Two checks:

1. **User-agent deny-list** — at minimum `facebookexternalhit`, `Facebot`, `TikTokBot`,
   `Bytespider`, `bingbot`, `Googlebot`, plus common headless signatures. Meta and TikTok both fetch
   link previews from their own crawlers; unfiltered, every ad inflates its own click count on
   publish.
2. **Same-link, same-`ipHash` debounce** — `AttributionClickRepository.countRecentByLinkAndIp` is
   already declared for this. A crawler and a double-tapping traveller look identical here and both
   should count once. Pick a short window (60s is reasonable) and put the number in a named constant
   with a comment, not inline.

Be conservative. Over-filtering loses evidence quietly; under-filtering inflates every number on the
Performance screen, which is worse, because the operator will compare it against Ads Manager and
stop trusting the screen.

### Configuration

`ceview.attribution.base-url` already exists (`AdUrlBuilder`). Add a salt property for the IP hash
with a dev default, following how other secrets degrade gracefully in this repo — the backend must
still boot with nothing configured.

---

## Testing

### `ClickTrackingServiceTest`

| Case | Asserts |
|---|---|
| Meta macros present | all three external ids stored, `platform = META` |
| TikTok macros present | ids stored, `platform = TIKTOK` |
| No macro params | all three null, `platform = UNKNOWN`, `isUntagged()` true |
| Unsubstituted `{{ad.id}}` / `__CID__` | treated as absent, not stored as a literal |
| `fbclid` present | captured in `clickToken` |
| IP given | `ipHash` populated and **not equal** to the raw address |
| Same ip + link inside the debounce window | second call writes no row |
| Bot user-agent | no row written |
| Click after `windowEnd` | row written with `inWindow = false` |

### `RedirectControllerTest` — MockMvc, **no JWT**

Prove it works unauthenticated, since that is the whole premise:

- known slug → `302`, `Location` contains `cv=`
- destination with an existing query string → `&cv=`, exactly one `?` in the URL
- destination with a fragment → `cv=` lands before the `#`
- unknown slug → `404`
- closed-window slug → still `302`
- a request with no `Authorization` header is **not** `401` (guards against a future
  `SecurityConfig` change silently breaking every live ad)

Use `@SpringBootTest` + MockMvc, matching `AdCallbackSecurityTest` — the repo's existing test for an
unauthenticated browser-redirect endpoint. Copy its setup rather than inventing one.

---

## Documentation

You own the **configuration and operations** facts. Nobody else documents them.

### `RUNNING.md` §5 — environment variables

Add a row per variable you introduce:

| Variable | What to say |
|---|---|
| `CEVIEW_ATTRIBUTION_BASE_URL` | Public origin the redirect is served from; bound to `ceview.attribution.base-url`, defaults to `http://localhost:8080`. **This string ends up inside live paid ads** — changing it after ads are running breaks every link already in market. |
| The IP-hash salt you add | What it protects, and that rotating it resets the click debounce (existing `ip_hash` values stop matching new ones). |

### `RUNNING.md` §10 — troubleshooting

Two rows, both things a teammate will actually hit:

- **`/r/{slug}` returns 404 for a slug you can see in the database** — the slug is case-sensitive and the alphabet excludes `0/O/1/I/l`; a hand-typed slug is the usual cause.
- **The redirect takes 30+ seconds on first hit** — expected on a spun-down instance. Call out that [`render.yaml`](../../../../render.yaml) runs the Spring service on `plan: free`, and that this is **blocking for real-world use**, not a local-only annoyance: it will be cold exactly when a surge ad first runs.

### `backend/.env.example`

Add your variables with empty values and a one-line comment each, following the file's existing style. A variable documented in `RUNNING.md` but missing here is one a teammate never learns exists.

### What you do *not* document

The operator-facing "how to paste the ad URL" material — that is Track 3's. Stick to what a developer needs to run and configure the thing.

`backend/CONTRACT.md` does not cover ad-connections either and is a known, accepted gap; do not start filling it unilaterally.

---

## Definition of done

- [ ] `GET /r/{slug}` redirects and records a click, with no JWT.
- [ ] A Meta-macro URL produces a click whose `externalAdId` is the ad id, not the campaign id.
- [ ] An unsubstituted macro is recorded as untagged, never as a literal creative id.
- [ ] A destination with an existing query string or fragment is still a valid URL after `cv=` is appended.
- [ ] No raw IP appears anywhere in `tbl_attribution_click`.
- [ ] A closed-window slug still redirects, marked `inWindow = false`.
- [ ] Platform crawlers do not create click rows.
- [ ] Backend suite shows no failures beyond the 12 pre-existing ones (see below).
- [ ] No new migration, no edit to `SecurityConfig` or `ProfileCompletionFilter`.
- [ ] `RUNNING.md` §5 documents every variable you added; `backend/.env.example` lists them too.
- [ ] `RUNNING.md` §10 carries the 404-on-hand-typed-slug and cold-start rows.
- [ ] You touched only §5 and §10 of `RUNNING.md` — Track 4 owns §6 and §7.

---

## Manual exploration and testing

Automated tests cannot tell you whether a real ad platform substitutes its macros the way the docs
claim, or whether the redirect feels instant. Do this by hand at least once.

### Setup

```powershell
$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-21.0.11.10-hotspot"
cd backend\spring-boot
.\mvnw.cmd -B package -DskipTests
& "$env:JAVA_HOME\bin\java.exe" -jar target\ceview-backend-0.1.0.jar `
    --spring.profiles.active=h2 `
    --ceview.cors.allowed-origins=http://localhost:3001
```

H2 is in-memory and reseeds on every restart, so you always start clean. Console at
http://localhost:8080/h2 — JDBC `jdbc:h2:mem:ceview`, user `sa`, no password.

### Get a slug

No link exists until a surge alert fires. Either run the forecasting pipeline for a seeded operator
(log in as `ramon.delacruz@ceview.local` / `MoalboalDive2024!`, see [`RUNNING.md`](../../../../RUNNING.md)),
or insert one directly in the H2 console:

```sql
INSERT INTO tbl_attribution_link
  (link_id, business_profile_id, category, target_market, slug,
   destination_url, window_start, window_end, created_at)
SELECT RANDOM_UUID(), business_profile_id, 'Coastal & Island', 'KR', 'k3f9dqmt',
       'https://example.com/book?ref=ig',
       CURRENT_TIMESTAMP, DATEADD('DAY', 14, CURRENT_TIMESTAMP), CURRENT_TIMESTAMP
FROM tbl_business_profile LIMIT 1;
```

### Walk these by hand

1. **Plain click.** Open `http://localhost:8080/r/k3f9dqmt` in a browser. Confirm you land on the
   destination and the URL bar shows `&cv=<uuid>` — note it is `&`, because the destination already
   had `?ref=ig`. **Watch how long it takes.** On a cold JVM this is the cold-start problem the spec
   flags; on Render's free tier it is 30+ seconds and the traveller leaves.
2. **Tagged click.** Visit `.../r/k3f9dqmt?cmp=120210&set=120211&ad=120214&fbclid=IwAR2xQtest`.
   Then in the H2 console: `SELECT external_ad_id, platform, click_token, ip_hash FROM
   tbl_attribution_click ORDER BY clicked_at DESC;` — confirm `120214`, `META`, the token stored,
   and `ip_hash` **not** `127.0.0.1`.
3. **Unsubstituted macro.** Visit `.../r/k3f9dqmt?ad={{ad.id}}` (URL-encode the braces). Confirm the
   row is untagged, not a creative literally named `{{ad.id}}`.
4. **Crawler.** `curl -A "facebookexternalhit/1.1" http://localhost:8080/r/k3f9dqmt -i` — confirm a
   `302` and **no new row**.
5. **Debounce.** Hit the same slug three times quickly from one browser. Confirm one row, not three.
6. **Unknown slug.** `http://localhost:8080/r/zzzzzzzz` → `404`.
7. **Closed window.** Set `window_end` to a past date in H2, click again, confirm the redirect still
   works and `in_window` is `FALSE`.

### If you have a real ad account

Worth doing once, because it is the assumption the whole feature rests on: run a ₱100 Meta ad with
`AdUrlBuilder.metaAdUrl()`'s parameter string in the ad's **URL parameters** field, click your own
ad, and confirm the `external_ad_id` you record matches the ad id in Ads Manager. Record what you
find in this file — if Meta's macro behaviour differs from what we assumed, everything downstream
inherits the error.

---

## Automated testing for verification

```powershell
cd backend\spring-boot
.\mvnw.cmd -o test -Dtest='RedirectControllerTest,ClickTrackingServiceTest'
.\mvnw.cmd -o test
```

**The backend suite is already red on `ph2-dev`.** Expect exactly these 12 pre-existing failures,
none related to this feature:

```
ReferenceProfileIsolationTest.noProductionCodeSweepsTheProfileTableWithFindAll
MacroInputProvenanceTest (×3)
MarketDataIngestionJobForecastTriggerTest (×2)
DemandAlertRulesTest.derivesTheWindowFromTheFirstWeeklyForecastCrossing
EconomyInsightForexTest (×3)
EnsureFreshForecastTest (×2)
```

Baseline before your change is `Tests run: 355, Failures: 8, Errors: 4`. Your number of tests should
go up; failures and errors must not. If a 13th failure appears, it is yours — do not ship past it.
