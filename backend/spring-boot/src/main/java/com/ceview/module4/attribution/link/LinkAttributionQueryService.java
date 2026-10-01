package com.ceview.module4.attribution.link;

import com.ceview.module4.attribution.AttributionRedemption;
import com.ceview.module4.attribution.AttributionRedemptionRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Service
@Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
public class LinkAttributionQueryService {
    private final AttributionLinkRepository links;
    private final AttributionClickRepository clicks;
    private final AttributionRedemptionRepository redemptions;

    public LinkAttributionQueryService(AttributionLinkRepository links,
            AttributionClickRepository clicks,
            AttributionRedemptionRepository redemptions) {
        this.links = links;
        this.clicks = clicks;
        this.redemptions = redemptions;
    }

    private static String key(String value) {
        return value == null || value.isBlank() ? null : value;
    }

    private static final class Bucket {
        long clicks;
        long conversions;
        BigDecimal revenue = BigDecimal.ZERO;
    }

    public AttributionLinkDtos.LinkPerformanceResponse performance(
            UUID profileId, UUID linkId) {
        var link = links.findByLinkIdAndBusinessProfileId(linkId, profileId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Attribution link not found"));
        Map<String, Bucket> buckets = new HashMap<>();
        for (var count : clicks.countClicksByCreative(linkId)) {
            buckets.computeIfAbsent(key(count.getAdId()), k -> new Bucket())
                    .clicks += count.getClicks();
        }
        Map<UUID, AttributionClick> eligible = new HashMap<>();
        for (var click : clicks.findByLinkIdOrderByClickedAtDesc(linkId)) {
            if (!profileId.equals(click.getBusinessProfileId())) {
                throw new IllegalStateException("Attribution click tenant mismatch");
            }
            if (click.isInWindow()) eligible.put(click.getClickId(), click);
        }
        if (!eligible.isEmpty()) {
            var rows = redemptions.findByAttributionClickIdIn(
                    new ArrayList<>(eligible.keySet()));
            for (var redemption : rows) {
                if (!profileId.equals(redemption.getBusinessProfileId())) {
                    throw new IllegalStateException("Attribution redemption tenant mismatch");
                }
                if (!AttributionRedemption.SOURCE_LINK.equals(redemption.getSource())) continue;
                var click = eligible.get(redemption.getAttributionClickId());
                if (click == null) continue;
                var bucket = buckets.computeIfAbsent(key(click.getExternalAdId()), k -> new Bucket());
                bucket.conversions += redemption.getBookings();
                bucket.revenue = bucket.revenue.add(redemption.getRevenue());
            }
        }
        var rows = buckets.entrySet().stream().map(entry -> {
            String adId = entry.getKey();
            var b = entry.getValue();
            return new AttributionLinkDtos.CreativePerformance(adId,
                    adId == null ? "Organic / untagged" : "Ad " + adId,
                    adId == null, b.clicks, b.conversions, b.revenue);
        }).sorted(Comparator.comparingLong(AttributionLinkDtos.CreativePerformance::conversions)
                .reversed().thenComparing(AttributionLinkDtos.CreativePerformance::externalAdId,
                        Comparator.nullsLast(Comparator.naturalOrder())))
                .toList();
        return new AttributionLinkDtos.LinkPerformanceResponse(linkId, link.getSlug(),
                rows.stream().mapToLong(AttributionLinkDtos.CreativePerformance::clicks).sum(),
                rows.stream().mapToLong(AttributionLinkDtos.CreativePerformance::conversions).sum(),
                rows.stream().map(AttributionLinkDtos.CreativePerformance::revenue)
                        .reduce(BigDecimal.ZERO, BigDecimal::add), rows);
    }
}
