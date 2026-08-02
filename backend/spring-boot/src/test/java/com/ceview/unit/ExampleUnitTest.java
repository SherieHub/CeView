package com.ceview.unit;

import com.ceview.module4.dto.AnalyticsDtos.Metrics;
import com.ceview.module4.dto.AnalyticsDtos.MetricCard;
import com.ceview.module4.dto.AnalyticsDtos.PesResponse;
import com.ceview.module4.pes.PESComputationService;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Example pure unit test — no Spring context, no database, no mocks needed.
 * Pattern to copy: instantiate the service directly and assert on its output.
 *
 * Run with: mvnw test -Dtest=ExampleUnitTest
 */
class ExampleUnitTest {

    private final PESComputationService pesService = new PESComputationService();

    @Test
    void compute_returnsExcellentLabel_forStrongMetrics() {
        Metrics metrics = new Metrics(
                new MetricCard(10.0, "%", 0, true),   // ctr
                new MetricCard(0.01, "$", 0, true),   // cpc
                new MetricCard(8.0, "x", 0, true),    // roas
                new MetricCard(15.0, "%", 0, true),   // convRate
                new MetricCard(1.0, "$", 0, true)     // cac
        );

        PesResponse result = pesService.compute(metrics);

        assertEquals("Excellent Performance", result.label());
        assertTrue(result.overallScore() >= 0.80);
        assertEquals(5, result.breakdown().size());
    }
}
