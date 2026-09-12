package com.ceview.module2;

import com.ceview.ai.AIInferenceGatewayService;
import com.ceview.module2.submodule22.*;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** The dashboard keyword endpoint is a persisted read, never a PyTrends hop. */
class KeywordTrendSplitTest {

    @Test
    void dashboardKeywordReadMakesZeroRankMarketsCalls() {
        UUID profileId = UUID.randomUUID();
        AIInferenceGatewayService ai = Mockito.mock(AIInferenceGatewayService.class);
        KeywordTrendAlertRepository keywordRepo = Mockito.mock(KeywordTrendAlertRepository.class);
        // This is the only service that can invoke rankMarketsForCategory. It is
        // intentionally not a dependency of NotificationService.
        new CategoryRankNotificationService(ai, keywordRepo);
        NotificationService notifications = new NotificationService(
                Mockito.mock(DemandAlertRepository.class),
                Mockito.mock(MarketScoreRepository.class),
                Mockito.mock(ForecastResultRepository.class),
                keywordRepo);
        Mockito.when(keywordRepo.findByBusinessProfileIdOrderByCreatedAtDesc(profileId)).thenReturn(List.of());

        var response = notifications.getKeywordTrendNotifications(profileId);

        assertThat(response.notifications()).isEmpty();
        Mockito.verifyNoInteractions(ai);
    }
}
