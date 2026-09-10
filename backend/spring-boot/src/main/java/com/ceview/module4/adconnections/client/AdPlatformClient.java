package com.ceview.module4.adconnections.client;

import com.ceview.module4.adconnections.AdConnectionDtos.AdAccountOption;
import com.ceview.module4.adconnections.AdProvider;

import java.time.LocalDate;
import java.util.List;

/**
 * Everything CeView needs from one ad platform. Two implementations —
 * {@link MetaAdsClient} and {@code TikTokAdsClient} — and nothing above this
 * interface knows which platform it is talking to.
 *
 * <p>Implementations are synchronous and throw {@link AdPlatformException} on
 * any failure; callers decide whether that is fatal.
 */
public interface AdPlatformClient {

    AdProvider provider();

    /** The consent-screen URL to send the operator's browser to. */
    String buildAuthorizeUrl(String state);

    /** Trades the one-time authorization code for a usable, long-lived token. */
    TokenGrant exchangeCode(String code);

    /** The ad accounts this grant can read. */
    List<AdAccountOption> listAccounts(String accessToken);

    /** Account-level metrics for one closed reporting period, inclusive of both dates. */
    AdInsightData fetchInsights(String accessToken, String externalAccountId,
                                LocalDate periodStart, LocalDate periodEnd);
}
