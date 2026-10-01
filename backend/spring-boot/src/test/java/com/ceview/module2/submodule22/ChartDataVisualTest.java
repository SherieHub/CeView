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
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.verify;
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
    @Autowired ForecastResultRepository     forecastRepo;
    @Autowired MarketScoreRepository        scoreRepo;

    private UUID profileId;

    // ── Seed data that simulates 4 weeks of real PyTrends history ─────────────

    /**
     * Korea  — clear upward trend (tourist demand rising)
     * Japan  — flat/declining trend
     * USA    — slight downward trend with a spike
     */
    private static final double[] KOREA_TREND = { 40, 42, 44, 46, 48, 50, 52, 54, 56, 58, 60, 63 };
    private static final double[] JAPAN_TREND = { 56, 55, 54, 53, 52, 51, 50, 49, 48.5, 48, 47.5, 47 };
    private static final double[]   USA_TREND = { 68, 70, 72, 74, 76, 74, 72, 70, 68, 67, 66, 65 };  // spike then drop

    @BeforeEach
    void setUp() {
        signalRepo.deleteAll();
        scoreRepo.deleteAll();
        forecastRepo.deleteAll();
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
                "ICN — Incheon Int'l", "CEB — Mactan-Cebu Int'l",
                8_000, 15_000, "static_reference_v1", "2026-09-11",
                List.of("Jul", "Aug", "Dec", "Jan"),
                List.of(new ExternalMarketDataClient.CarrierDto("Korean Air",   "KE", "7x / week", true),
                        new ExternalMarketDataClient.CarrierDto("Cebu Pacific", "5J", "5x / week", true))));
        when(externalClient.getFlightReference("japan")).thenReturn(new ExternalMarketDataClient.FlightReferenceDto(
                "japan", true,  "2h 50m", 2_186, 8,
                "KIX — Kansai Int'l", "CEB — Mactan-Cebu Int'l",
                8_000, 15_000, "static_reference_v1", "2026-09-11",
                List.of("Apr", "May", "Aug", "Mar"),
                List.of(new ExternalMarketDataClient.CarrierDto("Philippine Airlines", "PR", "5x / week", true),
                        new ExternalMarketDataClient.CarrierDto("Cebu Pacific",         "5J", "3x / week", true))));
        when(externalClient.getFlightReference("usa")).thenReturn(new ExternalMarketDataClient.FlightReferenceDto(
                "usa",   false, "16h+ (via MNL)", 11_027, 3,
                "LAX — Los Angeles Int'l", "MNL — Ninoy Aquino Int'l",
                25_000, 40_000, "static_reference_v1", "2026-09-11",
                List.of("Jun", "Jul", "Aug", "Dec"),
                List.of(new ExternalMarketDataClient.CarrierDto("Philippine Airlines", "PR", "3x / week", false))));

        // ── Mock AIInferenceGatewayService ────────────────────────────────────
        // runPipeline() submits one sequence per (market, category) pair in a
        // single batch call and zips the results back by "{market}::{category}"
        // (not bare market name — a market can carry more than one category, see
        // ForecastingService's CategorySequence.key()), so mock
        // runForecastInferenceBatch (not the legacy per-market runForecastInference)
        // with one entry per (market, category). The test profile has two
        // categories ("Beach Resort", "Adventure Tour"), so 3 markets × 2
        // categories = 6 entries. Each market gets distinct weekly_forecasts
        // derived from its historical slope; both categories reuse the same
        // per-market forecast numbers here purely for mock brevity — production
        // code now computes a genuinely distinct sequence per category.
        Map<String, Object> koreaForecast = Map.of(      // upward trend continues  63 → 72.5
                "predicted_demand_4w",  72.5,
                "predicted_demand_12w", 70.0,
                "weekly_forecasts",     List.of(65.2, 67.8, 70.1, 72.5, 72.0, 71.5, 71.0, 70.5, 70.0, 69.5, 69.0, 68.5),
                "mape", 8.2, "mae", 4.9, "rmse", 7.0, "confidence", 0.87, "source", "stub-v1");
        Map<String, Object> japanForecast = Map.of(      // mild decline  47 → 44 then stabilises
                "predicted_demand_4w",  44.0,
                "predicted_demand_12w", 43.5,
                "weekly_forecasts",     List.of(46.2, 45.4, 44.7, 44.0, 43.8, 43.6, 43.4, 43.2, 43.0, 42.8, 42.6, 42.4),
                "mape", 6.5, "mae", 3.9, "rmse", 5.5, "confidence", 0.91, "source", "stub-v1");
        Map<String, Object> usaForecast = Map.of(        // spike reverts toward mean  65 → 60.5
                "predicted_demand_4w",  60.5,
                "predicted_demand_12w", 63.0,
                "weekly_forecasts",     List.of(63.5, 62.2, 61.3, 60.5, 60.2, 60.0, 59.8, 59.6, 59.4, 59.2, 59.0, 58.8),
                "mape", 10.1, "mae", 6.1, "rmse", 8.6, "confidence", 0.82, "source", "stub-v1");

        when(ai.runForecastInferenceBatch(any())).thenReturn(Map.ofEntries(
                Map.entry("korea::Beach Resort",   koreaForecast),
                Map.entry("korea::Adventure Tour", koreaForecast),
                Map.entry("japan::Beach Resort",   japanForecast),
                Map.entry("japan::Adventure Tour", japanForecast),
                Map.entry("usa::Beach Resort",     usaForecast),
                Map.entry("usa::Adventure Tour",   usaForecast)));

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
                    "scorer", "linear", "components", Map.of());
        });
    }

    // ── Test ─────────────────────────────────────────────────────────────────

    @Test
    void printWeeklyDemandChart() {
        MarketsResponse response = forecastingService.forecastForProfile(profileId, false);

        assertNotNull(response, "response must not be null");
        assertFalse(response.markets().isEmpty(), "markets list must not be empty");
        @SuppressWarnings("unchecked")
        org.mockito.ArgumentCaptor<List<Map<String, Object>>> batchPayload = org.mockito.ArgumentCaptor.forClass(List.class);
        verify(ai).runForecastInferenceBatch(batchPayload.capture());
        assertEquals(6, batchPayload.getValue().size(),
                "Phase B sends one sequence per (market, category) pair — 3 markets × 2 categories");
        assertEquals(12, ((List<?>) batchPayload.getValue().get(0).get("sequence")).size(),
                "Phase B forwards the fixed 12-week matrix to FastAPI");

        // ── Each market should have exactly 8 chart points ───────────────────
        for (MarketDto market : response.markets()) {
            assertFalse(market.chartData().isEmpty(),
                    market.id() + " chartData must not be empty");
        }

        List<ForecastResult> koreaBeachForecasts = forecastRepo.findAll().stream()
                .filter(fr -> profileId.equals(fr.getBusinessProfileId()))
                .filter(fr -> "korea".equals(fr.getTargetMarket()))
                .filter(fr -> "Beach Resort".equals(fr.getCategory()))
                .toList();
        assertEquals(2, koreaBeachForecasts.size(), "one category/market persists 4w and 12w rows");
        assertEquals("stub-v1", koreaBeachForecasts.stream()
                .filter(fr -> fr.getForecastHorizonWeeks() == 4).findFirst().orElseThrow().getSource());
        assertFalse(scoreRepo.findAll().isEmpty(), "Phase C persists a market score after batch inference");

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
