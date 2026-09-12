package com.ceview.module4.adconnections;

import com.ceview.module4.adconnections.AdConnectionDtos.InsightSource;
import com.ceview.module4.adconnections.AdConnectionDtos.InsightsResponse;
import com.ceview.module4.adconnections.client.AdInsightData;
import com.ceview.module4.adconnections.client.AdPlatformClient;
import com.ceview.module4.adconnections.client.AdPlatformException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Pulls one reporting period's metrics from every ACTIVE connection, caches
 * them, and reduces them to the shape the ingestion form prefills with.
 *
 * <p>Two rules make this more than a sum:
 * <ul>
 *   <li><b>One provider failing must not lose the others.</b> Each fetch is
 *       isolated; a failure becomes a warning, not an exception.</li>
 *   <li><b>Mixed currencies are never summed.</b> Adding USD spend to PHP spend
 *       produces a number that means nothing and flows straight into ROAS, so
 *       the totals are withheld and the caller is told why.</li>
 * </ul>
 *
 * <p>{@code clients} is resolved per-provider at call time via a stream filter
 * rather than injected as a ready-made {@code Map<AdProvider, AdPlatformClient>}
 * bean — see {@code AdConnectionController}'s constructor Javadoc for why: a
 * {@code Map} bean built eagerly at context-refresh time would call
 * {@code provider()} on every client bean before a test's {@code @MockBean} has
 * a chance to stub it in {@code @BeforeEach}.
 */
@Service
public class AdInsightSyncService {

    private static final Logger log = LoggerFactory.getLogger(AdInsightSyncService.class);

    private final AdPlatformConnectionRepository connectionRepo;
    private final AdInsightRepository insightRepo;
    private final AdConnectionService connectionService;
    private final List<AdPlatformClient> clients;

    public AdInsightSyncService(AdPlatformConnectionRepository connectionRepo,
                                AdInsightRepository insightRepo,
                                AdConnectionService connectionService,
                                List<AdPlatformClient> clients) {
        this.connectionRepo = connectionRepo;
        this.insightRepo = insightRepo;
        this.connectionService = connectionService;
        this.clients = clients;
    }

    @Transactional
    public InsightsResponse sync(UUID businessProfileId, LocalDate periodStart, LocalDate periodEnd) {
        return sync(businessProfileId, periodStart, periodEnd, null);
    }

    /**
     * @param onlyProviders when non-null, only these providers are synced (the
     *        operator excluded the others for this analysis). Null = every ACTIVE
     *        connection, the default.
     */
    @Transactional
    public InsightsResponse sync(UUID businessProfileId, LocalDate periodStart, LocalDate periodEnd,
                                 java.util.Set<AdProvider> onlyProviders) {
        List<AdPlatformConnection> active = connectionRepo.findByBusinessProfileIdAndStatus(
                businessProfileId, AdPlatformConnection.STATUS_ACTIVE);
        if (onlyProviders != null) {
            active = active.stream()
                    .filter(c -> onlyProviders.contains(AdProvider.fromKey(c.getProvider())))
                    .toList();
        }

        List<InsightSource> sources = new ArrayList<>();
        List<String> warnings = new ArrayList<>();

        if (active.isEmpty()) {
            warnings.add("No connected ad accounts. Connect one in Settings -> Platforms.");
            return new InsightsResponse(periodStart.toString(), periodEnd.toString(),
                    null, null, null, null, null, sources, warnings);
        }

        for (AdPlatformConnection conn : active) {
            if (conn.getExternalAccountId() == null) {
                // Defensive: an ACTIVE row should always have one.
                continue;
            }
            AdProvider provider = AdProvider.fromKey(conn.getProvider());
            AdPlatformClient client = clientFor(provider);
            if (client == null) {
                warnings.add(provider.key() + " is not configured on this server.");
                continue;
            }

            try {
                AdInsightData data = client.fetchInsights(
                        connectionService.accessTokenOf(conn),
                        conn.getExternalAccountId(),
                        conn.getExternalCampaignId(),
                        periodStart, periodEnd);

                upsertInsight(businessProfileId, conn, data, periodStart, periodEnd);

                conn.setLastSyncedAt(OffsetDateTime.now());
                connectionRepo.save(conn);

                sources.add(new InsightSource(provider.key(), conn.getExternalAccountName(),
                        data.impressions(), data.clicks(), data.spend(), data.conversions(),
                        conn.getCurrency(), conn.getExternalCampaignName()));

            } catch (AdPlatformException | IllegalStateException e) {
                log.warn("[Module4] {} sync failed for profile={}: {}",
                         provider.key(), businessProfileId, e.getMessage());
                warnings.add(provider.key() + " could not be synced: " + e.getMessage());
            }
        }

        return reduce(periodStart, periodEnd, sources, warnings);
    }

    private AdPlatformClient clientFor(AdProvider provider) {
        return clients.stream().filter(c -> c.provider() == provider).findFirst().orElse(null);
    }

    /** Writes or updates the cached row for this (profile, provider, period). */
    private void upsertInsight(UUID businessProfileId, AdPlatformConnection conn,
                               AdInsightData data, LocalDate periodStart, LocalDate periodEnd) {
        AdInsight insight = insightRepo
                .findByBusinessProfileIdAndProviderAndPeriodStartAndPeriodEnd(
                        businessProfileId, conn.getProvider(), periodStart, periodEnd)
                .orElseGet(AdInsight::new);

        insight.setBusinessProfileId(businessProfileId);
        insight.setProvider(conn.getProvider());
        insight.setExternalAccountId(conn.getExternalAccountId());
        insight.setExternalCampaignId(conn.getExternalCampaignId());
        insight.setPeriodStart(periodStart);
        insight.setPeriodEnd(periodEnd);
        insight.setImpressions(data.impressions());
        insight.setClicks(data.clicks());
        insight.setSpend(data.spend() == null ? BigDecimal.ZERO : data.spend());
        insight.setConversions(data.conversions());
        // The platform's insights payload carries no currency; the ad account's
        // own currency, captured at account-selection time, is authoritative.
        insight.setCurrency(conn.getCurrency());
        insight.setFetchedAt(OffsetDateTime.now());
        insight.setRawResponse(data.rawResponse());

        insightRepo.save(insight);
    }

    /** Combines the per-source figures, or withholds the totals if it cannot. */
    private InsightsResponse reduce(LocalDate periodStart, LocalDate periodEnd,
                                    List<InsightSource> sources, List<String> warnings) {
        if (sources.isEmpty()) {
            return new InsightsResponse(periodStart.toString(), periodEnd.toString(),
                    null, null, null, null, null, sources, warnings);
        }

        if (sources.stream().anyMatch(s -> s.currency() == null)) {
            warnings.add("One or more connected ad accounts did not report a currency, "
                    + "so their figures cannot be combined.");
            return new InsightsResponse(periodStart.toString(), periodEnd.toString(),
                    null, null, null, null, null, sources, warnings);
        }

        Set<String> currencies = sources.stream()
                .map(InsightSource::currency)
                .collect(Collectors.toSet());

        if (currencies.size() > 1) {
            warnings.add("Connected ad accounts report in different currency codes ("
                    + String.join(", ", currencies)
                    + "), so their figures cannot be combined. Use one source at a time.");
            return new InsightsResponse(periodStart.toString(), periodEnd.toString(),
                    null, null, null, null, null, sources, warnings);
        }

        long impressions = sources.stream().mapToLong(InsightSource::impressions).sum();
        long clicks      = sources.stream().mapToLong(InsightSource::clicks).sum();
        long conversions = sources.stream().mapToLong(InsightSource::conversions).sum();
        BigDecimal spend = sources.stream()
                .map(s -> s.spend() == null ? BigDecimal.ZERO : s.spend())
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        String currency = currencies.isEmpty() ? null : currencies.iterator().next();

        return new InsightsResponse(periodStart.toString(), periodEnd.toString(),
                impressions, clicks, spend, conversions, currency, sources, warnings);
    }
}
