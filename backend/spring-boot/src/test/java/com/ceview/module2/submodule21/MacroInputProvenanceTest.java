package com.ceview.module2.submodule21;

import com.ceview.ai.AiDependencyException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import java.net.InetSocketAddress;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Module 2 E2E, Step 6 (docs/module-2/MODULE_2_E2E_CONTRACT.md; C-06, H-18).
 *
 * Proves the three-tier macro-input policy that replaced ExternalMarketDataClient's
 * silent GDP_DEFAULTS/FOREX_DEFAULTS constant fallback:
 *   (1) live fetch succeeds -> tagged "live", value/timestamp from the response;
 *   (2) live fetch fails but a prior tbl_market_economic_trend row exists -> tagged
 *       "last_known_good", value/timestamp taken from THAT row, never a constant;
 *   (3) live fetch fails AND no prior row exists -> throws AiDependencyException
 *       (code MOD21_MACRO_UNAVAILABLE) instead of fabricating a number.
 *
 * The GDP tier-1 test uses a real, ephemeral {@link HttpServer} (JDK built-in — no
 * mocking framework needed for HTTP) so "live" is genuinely exercised through
 * WebClient, not just asserted on a hand-built DTO. fetchGdpGrowth honours the
 * configured world-bank base URL, so this is fully deterministic.
 *
 * fetchForexRate cannot be driven the same way: its WebClient call targets an
 * ABSOLUTE fawazahmed0 CDN URI (see the class Javadoc on CURRENCY_CDN_BASE) that
 * bypasses whatever base URL this test configures — the exact limitation
 * ForexCanonicalUnitTest already documents for this client's forex path. The forex
 * tier-2/tier-3 tests below therefore rely on the test host having no route to the
 * real CDN (true in this sandboxed environment) to force the live leg to fail
 * within the client's timeout; they are not deterministic on a host with open
 * internet egress to cdn.jsdelivr.net. The tier-2/tier-3 CODE PATH is identical
 * between GDP and forex (same {@code macroUnavailable} helper, same
 * last-known-good lookup shape), so the GDP tests are the load-bearing proof of
 * that logic.
 */
class MacroInputProvenanceTest {

    private HttpServer server;

    @AfterEach
    void tearDown() {
        if (server != null) server.stop(0);
    }

    private String startServer(String path, String body) throws Exception {
        server = HttpServer.create(new InetSocketAddress("localhost", 0), 0);
        server.createContext(path, exchange -> {
            byte[] bytes = body.getBytes();
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, bytes.length);
            exchange.getResponseBody().write(bytes);
            exchange.close();
        });
        server.start();
        return "http://localhost:" + server.getAddress().getPort();
    }

    private MarketEconomicTrendRepository emptyRepo() {
        MarketEconomicTrendRepository repo = mock(MarketEconomicTrendRepository.class);
        when(repo.findTopByMarketOrderByFetchedAtDesc(anyString())).thenReturn(Optional.empty());
        return repo;
    }

    // ── Tier 1: live ────────────────────────────────────────────────────────

    @Test
    void gdpGrowthIsTaggedLiveOnASuccessfulWorldBankFetch() throws Exception {
        // World Bank's NY.GDP.MKTP.KD.ZG shape: [pageInfo, [{"date":..,"value":..}, ...]].
        String worldBankJson = "[{\"page\":1},[{\"date\":\"2024\",\"value\":2.8}]]";
        String baseUrl = startServer("/country/KR/indicator/NY.GDP.MKTP.KD.ZG", worldBankJson);
        ExternalMarketDataClient client = new ExternalMarketDataClient(
                baseUrl, "http://localhost:1", emptyRepo(), new ObjectMapper());

        ExternalMarketDataClient.GdpDataDto dto = client.fetchGdpGrowth("korea");

        assertThat(dto.source()).isEqualTo("live");
        assertThat(dto.gdpGrowth()).isEqualTo(2.8);
        assertThat(dto.year()).isEqualTo(2024);
        assertThat(dto.asOf()).isNotNull();
    }

    // ── Tier 2: last-known-good ─────────────────────────────────────────────

    @Test
    void gdpGrowthFallsBackToLastKnownGoodWhenLiveFetchFails() {
        MarketEconomicTrendRepository repo = mock(MarketEconomicTrendRepository.class);
        MarketEconomicTrend priorRow = new MarketEconomicTrend();
        priorRow.setTrendId(UUID.randomUUID());
        priorRow.setMarket("korea");
        priorRow.setGdpLatest(1.9);
        OffsetDateTime priorAsOf = OffsetDateTime.now().minusDays(3);
        priorRow.setGdpFetchedAt(priorAsOf);
        priorRow.setFetchedAt(priorAsOf);
        when(repo.findTopByMarketOrderByFetchedAtDesc("korea")).thenReturn(Optional.of(priorRow));

        // Port 1 is reserved/unroutable -> the live World Bank call fails fast.
        ExternalMarketDataClient client = new ExternalMarketDataClient(
                "http://localhost:1", "http://localhost:1", repo, new ObjectMapper());

        ExternalMarketDataClient.GdpDataDto dto = client.fetchGdpGrowth("korea");

        assertThat(dto.source()).isEqualTo("last_known_good");
        assertThat(dto.gdpGrowth()).isEqualTo(1.9);
        assertThat(dto.asOf()).isEqualTo(priorAsOf);
    }

    @Test
    void forexRateFallsBackToLastKnownGoodWhenLiveFetchFails() {
        MarketEconomicTrendRepository repo = mock(MarketEconomicTrendRepository.class);
        MarketEconomicTrend priorRow = new MarketEconomicTrend();
        priorRow.setTrendId(UUID.randomUUID());
        priorRow.setMarket("korea");
        priorRow.setForexLatest(0.0421);
        OffsetDateTime priorAsOf = OffsetDateTime.now().minusHours(6);
        priorRow.setForexFetchedAt(priorAsOf);
        priorRow.setFetchedAt(priorAsOf);
        when(repo.findTopByMarketOrderByFetchedAtDesc("korea")).thenReturn(Optional.of(priorRow));

        ExternalMarketDataClient client = new ExternalMarketDataClient(
                "http://localhost:1", "http://localhost:1", repo, new ObjectMapper());

        ExternalMarketDataClient.ForexDataDto dto = client.fetchForexRate("korea");

        assertThat(dto.source()).isEqualTo("last_known_good");
        assertThat(dto.rateVsPhp()).isEqualTo(0.0421);
        assertThat(dto.asOf()).isEqualTo(priorAsOf);
    }

    // ── Tier 3: hard failure ────────────────────────────────────────────────

    @Test
    void gdpGrowthThrowsMacroUnavailableWhenNeitherTierExists() {
        ExternalMarketDataClient client = new ExternalMarketDataClient(
                "http://localhost:1", "http://localhost:1", emptyRepo(), new ObjectMapper());

        assertThatThrownBy(() -> client.fetchGdpGrowth("korea"))
                .isInstanceOf(AiDependencyException.class)
                .satisfies(ex -> assertThat(((AiDependencyException) ex).getCode())
                        .isEqualTo("MOD21_MACRO_UNAVAILABLE"));
    }

    @Test
    void forexRateThrowsMacroUnavailableWhenNeitherTierExists() {
        ExternalMarketDataClient client = new ExternalMarketDataClient(
                "http://localhost:1", "http://localhost:1", emptyRepo(), new ObjectMapper());

        assertThatThrownBy(() -> client.fetchForexRate("korea"))
                .isInstanceOf(AiDependencyException.class)
                .satisfies(ex -> assertThat(((AiDependencyException) ex).getCode())
                        .isEqualTo("MOD21_MACRO_UNAVAILABLE"));
    }

    @Test
    void gdpTrendThrowsMacroUnavailableWhenNeitherTierExists() {
        ExternalMarketDataClient client = new ExternalMarketDataClient(
                "http://localhost:1", "http://localhost:1", emptyRepo(), new ObjectMapper());

        assertThatThrownBy(() -> client.fetchGdpTrend("korea"))
                .isInstanceOf(AiDependencyException.class)
                .satisfies(ex -> assertThat(((AiDependencyException) ex).getCode())
                        .isEqualTo("MOD21_MACRO_UNAVAILABLE"));
    }

    @Test
    void forexTrendThrowsMacroUnavailableWhenNeitherTierExists() {
        ExternalMarketDataClient client = new ExternalMarketDataClient(
                "http://localhost:1", "http://localhost:1", emptyRepo(), new ObjectMapper());

        assertThatThrownBy(() -> client.fetchForexTrend("korea"))
                .isInstanceOf(AiDependencyException.class)
                .satisfies(ex -> assertThat(((AiDependencyException) ex).getCode())
                        .isEqualTo("MOD21_MACRO_UNAVAILABLE"));
    }

    // ── The deleted constants are gone ──────────────────────────────────────

    @Test
    void theBackCompatConstructorsStillTagLiveForCallersThatDoNotCareAboutProvenance() {
        // BackfillRealStatisticsTest / WeeklyCadenceIngestionTest mock fetchGdpGrowth/
        // fetchForexRate with the old 3-arg constructors — this proves that back-compat
        // path still exists and defaults sensibly rather than breaking those suites.
        ExternalMarketDataClient.GdpDataDto gdp = new ExternalMarketDataClient.GdpDataDto("KR", 2.1, 2025);
        ExternalMarketDataClient.ForexDataDto forex = new ExternalMarketDataClient.ForexDataDto("KRW", 0.042, "2026-09-09");

        assertThat(gdp.source()).isEqualTo("live");
        assertThat(forex.source()).isEqualTo("live");
    }
}
