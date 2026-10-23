package com.ceview.testsupport;

import com.ceview.auth.EmailCode;
import com.ceview.auth.EmailCodeRepository;
import com.ceview.auth.MsmeOperator;
import com.ceview.auth.MsmeOperatorRepository;
import com.ceview.module1.businessinput.BusinessProfile;
import com.ceview.module1.businessinput.BusinessProfileRepository;
import com.ceview.module2.MarketCatalog;
import com.ceview.module2.submodule21.MarketSignalRecord;
import com.ceview.module2.submodule21.MarketSignalRecordRepository;
import com.ceview.module2.submodule22.DemandAlert;
import com.ceview.module2.submodule22.DemandAlertRepository;
import com.ceview.module2.submodule22.ForecastResult;
import com.ceview.module2.submodule22.ForecastResultRepository;
import com.ceview.module2.submodule22.MarketScore;
import com.ceview.module2.submodule22.MarketScoreRepository;
import com.ceview.module3.social.publish.SocialPost;
import com.ceview.module3.social.publish.SocialPostRepository;
import com.ceview.module4.attribution.AttributionCode;
import com.ceview.module4.attribution.AttributionCodeService;
import com.ceview.module4.attribution.link.AttributionLink;
import com.ceview.module4.attribution.link.AttributionLinkService;
import com.ceview.module4.postmetrics.PostMetric;
import com.ceview.module4.postmetrics.PostMetricRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.temporal.IsoFields;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * E2E-only data seeding behind {@link TestSupportSeedController}. Writes the same rows the real
 * pipelines would, so the app's read paths run unchanged against them:
 * <ul>
 *   <li>a demand window: what {@code ForecastingService.runPipeline} persists for one category
 *   across every market (signals, 4w/12w forecasts, ranked scores) plus one alert, then the real
 *   {@code mintForWindow} calls for its attribution code and link;</li>
 *   <li>post metrics: what {@code PostMetricsSyncJob} stores after a platform sync;</li>
 *   <li>an expired email code, which otherwise takes the 10-minute TTL to reach.</li>
 * </ul>
 */
@Service
@ConditionalOnProperty(name = "ceview.test-support.enabled", havingValue = "true")
public class TestSupportSeedService {

    static final int HISTORY_WEEKS = 16;
    static final int FORECAST_WEEKS = 12;

    private final MsmeOperatorRepository operators;
    private final BusinessProfileRepository profiles;
    private final ForecastResultRepository forecasts;
    private final MarketScoreRepository scores;
    private final MarketSignalRecordRepository signals;
    private final DemandAlertRepository alerts;
    private final AttributionCodeService codes;
    private final AttributionLinkService links;
    private final SocialPostRepository posts;
    private final PostMetricRepository metrics;
    private final EmailCodeRepository emailCodes;
    private final ObjectMapper mapper;

    public TestSupportSeedService(MsmeOperatorRepository operators,
                                  BusinessProfileRepository profiles,
                                  ForecastResultRepository forecasts,
                                  MarketScoreRepository scores,
                                  MarketSignalRecordRepository signals,
                                  DemandAlertRepository alerts,
                                  AttributionCodeService codes,
                                  AttributionLinkService links,
                                  SocialPostRepository posts,
                                  PostMetricRepository metrics,
                                  EmailCodeRepository emailCodes,
                                  ObjectMapper mapper) {
        this.operators = operators;
        this.profiles = profiles;
        this.forecasts = forecasts;
        this.scores = scores;
        this.signals = signals;
        this.alerts = alerts;
        this.codes = codes;
        this.links = links;
        this.posts = posts;
        this.metrics = metrics;
        this.emailCodes = emailCodes;
        this.mapper = mapper;
    }

    public record DemandWindowRequest(String email, String category, String market, String level,
                                      Double upliftPct, OffsetDateTime windowStart, Integer staleDays,
                                      Double yoyRatio) {}

    public record DemandWindowResult(UUID businessProfileId, UUID demandAlertId, UUID marketScoreId,
                                     UUID attributionCodeId, String code, UUID linkId, String slug,
                                     OffsetDateTime windowStart, OffsetDateTime windowEnd) {}

    public record BusinessProfileRequest(String email, String businessName, List<String> categories,
                                         List<String> coreServices, String description, String uvp,
                                         String imagePreview, Float uniquenessScore) {}

    public record PostMetricsRequest(UUID postId, Long reach, Long likes, Long comments, Long shares,
                                     List<Long> series) {}

    /** Thrown for a request the hook cannot act on; the controller maps it to 400/404. */
    public static class SeedException extends RuntimeException {
        final int status;
        SeedException(int status, String message) {
            super(message);
            this.status = status;
        }
    }

    @Transactional
    public DemandWindowResult seedDemandWindow(DemandWindowRequest req) {
        BusinessProfile profile = profileFor(req.email());
        UUID profileId = profile.getBusinessProfileId();
        String category = req.category();
        String alertMarket = req.market();
        if (category == null || !profile.categoriesList().contains(category)) {
            throw new SeedException(400, "category must be one of the profile's categories");
        }
        if (!MarketCatalog.IDS.contains(alertMarket)) {
            throw new SeedException(400, "market must be one of " + MarketCatalog.IDS);
        }
        String level = req.level() == null ? "WARNING" : req.level();
        if (!level.equals("WARNING") && !level.equals("CRITICAL")) {
            throw new SeedException(400, "level must be WARNING or CRITICAL");
        }
        double uplift = req.upliftPct() == null ? 35.0 : req.upliftPct();
        // The forecast is always "just generated" (so GET /api/forecasting/ensure serves it instead of
        // starting the live pipeline); staleDays ages only the newest *signal*, which is what drives
        // the dashboard's "Data is N days old" banner (EnrichedSequenceBuilder.STALE_AFTER = 48 h).
        OffsetDateTime generatedAt = OffsetDateTime.now(ZoneOffset.UTC);
        OffsetDateTime signalAsOf = generatedAt.minusDays(req.staleDays() == null ? 0 : req.staleDays());
        OffsetDateTime windowStart = req.windowStart() != null
                ? req.windowStart()
                : generatedAt.toLocalDate().plusDays(7).atStartOfDay().atOffset(ZoneOffset.UTC);

        // Every market gets a ranked forecast so the radar and ranked list are complete; only the
        // requested market carries the alert, and it is scored highest so it ranks #1.
        MarketScore alertScore = null;
        int rank = 2;
        for (String market : MarketCatalog.IDS) {
            boolean isAlertMarket = market.equals(alertMarket);
            double baseline = 40.0;
            double demand4w = isAlertMarket ? baseline * (1 + uplift / 100.0) : baseline * 0.95;
            seedSignals(profileId, category, market, baseline, signalAsOf, req.yoyRatio());
            ForecastResult fr4w = saveForecast(profileId, market, category, demand4w, 4, generatedAt,
                    weeklyForecasts(demand4w), req.yoyRatio());
            saveForecast(profileId, market, category, demand4w * 1.05, 12, generatedAt, null, req.yoyRatio());

            MarketScore ms = new MarketScore();
            ms.setForecastResultId(fr4w.getForecastResultId());
            ms.setMarketScore(isAlertMarket ? 0.82 : 0.55 - rank * 0.05);
            ms.setSeasonalityScore(0.6);
            ms.setSpikeIndicator(level.equals("CRITICAL"));
            ms.setGdpPerCapitaGrowth(2.1);
            ms.setForexVsPhp(1.0);
            ms.setYoyRatio(req.yoyRatio());
            ms.setScorer("xgboost");
            ms.setMarketRank(isAlertMarket ? 1 : rank++);
            ms.setEvaluatedAt(generatedAt);
            ms = scores.save(ms);
            if (isAlertMarket) alertScore = ms;
        }

        alerts.deleteAll(alerts.findByProfileAndCategoryAndMarket(profileId, category, alertMarket));
        DemandAlert alert = new DemandAlert();
        alert.setMarketScoreId(alertScore.getMarketScoreId());
        alert.setBusinessProfileId(profileId);
        alert.setCategory(category);
        alert.setAlertLevel(level);
        alert.setUpliftPct(uplift);
        alert.setAlertMessage(String.format(
                "%s for %s — the 4-week forecast is %.1f%% above the rolling baseline. "
                        + "First forecast week crossing the demand-window threshold starts %s.",
                level.equals("CRITICAL") ? "Critical demand window" : "Demand window detected",
                MarketCatalog.displayName(alertMarket), uplift, windowStart.toLocalDate()));
        alert.setTrend(level.equals("CRITICAL") ? "Sudden interest spike" : "Rising demand window");
        alert.setIsRead(false);
        alert.setAlertDate(generatedAt);
        alert.setWindowOpenDate(windowStart);
        alert = alerts.save(alert);

        AttributionCode code = codes.mintForWindow(profileId, category, alertMarket, windowStart,
                alert.getDemandAlertId());
        AttributionLink link = links.mintForWindow(profileId, category, alertMarket, windowStart,
                alert.getDemandAlertId());

        return new DemandWindowResult(profileId, alert.getDemandAlertId(), alertScore.getMarketScoreId(),
                code.getAttributionCodeId(), code.getCode(), link.getLinkId(), link.getSlug(),
                code.getWindowStart(), code.getWindowEnd());
    }

    /**
     * Saves the operator's business profile exactly as {@code PUT /api/business-profile} stores it,
     * minus the embedding call: that call spends a Hugging Face ZeroGPU run per save, which a suite
     * that creates an operator per spec file would burn through in minutes.
     */
    @Transactional
    public BusinessProfile seedBusinessProfile(BusinessProfileRequest req) {
        MsmeOperator op = operatorFor(req.email());
        BusinessProfile p = profiles.findFirstByUserId(op.getOperatorId()).orElseGet(BusinessProfile::new);
        p.setUserId(op.getOperatorId());
        p.setBusinessName(req.businessName());
        p.setBusinessDescription(req.description());
        p.setUvp(req.uvp());
        p.setCoreServicesList(req.coreServices() == null ? List.of() : req.coreServices());
        p.setCategoriesList(req.categories() == null ? List.of() : req.categories());
        p.setImageUrl(req.imagePreview());
        p.setUniquenessScore(req.uniquenessScore());
        return profiles.save(p);
    }

    @Transactional
    public PostMetric seedPostMetrics(PostMetricsRequest req) {
        SocialPost post = posts.findById(req.postId())
                .orElseThrow(() -> new SeedException(404, "no post with that id"));
        PostMetric row = metrics.findByPostIdAndBusinessProfileId(post.getId(), post.getBusinessProfileId())
                .orElseGet(PostMetric::new);
        row.setPostId(post.getId());
        row.setBusinessProfileId(post.getBusinessProfileId());
        row.setReach(req.reach());
        row.setLikes(req.likes());
        row.setComments(req.comments());
        row.setShares(req.shares());
        // Same formula as PostMetricsSyncJob.
        row.setEngagementRate(req.reach() != null && req.reach() > 0 && req.likes() != null
                && req.comments() != null && req.shares() != null
                ? 100.0 * (req.likes() + req.comments() + req.shares()) / req.reach() : null);
        row.setReachSeriesJson(toJson(req.series() == null ? List.of() : req.series()));
        row.setLastSyncedAt(OffsetDateTime.now(ZoneOffset.UTC));
        return metrics.save(row);
    }

    /** Moves every unconsumed code for the address into the past. Returns how many were expired. */
    @Transactional
    public int expireEmailCodes(String email) {
        MsmeOperator op = operatorFor(email);
        List<EmailCode> open = emailCodes.findByOperatorIdAndConsumedAtIsNull(op.getOperatorId());
        OffsetDateTime past = OffsetDateTime.now(ZoneOffset.UTC).minusMinutes(1);
        for (EmailCode c : open) c.setExpiresAt(past);
        emailCodes.saveAll(open);
        return open.size();
    }

    private void seedSignals(UUID profileId, String category, String market, double baseline,
                             OffsetDateTime asOf, Double yoyRatio) {
        LocalDate latestWeek = asOf.toLocalDate().with(java.time.DayOfWeek.MONDAY);
        for (int i = HISTORY_WEEKS - 1; i >= 0; i--) {
            LocalDate weekStart = latestWeek.minusWeeks(i);
            short isoYear = (short) weekStart.get(IsoFields.WEEK_BASED_YEAR);
            short isoWeek = (short) weekStart.get(IsoFields.WEEK_OF_WEEK_BASED_YEAR);
            MarketSignalRecord r = signals
                    .findByBusinessProfileIdAndCategoryAndTargetMarketAndIsoYearAndIsoWeek(
                            profileId, category, market, isoYear, isoWeek)
                    .orElseGet(MarketSignalRecord::new);
            double value = baseline + (i % 4) * 2.0;
            r.setBusinessProfileId(profileId);
            r.setCategory(category);
            r.setTargetMarket(market);
            r.setTrendIndex(value);
            r.setForexRate(1.0);
            r.setGdpGrowth(2.1);
            r.setSeasonalityScore(0.6);
            r.setRollingAverage(baseline);
            r.setRollingStdDev(3.0);
            r.setRollingAverage7d(baseline);
            r.setRollingAverage30d(baseline);
            r.setYoyRatio(yoyRatio);
            r.setSpikeIndicator(false);
            r.setIsoYear(isoYear);
            r.setIsoWeek(isoWeek);
            r.setWeekStartDate(weekStart);
            // The newest week is "aggregated" at asOf itself (it is what staleness is measured on);
            // older weeks at the start of their own week.
            OffsetDateTime observed = i == 0 ? asOf : weekStart.atStartOfDay().atOffset(ZoneOffset.UTC);
            r.setAggregatedAt(observed);
            if (r.getFirstSeenAt() == null) r.setFirstSeenAt(observed);
            r.setStatsWindowWeeks(HISTORY_WEEKS);
            r.setSource("e2e-seed");
            r.setSourceFetchedAt(asOf);
            signals.save(r);
        }
    }

    private ForecastResult saveForecast(UUID profileId, String market, String category, double demand,
                                        int horizon, OffsetDateTime generatedAt, List<Double> weekly,
                                        Double yoyRatio) {
        ForecastResult fr = new ForecastResult();
        fr.setBusinessProfileId(profileId);
        fr.setTargetMarket(market);
        fr.setCategory(category);
        fr.setPredictedDemand(demand);
        fr.setForecastConfidence(0.8);
        fr.setMapeScore(8.0);
        fr.setMae(3.0);
        fr.setRmse(4.0);
        fr.setForecastHorizonWeeks(horizon);
        fr.setGeneratedAt(generatedAt);
        fr.setYoyRatio(yoyRatio);
        fr.setSource("e2e-seed");
        if (weekly != null) fr.setWeeklyForecastsJson(toJson(weekly));
        return forecasts.save(fr);
    }

    private static List<Double> weeklyForecasts(double demand4w) {
        List<Double> weekly = new ArrayList<>(FORECAST_WEEKS);
        for (int w = 0; w < FORECAST_WEEKS; w++) weekly.add(demand4w + (w % 3) - 1.0);
        return weekly;
    }

    private BusinessProfile profileFor(String email) {
        MsmeOperator op = operatorFor(email);
        return profiles.findFirstByUserId(op.getOperatorId())
                .orElseThrow(() -> new SeedException(404, "operator has no business profile"));
    }

    private MsmeOperator operatorFor(String email) {
        if (email == null || email.isBlank()) throw new SeedException(400, "email is required");
        return operators.findByEmail(email.trim())
                .orElseThrow(() -> new SeedException(404, "no operator with that email"));
    }

    private String toJson(Object value) {
        try {
            return mapper.writeValueAsString(value);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException(e);
        }
    }
}
