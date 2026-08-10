# Schema delta — fields the onboarding wizard needs

The UI/UX overhaul's [Onboarding Wizard](../screens/onboarding-wizard.md) collects fields that
`tbl_business_profile` and `BusinessProfileDto` do not currently carry. This is a **specification**,
not yet implemented — flagged so a future backend plan can act on it.

## Already present (no change needed)

`business_name`, `description`, `uvp`, `core_services` (comma-joined), `categories` (comma-joined),
`uniqueness_score`, `semantics_score`, `category_score`, `image_preview`.

## New columns required

| Column | Type | Source step | Notes |
|---|---|---|---|
| `slogan` | `TEXT`, nullable | Onboarding step 1 / Settings | Free text, optional |
| `industry` | `TEXT`, nullable | Onboarding step 1 | One of the seven `BUSINESS_CATEGORIES`; distinct from `categories` (the multi-select classifier result) — this is the operator's self-declared *primary* category, collected before classification even runs |
| `vibes` | `TEXT[]` or comma-joined `TEXT` | Onboarding step 2 | Multi-select from the fixed 8-item `VIBES` list — feeds Content Studio caption tone |
| `website` | `TEXT`, nullable | Onboarding step 4 / Settings | Free text URL, not validated as a real URL in the prototype |
| `logo` | `TEXT` (base64 or, preferably, an object-storage reference) | Onboarding step 4 | Prototype stores raw base64 client-side (`FileReader.readAsDataURL`) — **do not** carry that pattern into the real backend; store an object-storage URL instead and update the frontend upload flow accordingly when this ships |
| `socials` | JSON or a side table | Onboarding step 4 | Per-platform handle strings (`instagram`, `facebook`, `tiktok`, `naver`); a non-empty handle here should also seed a row in the platform-connections mechanism described in [`docs/module-3/backend/PlatformConnectionController.md`](../../module-3/backend/PlatformConnectionController.md) — though a typed handle is not the same as an OAuth grant, so the frontend must not claim the platform is "connected" from this alone |

## DTO impact

`BusinessProfileDto` (Java record) gains the corresponding fields. `ProfileData` /
`AnalyzeRequest`/`UniquenessRequest` payloads on the frontend (`ceview/types.ts`) gain matching
fields — see the [Fixture Data Layer card](../../superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/01-foundation.md#card--foundation-fixture-data-layer).

## Migration

A new Flyway migration (`V3__module1_onboarding_fields.sql` or next available version) adds the
columns above to `tbl_business_profile`. Until it lands, the frontend's onboarding wizard writes
these fields into `ProfileContext` only (client-side state) and the fixture-backed `apiClient` layer
described in the frontend plan's Phase 8 — real persistence is deferred.
