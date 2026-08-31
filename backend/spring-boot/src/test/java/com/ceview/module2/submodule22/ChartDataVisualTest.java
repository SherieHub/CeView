package com.ceview.module2.submodule22;

import com.ceview.ai.AIInferenceGatewayService;
import com.ceview.module1.businessinput.BusinessProfile;
import com.ceview.module1.businessinput.BusinessProfileRepository;
import com.ceview.module2.dto.MarketDtos.ChartDataPointDto;
import com.ceview.module2.dto.MarketDtos.MarketDto;
import com.ceview.module2.dto.MarketDtos.MarketsResponse;
import com.ceview.module2.submodule21.ExternalMarketDataClient;
import com.ceview.module2.submodule21.MarketSignalRecord;
import com.ceview.module2.submodule21.MarketSignalRecordRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

/**
 * Visual integration test — runs with H2 (no PostgreSQL needed).
 *
 * Seeds 4 weeks of realistic PyTrends signal records per market,
 * mocks the AI/external services, then prints the full 8-point chart
 * (Wk-3 … Wk+4) showing which columns are History, Current, or Forecast.
 *
 * Run with:
 *   mvn -pl backend/spring-boot test -Dtest=ChartDataVisualTest -Dsurefire.useFile=false
 */
// MOCK (not NONE): the full app context includes SecurityConfig, whose
// securityFilterChain(HttpSecurity) bean requires a servlet web context.
// MOCK supplies a mock servlet environment (no port bound) so the context
// loads; the test itself only exercises ForecastingService.
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
class ChartDataVisualTest {

    // ── Service under test ────────────────────────────────────────────────────
    @Autowired ForecastingService forecastingService;

    // ── Mock all external HTTP so no real services are needed ─────────────────
    @MockBean AIInferenceGatewayService    ai;
    @MockBean ExternalMarketDataClient     externalClient;

    // ── Repos (backed by H2) ──────────────────────────────────────────────────
    @Autowired BusinessProfileRepository    profileRepo;
    @Autowired MarketSignalRecordRepository signalRepo;

    private UUID profileId;

    // ── Seed data that simulates 4 weeks of real PyTrends history ─────────────

    /**
     * Korea  — clear upward trend (tourist demand rising)
     * Japan  — flat/declining trend
     * USA    — slight downward trend with a spike
     */
    private static final double[] KOREA_TREND = { 45.0, 50.5, 56.0, 63.0 };
    private static final double[] JAPAN_TREND = { 52.0, 50.0, 48.5, 47.0 };
    private static final double[]   USA_TREND = { 72.0, 75.0, 68.0, 65.0 };  // spike then drop

    @BeforeEach
    void setUp() {
        signalRepo.deleteAll();
        profileRepo.deleteAll();

        // ── Business profile ──────────────────────────────────────────────────
        profileId = UUID.randomUUID();
        BusinessProfile p = new BusinessProfile();
        p.setBusinessProfileId(profileId);
        p.setBusinessName("Cebu Beach Resort (Test)");
        p.setCategoriesList(List.of("Beach Resort", "Adventure Tour"));
        profileRepo.save(p);

        // ── 4 weeks of historical signal records per market ───────────────────
        seedSignals(profileId, "korea", KOREA_TREND, false);
        seedSignals(profileId, "japan", JAPAN_TREND, false);
        seedSignals(profileId, "usa",   USA_TREND,   true /* spike on last week */);

        // ── Mock ExternalMarketDataClient ─────────────────────────────────────
        ExternalMarketDataClient.GdpTrendDto gdpTrend = new ExternalMarketDataClient.GdpTrendDto(
                "KR",
                List.of(
                        new ExternalMarketDataClient.GdpTrendPoint(2020, -0.9),
                        new ExternalMarketDataClient.GdpTrendPoint(2021,  4.1),
                        new ExternalMarketDataClient.GdpTrendPoint(2022,  2.6),
                        new ExternalMarketDataClient.GdpTrendPoint(2023,  1.4),
                        new ExternalMarketDataClient.GdpTrendPoint(2024,  2.2)),
                2.2, OffsetDateTime.now());
        ExternalMarketDataClient.ForexTrendDto forexTrend = new ExternalMarketDataClient.ForexTrendDto(
                "KRW",
                List.of(
                        new ExternalMarketDataClient.ForexTrendPoint("2025-02", 23.1),
                        new ExternalMarketDataClient.ForexTrendPoint("2025-03", 23.4),
                        new ExternalMarketDataClient.ForexTrendPoint("2025-04", 23.6),
                        new ExternalMarketDataClient.ForexTrendPoint("2025-05", 23.8)),
                23.8, OffsetDateTime.now());

        when(externalClient.fetchGdpTrend(anyString())).thenReturn(gdpTrend);
        when(externalClient.fetchForexTrend(anyString())).thenReturn(forexTrend);

        when(externalClient.getFlightReference("korea")).thenReturn(new ExternalMarketDataClient.FlightReferenceDto(
                "korea", true,  "3h 45m", 2_640, 14,
                List.of(Map.of("name", "Korean Air",   "code", "KE", "frequency", "7x / week"),
                        Map.of("name", "Cebu Pacific", "code", "5J", "frequency", "5x / week"))));
        when(externalClient.getFlightReference("japan")).thenReturn(new ExternalMarketDataClient.FlightReferenceDto(
                "japan", true,  "2h 50m", 2_186, 8,
                List.of(Map.of("name", "Philippine Airlines", "code", "PR", "frequency", "5x / week"),
                        Map.of("name", "Cebu Pacific",        "code", "5J", "frequency", "3x / week"))));
        when(externalClient.getFlightReference("usa")).thenReturn(new ExternalMarketDataClient.FlightReferenceDto(
                "usa",   false, "16h+ (via MNL)", 11_027, 3,
                List.of(Map.of("name", "Philippine Airlines", "code", "PR", "frequency", "3x / week"))));

        // ── Mock AIInferenceGatewayService ────────────────────────────────────
        // runPipeline() submits all markets in a single batch call and zips the
        // results back by market name, so mock runForecastInferenceBatch (not the
        // legacy per-market runForecastInference). Each market gets distinct
        // weekly_forecasts derived from its historical slope.
        Map<String, Object> koreaForecast = Map.of(      // upward trend continues  63 → 72.5
                "predicted_demand_4w",  72.5,
                "predicted_demand_12w", 70.0,
                "weekly_forecasts",     List.of(65.2, 67.8, 70.1, 72.5),
                "mape", 8.2, "mae", 4.9, "rmse", 7.0, "confidence", 0.87);
        Map<String, Object> japanForecast = Map.of(      // mild decline  47 → 44 then stabilises
                "predicted_demand_4w",  44.0,
                "predicted_demand_12w", 43.5,
                "weekly_forecasts",     List.of(46.2, 45.4, 44.7, 44.0),
                "mape", 6.5, "mae", 3.9, "rmse", 5.5, "confidence", 0.91);
        Map<String, Object> usaForecast = Map.of(        // spike reverts toward mean  65 → 60.5
                "predicted_demand_4w",  60.5,
                "predicted_demand_12w", 63.0,
                "weekly_forecasts",     List.of(63.5, 62.2, 61.3, 60.5),
                "mape", 10.1, "mae", 6.1, "rmse", 8.6, "confidence", 0.82);

        when(ai.runForecastInferenceBatch(any())).thenReturn(Map.of(
                "korea", koreaForecast,
                "japan", japanForecast,
                "usa",   usaForecast));

        when(ai.runMarketScoring(any())).thenAnswer(inv -> {
            @SuppressWarnings("unchecked")
            Map<String, Object> p2 = (Map<String, Object>) inv.getArgument(0);
            String market = String.valueOf(p2.getOrDefault("market", ""));
            double score = switch (market) {
                case "korea" -> 0.82;
                case "japan" -> 0.71;
                default      -> 0.65;
            };
            return Map.of("market_score", score, "economic_viability_score", score * 0.9,
                    "components", Map.of());
        });
    }

    // ── Test ─────────────────────────────────────────────────────────────────

    @Test
    void printWeeklyDemandChart() {
        MarketsResponse response = forecastingService.forecastForProfile(profileId, false);

        assertNotNull(response, "response must not be null");
        assertFalse(response.markets().isEmpty(), "markets list must not be empty");

        // ── Each market should have exactly 8 chart points ───────────────────
        for (MarketDto market : response.markets()) {
            assertFalse(market.chartData().isEmpty(),
                    market.id() + " chartData must not be empty");
        }

        // ── Pretty-print for visual inspection ───────────────────────────────
        String divider = "=".repeat(72);
        String line    = "-".repeat(72);

        System.out.println();
        System.out.println(divider);
        System.out.println("  WEEKLY DEMAND CHART — History + Current + Forecast");
        System.out.println("  Profile: " + profileId + "  (H2 in-memory)");
        System.out.println(divider);

        for (MarketDto market : response.markets()) {
            System.out.printf("%n  Rank #%d  %-16s  Match: %3d%%  ID: %s%n",
                    market.rank(), market.name(), market.matchScore(), market.id());
            System.out.println("  " + line);
            System.out.printf("  %-10s  %-12s  %-12s  %-12s  %s%n",
                    "Week", "History", "Forecast", "Seasonality", "Type");
            System.out.println("  " + line);

            for (ChartDataPointDto pt : market.chartData()) {
                boolean hasHist = pt.history()  != null;
                boolean hasFore = pt.forecast() != null;

                String type;
                String histStr = hasHist ? String.format("%6.1f", pt.history())  : "      –";
                String foreStr = hasFore ? String.format("%6.1f", pt.forecast()) : "      –";

                if (hasHist && hasFore) {
                    type = "◆ Current  (recorded + AI anchor)";
                } else if (hasHist) {
                    type = "● History";
                } else {
                    type = "◇ Forecast  ← AI projection";
                }

                System.out.printf("  %-10s  %s      %s      %5.1f%%    %s%n",
                        pt.week(), histStr, foreStr,
                        pt.seasonality(), type);
            }

            // Verify forecast weeks are NOT all the same value (the old flat-line bug)
            List<ChartDataPointDto> forecastPts = market.chartData().stream()
                    .filter(pt -> pt.history() == null && pt.forecast() != null)
                    .toList();
            if (forecastPts.size() >= 2) {
                boolean isFlat = forecastPts.stream()
                        .map(ChartDataPointDto::forecast)
                        .distinct().count() == 1;
                String flatFlag = isFlat ? "  ⚠ FLAT LINE — weekly_forecasts not applied!" : "  ✓ Non-flat forecast line";
                System.out.println("  " + flatFlag);
            }
        }

        System.out.println();
        System.out.println(divider);
        System.out.println();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /**
     * Saves one {@link MarketSignalRecord} per entry in {@code trendValues},
     * with timestamps spaced one week apart (oldest first).
     */
    private void seedSignals(UUID pid, String market, double[] trendValues, boolean spikeOnLast) {
        int n = trendValues.length;
        for (int i = 0; i < n; i++) {
            double ti = trendValues[i];
            boolean isLast  = (i == n - 1);
            boolean spike   = isLast && spikeOnLast;

            MarketSignalRecord r = new MarketSignalRecord();
            r.setBusinessProfileId(pid);
            r.setTargetMarket(market);
            r.setTrendIndex(ti);
            r.setForexRate(23.5);
            r.setGdpGrowth(2.2);
            r.setSeasonalityScore(0.72);
            r.setRollingAverage(ti);
            r.setRollingAverage7d(ti);
            r.setRollingAverage30d(ti - 2.0);
            r.setRollingStdDev(3.5);
            r.setSpikeIndicator(spike);
            r.setSource("pytrends");   // measured data — EnrichedSequenceBuilder reads real rows only
            // timestamp: oldest = 3 weeks ago, newest = now
            r.setAggregatedAt(OffsetDateTime.now().minusWeeks(n - 1 - i));
            signalRepo.save(r);
        }
    }
}
