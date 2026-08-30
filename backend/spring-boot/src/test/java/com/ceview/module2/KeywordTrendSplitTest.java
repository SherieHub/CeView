package com.ceview.module2;

import com.ceview.module1.businessinput.BusinessProfile;
import com.ceview.module1.businessinput.BusinessProfileRepository;
import com.ceview.module2.dto.NotificationDtos.NotificationDto;
import com.ceview.module2.submodule22.CategoryRankNotificationService;
import com.ceview.module2.submodule22.DemandAlertRepository;
import com.ceview.module2.submodule22.ForecastResultRepository;
import com.ceview.module2.submodule22.MarketScoreRepository;
import com.ceview.module2.submodule22.NotificationService;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Task 7a regression guard: GET /api/notifications must be a pure, fast DB
 * read that never calls CategoryRankNotificationService (PyTrends round-trip,
 * up to 75s per category). The keyword-trend work now lives in its own
 * method/endpoint, called separately.
 */
class KeywordTrendSplitTest {

    private static final UUID PROFILE_ID = UUID.fromString("30000000-0000-0000-0000-000000000001");

    private NotificationService buildService(DemandAlertRepository alertRepo,
                                              MarketScoreRepository scoreRepo,
                                              ForecastResultRepository forecastRepo,
                                              BusinessProfileRepository profileRepo,
                                              CategoryRankNotificationService categoryRankService) {
        return new NotificationService(alertRepo, scoreRepo, forecastRepo, profileRepo, categoryRankService);
    }

    @Test
    void getNotificationsForProfileNeverInvokesCategoryRankNotificationService() {
        DemandAlertRepository alertRepo = Mockito.mock(DemandAlertRepository.class);
        MarketScoreRepository scoreRepo = Mockito.mock(MarketScoreRepository.class);
        ForecastResultRepository forecastRepo = Mockito.mock(ForecastResultRepository.class);
        BusinessProfileRepository profileRepo = Mockito.mock(BusinessProfileRepository.class);
        CategoryRankNotificationService categoryRankService = Mockito.mock(CategoryRankNotificationService.class);

        Mockito.when(forecastRepo
                .findTopByBusinessProfileIdAndTargetMarketAndForecastHorizonWeeksOrderByGeneratedAtDesc(
                        Mockito.eq(PROFILE_ID), Mockito.anyString(), Mockito.eq(4)))
                .thenReturn(Optional.empty());

        NotificationService service = buildService(alertRepo, scoreRepo, forecastRepo, profileRepo, categoryRankService);

        var response = service.getNotificationsForProfile(PROFILE_ID);

        assertThat(response.notifications()).isEmpty();
        Mockito.verify(categoryRankService, Mockito.never()).buildForCategories(Mockito.anyList());
        Mockito.verifyNoInteractions(profileRepo);
    }

    @Test
    void getKeywordTrendNotificationsInvokesCategoryRankNotificationService() {
        DemandAlertRepository alertRepo = Mockito.mock(DemandAlertRepository.class);
        MarketScoreRepository scoreRepo = Mockito.mock(MarketScoreRepository.class);
        ForecastResultRepository forecastRepo = Mockito.mock(ForecastResultRepository.class);
        BusinessProfileRepository profileRepo = Mockito.mock(BusinessProfileRepository.class);
        CategoryRankNotificationService categoryRankService = Mockito.mock(CategoryRankNotificationService.class);

        BusinessProfile profile = new BusinessProfile();
        profile.setBusinessProfileId(PROFILE_ID);
        profile.setCategories("Dive Shop,Cafe");
        Mockito.when(profileRepo.findById(PROFILE_ID)).thenReturn(Optional.of(profile));
        NotificationDto fakeTrend = new NotificationDto(
                UUID.randomUUID().toString(), "Aug 29, 2026", "Keyword Trend Alert — Dive Shop",
                "South Korea", "korea", "Top keyword: diving", false, null, "Dive Shop", "INFO", null);
        Mockito.when(categoryRankService.buildForCategories(Mockito.anyList()))
                .thenReturn(List.of(fakeTrend));

        NotificationService service = buildService(alertRepo, scoreRepo, forecastRepo, profileRepo, categoryRankService);

        var response = service.getKeywordTrendNotifications(PROFILE_ID);

        assertThat(response.notifications()).hasSize(1);
        Mockito.verify(categoryRankService).buildForCategories(Mockito.anyList());
        Mockito.verifyNoInteractions(alertRepo, scoreRepo, forecastRepo);
    }
}
