package com.ceview.module2.submodule22;

import com.ceview.ai.AIInferenceGatewayService;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.time.OffsetDateTime;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.IsoFields;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** Step 13 regression coverage for persisted, weekly keyword-trend alerts. */
class KeywordTrendAlertPersistenceTest {

    private static final UUID PROFILE_ID = UUID.fromString("50000000-0000-0000-0000-000000000001");
    private static final short ISO_YEAR = 2026;
    private static final short ISO_WEEK = 34;

    @Test
    void weeklyUpsertKeepsTheSameIdAndReadStateAcrossTwoRefreshes() {
        AIInferenceGatewayService ai = Mockito.mock(AIInferenceGatewayService.class);
        KeywordTrendAlertRepository repo = Mockito.mock(KeywordTrendAlertRepository.class);
        CategoryRankNotificationService service = new CategoryRankNotificationService(ai, repo);
        UUID stableId = UUID.randomUUID();

        Mockito.when(repo.findByBusinessProfileIdAndCategoryAndIsoYearAndIsoWeek(
                PROFILE_ID, "Diving", ISO_YEAR, ISO_WEEK))
                .thenReturn(Optional.empty());
        Mockito.when(repo.save(Mockito.any(KeywordTrendAlert.class))).thenAnswer(invocation -> {
            KeywordTrendAlert alert = invocation.getArgument(0);
            if (alert.getKeywordTrendAlertId() == null) alert.setKeywordTrendAlertId(stableId);
            return alert;
        });

        KeywordTrendAlert first = service.upsertWeeklyAlert(PROFILE_ID, "Diving", rankResult(), ISO_YEAR, ISO_WEEK);
        first.setIsRead(true);
        Mockito.when(repo.findByBusinessProfileIdAndCategoryAndIsoYearAndIsoWeek(
                PROFILE_ID, "Diving", ISO_YEAR, ISO_WEEK))
                .thenReturn(Optional.of(first));

        KeywordTrendAlert second = service.upsertWeeklyAlert(PROFILE_ID, "Diving", rankResult(), ISO_YEAR, ISO_WEEK);

        assertThat(second.getKeywordTrendAlertId()).isEqualTo(stableId);
        assertThat(second.getIsRead()).isTrue();
        assertThat(second.getAlertLevel()).isEqualTo("INFO");
        assertThat(second.getAlertMessage()).contains("South Korea").contains("diving in Cebu").contains("Japan");
        Mockito.verify(repo, Mockito.times(2)).save(Mockito.any(KeywordTrendAlert.class));
    }

    @Test
    void dashboardKeywordReadUsesPersistedRowsAndDoesNotNeedTheRankMarketsGateway() {
        DemandAlertRepository demandRepo = Mockito.mock(DemandAlertRepository.class);
        MarketScoreRepository scoreRepo = Mockito.mock(MarketScoreRepository.class);
        ForecastResultRepository forecastRepo = Mockito.mock(ForecastResultRepository.class);
        KeywordTrendAlertRepository keywordRepo = Mockito.mock(KeywordTrendAlertRepository.class);
        NotificationService service = new NotificationService(demandRepo, scoreRepo, forecastRepo, keywordRepo);

        KeywordTrendAlert stored = new KeywordTrendAlert();
        stored.setKeywordTrendAlertId(UUID.randomUUID());
        stored.setBusinessProfileId(PROFILE_ID);
        stored.setCategory("Diving");
        stored.setTargetMarket("korea");
        stored.setTopKeyword("diving in Cebu");
        stored.setAlertLevel("INFO");
        stored.setAlertMessage("South Korea leads Diving by summed keyword volume.");
        stored.setIsRead(true);
        stored.setCreatedAt(OffsetDateTime.parse("2026-08-17T00:00:00Z"));
        Mockito.when(keywordRepo.findByBusinessProfileIdOrderByCreatedAtDesc(PROFILE_ID)).thenReturn(List.of(stored));

        var response = service.getKeywordTrendNotifications(PROFILE_ID);

        assertThat(response.notifications()).singleElement().satisfies(notification -> {
            assertThat(notification.id()).isEqualTo(stored.getKeywordTrendAlertId().toString());
            assertThat(notification.isRead()).isTrue();
            assertThat(notification.alertLevel()).isEqualTo("INFO");
            assertThat(notification.alertMessage()).contains("summed keyword volume");
        });
        Mockito.verify(keywordRepo).findByBusinessProfileIdOrderByCreatedAtDesc(PROFILE_ID);
        Mockito.verifyNoInteractions(demandRepo, scoreRepo, forecastRepo);
    }

    @Test
    void weeklyProducerDoesNotCallRankMarketsWhenTheCurrentRowAlreadyExists() {
        AIInferenceGatewayService ai = Mockito.mock(AIInferenceGatewayService.class);
        KeywordTrendAlertRepository repo = Mockito.mock(KeywordTrendAlertRepository.class);
        CategoryRankNotificationService service = new CategoryRankNotificationService(ai, repo);
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        short year = (short) today.get(IsoFields.WEEK_BASED_YEAR);
        short week = (short) today.get(IsoFields.WEEK_OF_WEEK_BASED_YEAR);
        Mockito.when(repo.findByBusinessProfileIdAndCategoryAndIsoYearAndIsoWeek(
                PROFILE_ID, "Diving", year, week)).thenReturn(Optional.of(new KeywordTrendAlert()));

        service.refreshMissingCurrentWeekAlerts(PROFILE_ID, List.of("Diving"));

        Mockito.verifyNoInteractions(ai);
    }

    @Test
    void markReadPersistsAKeywordAlertAndTheNextReadReturnsItAsRead() {
        DemandAlertRepository demandRepo = Mockito.mock(DemandAlertRepository.class);
        MarketScoreRepository scoreRepo = Mockito.mock(MarketScoreRepository.class);
        ForecastResultRepository forecastRepo = Mockito.mock(ForecastResultRepository.class);
        KeywordTrendAlertRepository keywordRepo = Mockito.mock(KeywordTrendAlertRepository.class);
        NotificationService service = new NotificationService(demandRepo, scoreRepo, forecastRepo, keywordRepo);

        KeywordTrendAlert alert = new KeywordTrendAlert();
        UUID alertId = UUID.randomUUID();
        alert.setKeywordTrendAlertId(alertId);
        alert.setBusinessProfileId(PROFILE_ID);
        alert.setCategory("Diving");
        alert.setTargetMarket("korea");
        alert.setTopKeyword("diving in Cebu");
        alert.setAlertLevel("INFO");
        alert.setAlertMessage("South Korea leads Diving by summed keyword volume.");
        alert.setIsRead(false);
        alert.setCreatedAt(OffsetDateTime.parse("2026-08-17T00:00:00Z"));
        Mockito.when(demandRepo.findOwnedBy(alertId, PROFILE_ID)).thenReturn(Optional.empty());
        Mockito.when(keywordRepo.findByKeywordTrendAlertIdAndBusinessProfileId(alertId, PROFILE_ID))
                .thenReturn(Optional.of(alert));
        Mockito.when(keywordRepo.findByBusinessProfileIdOrderByCreatedAtDesc(PROFILE_ID)).thenReturn(List.of(alert));

        service.markRead(PROFILE_ID, alertId);
        var reload = service.getKeywordTrendNotifications(PROFILE_ID);

        assertThat(alert.getIsRead()).isTrue();
        assertThat(reload.notifications()).singleElement().extracting(n -> n.isRead()).isEqualTo(true);
        Mockito.verify(keywordRepo).save(alert);
    }

    private static Map<String, Object> rankResult() {
        return Map.of(
                "top_market", "korea",
                "top_keyword", "diving in Cebu",
                "ranked_markets", List.of(
                        Map.of("market", "korea", "total_volume", 120),
                        Map.of("market", "japan", "total_volume", 75),
                        Map.of("market", "usa", "total_volume", 40)));
    }
}
