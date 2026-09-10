package com.ceview.module4.adconnections;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;

/**
 * Request and response shapes for the ad-connection endpoints.
 *
 * <p>Nothing here carries a token, encrypted or otherwise. That is a deliberate
 * invariant, asserted by {@code AdConnectionListTest.neverLeaksTokensToTheClient}.
 */
public final class AdConnectionDtos {

    private AdConnectionDtos() {}

    /** Status reported to the UI when no row exists for a provider. */
    public static final String STATUS_DISCONNECTED = "DISCONNECTED";

    /**
     * One row of GET /api/ad-connections.
     *
     * @param configured whether THIS SERVER has credentials for the provider —
     *                   distinct from whether this operator has connected it
     * @param status     DISCONNECTED, PENDING_ACCOUNT_SELECTION, ACTIVE, or REVOKED
     */
    public record AdConnectionView(
            String provider,
            boolean configured,
            String status,
            String accountName,
            String currency,
            OffsetDateTime connectedAt,
            OffsetDateTime lastSyncedAt,
            String campaignId,           // null = whole account; the pinned scope
            String campaignName          // display name for campaignId
    ) {}

    /** POST /api/ad-connections/{provider}/authorize response. */
    public record AuthorizeUrlResponse(String authorizeUrl) {}

    /** One selectable ad account, from GET /{provider}/accounts. */
    public record AdAccountOption(String id, String name, String currency) {}

    /** One selectable campaign, from GET /{provider}/campaigns. */
    public record AdCampaignOption(String id, String name, String status) {}

    /** POST /{provider}/account request body. */
    public record SelectAccountRequest(String externalAccountId) {}

    /** POST /{provider}/campaign request body. A null id clears the selection. */
    public record SelectCampaignRequest(String externalCampaignId) {}

    /** What one provider contributed to a sync. */
    public record InsightSource(
            String provider,
            String accountName,
            long impressions,
            long clicks,
            BigDecimal spend,
            long conversions,
            String currency,
            String campaignName          // null = whole account
    ) {}

    /**
     * GET /api/ad-connections/insights response.
     *
     * <p>{@code impressions}/{@code clicks}/{@code spend}/{@code conversions} are
     * the combined figures the ingestion form prefills with. They are only
     * populated when every source shares a currency — otherwise the totals are
     * null, {@code warnings} explains why, and the UI offers per-source prefill
     * instead of a silently wrong sum.
     */
    public record InsightsResponse(
            String periodStart,
            String periodEnd,
            Long impressions,
            Long clicks,
            BigDecimal spend,
            Long conversions,
            String currency,
            List<InsightSource> sources,
            List<String> warnings
    ) {}
}
