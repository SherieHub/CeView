package com.ceview.module4.engagement;

import com.ceview.auth.CurrentBusinessProfile;
import org.springframework.data.domain.PageRequest;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.UUID;

/**
 * What ads have actually cost this operator (CVW-43).
 *
 * <p>Backs the budget estimate in Content Studio's ad planner. The estimate is
 * built only from the operator's own submitted weeks — never from an industry
 * benchmark CeView would have to invent — so an operator with no ad history gets
 * no estimate rather than a made-up one.
 *
 * <p>Only the {@value #RECENT_PERIODS} most recent weeks are used: ad prices
 * move, and a rate from a year ago would mislead a budget set today.
 */
@RestController
@RequestMapping("/api/analytics")
public class AdCostRatesController {

    static final int RECENT_PERIODS = 12;

    /**
     * @param costPerThousandImpressions spend per 1,000 impressions; null without impressions
     * @param costPerClick spend per click; null without clicks
     * @param periods how many reported weeks the rates are based on
     */
    public record AdCostRates(
            int periods,
            BigDecimal totalSpend,
            long totalImpressions,
            long totalClicks,
            BigDecimal costPerThousandImpressions,
            BigDecimal costPerClick) {}

    private final CampaignRecordRepository campaignRepo;
    private final CurrentBusinessProfile currentBusinessProfile;

    public AdCostRatesController(CampaignRecordRepository campaignRepo,
                                 CurrentBusinessProfile currentBusinessProfile) {
        this.campaignRepo = campaignRepo;
        this.currentBusinessProfile = currentBusinessProfile;
    }

    @GetMapping("/cost-rates")
    public AdCostRates costRates() {
        UUID profileId = currentBusinessProfile.resolveProfileId();
        List<CampaignRecord> recent = campaignRepo.findByBusinessProfileIdOrderByCreatedAtDesc(
                profileId, PageRequest.of(0, RECENT_PERIODS));

        // Weeks with no spend say nothing about price; counting their impressions
        // (organic, or typed as zero) would make ads look cheaper than they are.
        List<CampaignRecord> paid = recent.stream().filter(r -> r.getAdSpend() > 0).toList();
        double spend = paid.stream().mapToDouble(CampaignRecord::getAdSpend).sum();
        long impressions = paid.stream().mapToLong(CampaignRecord::getImpressions).sum();
        long clicks = paid.stream().mapToLong(CampaignRecord::getClicks).sum();

        return new AdCostRates(
                paid.size(),
                money(spend),
                impressions,
                clicks,
                impressions > 0 ? money(spend * 1000.0 / impressions) : null,
                clicks > 0 ? money(spend / clicks) : null);
    }

    private static BigDecimal money(double value) {
        return BigDecimal.valueOf(value).setScale(2, RoundingMode.HALF_UP);
    }
}
