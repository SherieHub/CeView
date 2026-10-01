# Ad Campaign Selection — report on one campaign, not the whole account

**Date:** 2026-09-11
**Status:** Approved design, ready for implementation planning
**Module:** 4 (Campaign Analytics & Reporting) — extends the ad-platform connections feature
**Builds on:** [`2026-09-06-ad-platform-connections-design.md`](2026-09-06-ad-platform-connections-design.md)

---

## Problem

The ad-platform connections feature ([`AdConnectionController`](../../../backend/spring-boot/src/main/java/com/ceview/module4/adconnections/AdConnectionController.java), shipped in `4a0b53fe`) pulls **account-level** metrics: `MetaAdsClient.fetchInsights` calls `/{ad-account-id}/insights` with `level=account`, which collapses every campaign, ad set, and ad in the account into one row. The four synced figures — impressions, clicks, spend, conversions — are the sum of everything the account ran in the period.

An MSME often runs more than one campaign on a single ad account at the same time — a seasonal promotion alongside an always-on brand campaign, say. CeView's Performance screen treats one ingestion as one campaign and scores it with PES. Feeding it the account total mixes unrelated campaigns into that single score, and the operator has no way to say "score just the dry-season promo."

## Goal

An operator who has connected an ad account can, in Settings → Platforms, choose to report on **one specific campaign** from that account instead of the whole account. Every subsequent sync — the Performance screen's "Sync from ad accounts" button — pulls that campaign's impressions, clicks, spend, and conversions. The choice is a standing preference, changed only when the operator changes it.

## Non-goals

- **Ad-set or individual-ad selection.** Campaign is the unit that maps to what CeView already calls a "campaign". Deeper levels can be layered onto the same mechanism later if an operator needs them.
- **Multiple campaigns at once.** Single-select: whole account, or exactly one campaign.
- **Per-sync override.** The choice lives on the connection, not the ingestion form. Week-to-week switching can be added later if it is actually requested.
- **Scheduled polling.** Unchanged from the parent spec.
- **Rewriting historical `tbl_ad_insight` rows when the scope changes.** A re-sync of a past period refreshes it under the new scope; old cached rows are left as they were.
- **Currency conversion.** Unchanged.

---

## Design decisions

| Decision | Choice | Rationale |
|---|---|---|
| Selection granularity | Campaign only | Natural unit for "track this promo"; 1:1 with CeView's own "campaign" concept |
| Selection cardinality | Single (whole account OR one campaign) | The use case is isolation, not aggregation of a subset |
| Where the choice lives | On `AdPlatformConnection`, set in Settings | The intent is stable; mirrors the existing "select ad account" step; keeps the sync button one click |
| How the filter reaches the API | Optional `externalCampaignId` param on the existing `fetchInsights` | Smallest change, one code path — the metric parsing is identical whether the response is account- or campaign-scoped |
| Meta request shape | Keep `level=account`, add `filtering=[campaign.id IN [id]]` | Preserves the single-row `data.get(0)` contract the current parser relies on |
| Insight cache key | Unchanged — `(profile, provider, period_start, period_end)` | A connection reports one scope at a time, so a period still has exactly one cached row |
| Stale campaign id (deleted on platform) | `POST /campaign` re-validates against a live list; a sync against a vanished campaign returns zeros + a warning | Same defensive posture as `selectAccount` |
| Provider parity | Meta and TikTok both | The `AdPlatformClient` interface is already symmetric; TikTok stays hand-verified like the rest of the feature |

---

## Architecture

### Data model

Two nullable columns on `tbl_ad_platform_connection` (migration **V28** + the `db/h2` runtime-profile mirror):

| Column | Meaning |
|---|---|
| `external_campaign_id` (varchar 128, null) | `null` = whole account (today's behaviour, unchanged default) |
| `external_campaign_name` (varchar 256, null) | Cached for display, exactly as `external_account_name` already is |

One nullable column on `tbl_ad_insight`:

| Column | Meaning |
|---|---|
| `external_campaign_id` (varchar 128, null) | Traceability — which scope produced this cached row |

No new `status` values. A connection with a campaign selected is still `ACTIVE`. The `uq_ad_insight_period` unique constraint is unchanged.

### `AdPlatformClient` interface

```java
/** The campaigns on one ad account. */
List<AdCampaignOption> listCampaigns(String accessToken, String externalAccountId);

/** Account-level metrics, OR one campaign's when externalCampaignId is non-null. */
AdInsightData fetchInsights(String accessToken, String externalAccountId,
                            String externalCampaignId,   // NEW, nullable
                            LocalDate periodStart, LocalDate periodEnd);
```

New DTO `AdCampaignOption(String id, String name, String status)` in `AdConnectionDtos` — `status` so the picker can show `ACTIVE` / `PAUSED`.

**MetaAdsClient**
- `listCampaigns` → `GET /{account}/campaigns?fields=id,name,status`, reusing the cursor-follow loop and `MAX_PAGES` cap already in `listAccounts`.
- `fetchInsights` → when `externalCampaignId != null`, add
  `filtering=[{"field":"campaign.id","operator":"IN","value":["<id>"]}]`.
  `level` stays `account`; the response is still a single row and `data.get(0)` still holds.

**TikTokAdsClient**
- `listCampaigns` → `GET /campaign/get/?advertiser_id=<id>` (id/name/operation_status).
- `fetchInsights` → the report request's `filtering` gains a `campaign_ids` `IN` clause.

### Endpoints — two new, mirroring the account pair

| Method | Path | Body / params | Returns |
|---|---|---|---|
| `GET` | `/api/ad-connections/{provider}/campaigns` | — | `List<AdCampaignOption>` for the connection's selected account; `409` if no account is selected yet, `502` on a provider error (same mapping as `/accounts`) |
| `POST` | `/api/ad-connections/{provider}/campaign` | `{ "externalCampaignId": string \| null }` | Updated `AdConnectionView`. `null` clears the selection back to whole account. A non-null id is re-fetched via `listCampaigns` and rejected with `400` if it is not in the live list — the client-supplied name is never trusted. |

`AdConnectionView` and `InsightSource` each gain a nullable `campaignName` field.

### Sync flow

`AdInsightSyncService.sync` passes `conn.getExternalCampaignId()` into `client.fetchInsights(...)`. `upsertInsight` writes `external_campaign_id` onto the `AdInsight` row. `InsightSource.campaignName` is populated from `conn.getExternalCampaignName()`. The reduce step — per-source rows, currency-mismatch withholding, the combined totals — is untouched. A selected campaign with no delivery in the period returns zeros, exactly as an empty account does today.

### Frontend

- **`types.ts`** — `AdConnection` gains `campaignName: string | null`; new `AdCampaignOption { id; name; status }`; `AdInsightSummary['sources'][number]` gains `campaignName?: string | null`.
- **`services/apiClient.ts`** — the `adConnections` group gains `campaigns(provider)` and `selectCampaign(provider, campaignId | null)`.
- **`services/useAdConnections.ts`** — exposes the two new calls; `hasActive` is unchanged.
- **`components/settings/AdAccountsSection.tsx`** — for an `ACTIVE` connection, render a line: **"Reporting on: Whole account"** or **"Reporting on: ‹campaign name›"**, with a **Change** button.
- **`components/settings/AdCampaignPickerModal.tsx`** (new, parallel to `AdAccountPickerModal.tsx`) — a radio list of the account's campaigns with a **"Whole account"** option pinned at the top; **Save** calls `selectCampaign`.
- **`components/module-4/4.1-campaign-analytics/IngestionForm.tsx`** — the existing sync note uses `source.campaignName` when present: *"Filled from Meta (Dry-Season Promo)"*
- **`services/fixtures/adConnections.ts`** — add `MOCK_AD_CAMPAIGNS`; give the connected Meta row a `campaignName`.

### Error handling

- **No account selected** when `/campaigns` is called → `409`, same as `/accounts` on a bare connection.
- **Provider API failure** listing campaigns → `502`, surfaced in the picker modal as "Couldn't load campaigns."
- **Selected campaign deleted on the platform** → not caught at selection time (it was valid then); the next sync's `fetchInsights` returns no rows → zeros + a per-source warning, consistent with the empty-account path.
- **Unknown campaign id posted** → `400`, re-validated against the live list.

### Testing

- **Backend (MockWebServer, existing `okhttp3 mockwebserver` pattern):**
  - `MetaAdsClient` / `TikTokAdsClient` parse a campaign-list payload; `fetchInsights` with a non-null campaign id sends the filter param and still parses a single metrics row.
  - `AdConnectionController` — `GET /{provider}/campaigns` returns the list; `POST /{provider}/campaign` re-validates and rejects an unknown id; `null` clears the selection; the view carries `campaignName`.
  - `AdInsightSyncService` — a connection with a campaign selected calls `fetchInsights` with that id and writes `external_campaign_id` on the cached row.
- **Frontend (Vitest):** `AdCampaignPickerModal` renders the list plus "Whole account" and Save calls the API; `AdAccountsSection` shows the current scope and opens the modal; the `IngestionForm` sync note names the campaign.
- **e2e:** `e2e/tests/settings-platforms.spec.ts` gains fixture-mode coverage of the "Reporting on" row and the picker. The OAuth round-trip stays hand-verified.
- TDD throughout — every test watched to fail first.

---

## Scope summary

**In:** campaign-level single-select reporting scope, stored per connection, chosen from the Performance screen (see Revision below), for both Meta and TikTok; campaign name surfaced in the ingestion sync note; V28 migration + H2 mirror.

**Out:** ad-set / ad level, multiple campaigns, scheduled polling, rewriting historical `tbl_ad_insight` rows on a scope change, currency conversion.

---

## Revision 2026-09-11 — the picker lives on the Performance screen, not Settings

After the first build, the campaign choice was moved out of Settings → Platforms and onto the Performance screen, beside **"Sync from ad accounts"**. The persistence model is unchanged (`external_campaign_id` on the connection is still the source of truth); only where it is set changed.

**What changed vs. the sections above:**

- **No picker in Settings.** `AdAccountsSection` no longer renders a "Reporting on / Change" line and takes no `onChangeCampaign` prop; `AdCampaignPickerModal` is deleted.
- **Per-provider selector on the ingestion form.** For every `ACTIVE` connection, `IngestionForm` renders a `<select>` labelled `‹Provider› campaign` — `Whole account` plus that account's campaigns (fetched via `GET /{provider}/campaigns`). Its initial value is the connection's saved `campaignId`.
- **Choose-at-sync, remembered.** On **Sync**, for each provider whose selection differs from the stored `campaignId`, the form calls `POST /{provider}/campaign` to persist it, then calls `GET /api/ad-connections/insights` as before (which reads the now-current scope). The choice is therefore both applied to this sync and kept as the default for next time. `GET /insights` itself is unchanged — no new query params.
- **`AdConnectionView` gains `campaignId`** (alongside `campaignName`) so the selector can pre-select the saved scope by id rather than by name.
- **Multiple providers:** one selector each. Meta and TikTok connected → two selects; only the changed ones are persisted on Sync.
- **Per-provider inclusion.** Each selector's first option is **"Don't include"** — the operator can build a Meta-only or TikTok-only analysis. `GET /api/ad-connections/insights` gains an optional `providers` query param (comma-separated); absent = every connected account (unchanged default), a list = only those. `AdInsightSyncService.sync` gains a 4-arg overload taking `Set<AdProvider>` (null = all). The Sync button is disabled when every account is set to "Don't include".

Backend endpoints, `AdConnectionService.selectCampaign`, both clients, and the V28 schema are otherwise exactly as specified above.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
