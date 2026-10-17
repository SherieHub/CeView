package com.ceview.module4.engagement;

import static org.assertj.core.api.Assertions.assertThat;

import com.ceview.module4.dto.AnalyticsDtos.FunnelStage;
import com.ceview.module4.dto.AnalyticsDtos.ManualIngestRequest;
import com.ceview.module4.dto.AnalyticsDtos.Metrics;
import com.ceview.module4.dto.AnalyticsDtos.MetricsResponse;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * The Module 4 KPI formulas, checked against ARCHITECTURE_SPEC.md §4.1 rather than against the
 * code. Before this file nothing asserted a computed KPI — the service was only ever mocked — which
 * is how a divide-by-the-wrong-denominator survived.
 *
 * <pre>
 * CTR  = clicks / impressions × 100     0.0 when impressions = 0
 * CPC  = ad_spend / clicks              0.0 when clicks = 0
 * CR   = bookings / clicks × 100        0.0 when clicks = 0
 * ROAS = revenue / ad_spend             0.0 when ad_spend = 0
 * CAC  = ad_spend / new_customers       0.0 when new_customers = 0
 * </pre>
 */
class MetricsCalculationServiceTest {

  // compute() and computeFunnelTransitions() never touch the repository.
  private final MetricsCalculationService svc = new MetricsCalculationService(null);

  private static ManualIngestRequest in(
      int imp, int clk, double spend, double rev, int conv, int book, int cust) {
    return new ManualIngestRequest(imp, clk, spend, rev, conv, book, cust, null, null);
  }

  @Test
  void computesEveryKpiFromTheSpecFormulas() {
    Metrics m = svc.compute(in(10_000, 250, 5_000.0, 20_000.0, 40, 25, 20)).metrics();

    assertThat(m.ctr().value()).isEqualTo(2.5); // 250 / 10000 × 100
    assertThat(m.cpc().value()).isEqualTo(20.0); // 5000 / 250
    assertThat(m.convRate().value()).isEqualTo(10.0); // 25 / 250 × 100
    assertThat(m.roas().value()).isEqualTo(4.0); // 20000 / 5000
    assertThat(m.cac().value()).isEqualTo(250.0); // 5000 / 20
  }

  @Test
  void ctrIsZeroWhenThereAreNoImpressionsEvenIfClicksWereEntered() {
    // The operator fills in clicks but leaves impressions blank. The spec says
    // CTR = 0.0 here; dividing by zero produces Infinity, which round() turns into
    // ~9.2e17 percent and the ingest endpoint persists. Fails until the guard
    // checks the right denominator.
    Metrics m = svc.compute(in(0, 50, 1_000.0, 0.0, 0, 0, 0)).metrics();

    assertThat(m.ctr().value()).isEqualTo(0.0);
  }

  @Test
  void everyKpiIsZeroNotNaNWhenAllInputsAreZero() {
    Metrics m = svc.compute(in(0, 0, 0.0, 0.0, 0, 0, 0)).metrics();

    assertThat(
            List.of(
                m.ctr().value(),
                m.cpc().value(),
                m.convRate().value(),
                m.roas().value(),
                m.cac().value()))
        .containsOnly(0.0);
  }

  @Test
  void costKpisAreZeroWhenTheirDenominatorIsZero() {
    Metrics m = svc.compute(in(1_000, 0, 500.0, 900.0, 0, 0, 0)).metrics();

    assertThat(m.cpc().value()).isEqualTo(0.0); // no clicks
    assertThat(m.convRate().value()).isEqualTo(0.0);
    assertThat(m.cac().value()).isEqualTo(0.0); // no new customers
    assertThat(m.roas().value()).isEqualTo(1.8); // ad spend is present
  }

  @Test
  void funnelReportsEachStageAndItsDropoffFromThePrevious() {
    MetricsResponse r = svc.compute(in(10_000, 250, 5_000.0, 0.0, 40, 25, 0));

    assertThat(r.funnel())
        .extracting(FunnelStage::stage)
        .containsExactly("Impressions", "Clicks", "Conversions", "Bookings");
    assertThat(r.funnel()).extracting(FunnelStage::value).containsExactly(10_000L, 250L, 40L, 25L);
    assertThat(r.funnel())
        .extracting(FunnelStage::dropoff)
        .containsExactly(null, "-97.5%", "-84.0%", "-37.5%");
  }

  @Test
  void funnelTransitionsAreRankedByBusinessImpactWithMeasuredDropRates() {
    List<Map<String, Object>> t =
        svc.computeFunnelTransitions(
            svc.compute(in(10_000, 250, 5_000.0, 0.0, 40, 25, 0)).funnel());

    assertThat(t)
        .extracting(x -> x.get("stage"))
        .containsExactly("Clicks → Conversions", "Conversions → Bookings", "Impressions → Clicks");
    assertThat(t).extracting(x -> x.get("dropRate")).containsExactly("84.0%", "37.5%", "97.5%");
  }
}
