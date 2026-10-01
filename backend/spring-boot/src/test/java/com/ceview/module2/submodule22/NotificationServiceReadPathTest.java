package com.ceview.module2.submodule22;

import com.ceview.module2.dto.NotificationDtos.NotificationsResponse;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** Regression coverage for the profile-scoped demand-alert feed (Step 12). */
class NotificationServiceReadPathTest {

    private static final UUID OWNER_PROFILE = UUID.fromString("20000000-0000-0000-0000-000000000001");
    private static final UUID OTHER_PROFILE = UUID.fromString("20000000-0000-0000-0000-000000000002");
    private static final List<String> CATEGORIES = List.of("Beach", "Diving", "Food");
    private static final List<String> MARKETS = List.of("korea", "japan", "usa");

    @Test
    void returnsAllNineCategoryMarketAlertsForTheOwnerAndNeverAnotherProfilesAlert() {
        DemandAlertRepository alertRepo = Mockito.mock(DemandAlertRepository.class);
        MarketScoreRepository scoreRepo = Mockito.mock(MarketScoreRepository.class);
        ForecastResultRepository forecastRepo = Mockito.mock(ForecastResultRepository.class);
        NotificationService service = new NotificationService(alertRepo, scoreRepo, forecastRepo,
                Mockito.mock(KeywordTrendAlertRepository.class));

        List<DemandAlert> ownerAlerts = new ArrayList<>();
        List<MarketScore> scores = new ArrayList<>();
        List<ForecastResult> forecasts = new ArrayList<>();
        for (String category : CATEGORIES) {
            for (String market : MARKETS) {
                UUID forecastId = UUID.randomUUID();
                UUID scoreId = UUID.randomUUID();
                ownerAlerts.add(alert(OWNER_PROFILE, scoreId, category));
                scores.add(score(scoreId, forecastId));
                forecasts.add(forecast(forecastId, market));
            }
        }

        Mockito.when(alertRepo.findByBusinessProfileIdOrderByAlertDateDesc(OWNER_PROFILE)).thenReturn(ownerAlerts);
        Mockito.when(scoreRepo.findAllById(Mockito.anyIterable())).thenReturn(scores);
        Mockito.when(forecastRepo.findAllById(Mockito.anyIterable())).thenReturn(forecasts);
        Mockito.when(alertRepo.findByBusinessProfileIdOrderByAlertDateDesc(OTHER_PROFILE)).thenReturn(List.of());

        NotificationsResponse ownerResponse = service.getNotificationsForProfile(OWNER_PROFILE);
        NotificationsResponse otherResponse = service.getNotificationsForProfile(OTHER_PROFILE);

        assertThat(ownerResponse.notifications()).hasSize(9);
        assertThat(ownerResponse.notifications())
                .extracting(n -> n.category() + ":" + n.marketId())
                .containsExactlyInAnyOrder(
                        "Beach:korea", "Beach:japan", "Beach:usa",
                        "Diving:korea", "Diving:japan", "Diving:usa",
                        "Food:korea", "Food:japan", "Food:usa");
        assertThat(ownerResponse.notifications()).allSatisfy(n -> {
            assertThat(n.title()).contains(n.category());
            assertThat(n.trend()).isEqualTo("Sudden interest spike");
            assertThat(n.windowOpenDate()).isEqualTo(OffsetDateTime.parse("2026-08-03T00:00:00Z"));
            assertThat(n.upliftPct()).isEqualTo(25.0);
        });
        assertThat(otherResponse.notifications()).isEmpty();
        Mockito.verify(alertRepo).findByBusinessProfileIdOrderByAlertDateDesc(OWNER_PROFILE);
        Mockito.verify(alertRepo).findByBusinessProfileIdOrderByAlertDateDesc(OTHER_PROFILE);
        Mockito.verify(alertRepo, Mockito.never()).findByMarketScoreIdInOrderByAlertDateDesc(Mockito.anyList());
    }

    @Test
    void retainsAnAlertWhoseCategoryAndMessageAreNull() {
        DemandAlertRepository alertRepo = Mockito.mock(DemandAlertRepository.class);
        MarketScoreRepository scoreRepo = Mockito.mock(MarketScoreRepository.class);
        ForecastResultRepository forecastRepo = Mockito.mock(ForecastResultRepository.class);
        NotificationService service = new NotificationService(alertRepo, scoreRepo, forecastRepo,
                Mockito.mock(KeywordTrendAlertRepository.class));

        UUID scoreId = UUID.randomUUID();
        UUID forecastId = UUID.randomUUID();
        DemandAlert legacyAlert = alert(OWNER_PROFILE, scoreId, null);
        legacyAlert.setAlertMessage(null);
        Mockito.when(alertRepo.findByBusinessProfileIdOrderByAlertDateDesc(OWNER_PROFILE)).thenReturn(List.of(legacyAlert));
        Mockito.when(scoreRepo.findAllById(Mockito.anyIterable())).thenReturn(List.of(score(scoreId, forecastId)));
        Mockito.when(forecastRepo.findAllById(Mockito.anyIterable())).thenReturn(List.of(forecast(forecastId, "korea")));

        NotificationsResponse response = service.getNotificationsForProfile(OWNER_PROFILE);

        assertThat(response.notifications()).singleElement().satisfies(n -> {
            assertThat(n.category()).isNull();
            assertThat(n.alertMessage()).isNull();
            assertThat(n.title()).contains("Uncategorized");
        });
    }

    private static DemandAlert alert(UUID profileId, UUID scoreId, String category) {
        DemandAlert alert = new DemandAlert();
        alert.setDemandAlertId(UUID.randomUUID());
        alert.setBusinessProfileId(profileId);
        alert.setMarketScoreId(scoreId);
        alert.setCategory(category);
        alert.setAlertLevel("CRITICAL");
        alert.setAlertMessage("Measured demand window");
        alert.setTrend("Sudden interest spike");
        alert.setUpliftPct(25.0);
        alert.setWindowOpenDate(OffsetDateTime.parse("2026-08-03T00:00:00Z"));
        alert.setAlertDate(OffsetDateTime.parse("2026-07-27T00:00:00Z"));
        alert.setIsRead(false);
        return alert;
    }

    private static MarketScore score(UUID scoreId, UUID forecastId) {
        MarketScore score = new MarketScore();
        score.setMarketScoreId(scoreId);
        score.setForecastResultId(forecastId);
        return score;
    }

    private static ForecastResult forecast(UUID forecastId, String market) {
        ForecastResult forecast = new ForecastResult();
        forecast.setForecastResultId(forecastId);
        forecast.setBusinessProfileId(OWNER_PROFILE);
        forecast.setTargetMarket(market);
        return forecast;
    }
}
