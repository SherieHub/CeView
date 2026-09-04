package com.ceview.module2;

import com.ceview.auth.CurrentBusinessProfile;
import com.ceview.module2.submodule22.DemandAlert;
import com.ceview.module2.submodule22.DemandAlertRepository;
import com.ceview.module2.submodule22.NotificationService;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Covers PATCH /api/notifications/{id}/read (FR2.15/FR2.17 read-state
 * persistence) — both the happy path and, critically, that an operator
 * cannot mark another tenant's alert read.
 */
class NotificationMarkReadTest {

    private static final UUID OWNER_PROFILE = UUID.fromString("20000000-0000-0000-0000-000000000001");
    private static final UUID OTHER_PROFILE = UUID.fromString("20000000-0000-0000-0000-000000000002");
    private static final UUID ALERT_ID = UUID.fromString("80000000-0000-0000-0000-000000000001");

    @Test
    void markReadSetsIsReadTrueWhenAlertBelongsToProfile() {
        DemandAlertRepository alertRepo = Mockito.mock(DemandAlertRepository.class);
        DemandAlert alert = new DemandAlert();
        alert.setDemandAlertId(ALERT_ID);
        alert.setIsRead(false);
        Mockito.when(alertRepo.findOwnedBy(ALERT_ID, OWNER_PROFILE)).thenReturn(Optional.of(alert));

        NotificationService service = new NotificationService(
                alertRepo, Mockito.mock(com.ceview.module2.submodule22.MarketScoreRepository.class),
                Mockito.mock(com.ceview.module2.submodule22.ForecastResultRepository.class),
                Mockito.mock(com.ceview.module1.businessinput.BusinessProfileRepository.class),
                Mockito.mock(com.ceview.module2.submodule22.CategoryRankNotificationService.class));

        service.markRead(OWNER_PROFILE, ALERT_ID);

        assertThat(alert.getIsRead()).isTrue();
        Mockito.verify(alertRepo).save(alert);
    }

    @Test
    void markReadNoOpsWhenAlertBelongsToDifferentProfile() {
        DemandAlertRepository alertRepo = Mockito.mock(DemandAlertRepository.class);
        // The ownership-scoped query returns nothing for a mismatched profile —
        // this is the repository-level enforcement the isolation test relies on.
        Mockito.when(alertRepo.findOwnedBy(ALERT_ID, OTHER_PROFILE)).thenReturn(Optional.empty());

        NotificationService service = new NotificationService(
                alertRepo, Mockito.mock(com.ceview.module2.submodule22.MarketScoreRepository.class),
                Mockito.mock(com.ceview.module2.submodule22.ForecastResultRepository.class),
                Mockito.mock(com.ceview.module1.businessinput.BusinessProfileRepository.class),
                Mockito.mock(com.ceview.module2.submodule22.CategoryRankNotificationService.class));

        service.markRead(OTHER_PROFILE, ALERT_ID);

        Mockito.verify(alertRepo, Mockito.never()).save(Mockito.any());
    }

    @Test
    void controllerResolvesProfileFromJwtAndReturns204() {
        NotificationService service = Mockito.mock(NotificationService.class);
        CurrentBusinessProfile current = Mockito.mock(CurrentBusinessProfile.class);
        Mockito.when(current.resolveProfileId()).thenReturn(OWNER_PROFILE);

        NotificationController controller = new NotificationController(service, current);

        var response = controller.markRead(ALERT_ID);

        assertThat(response.getStatusCode().value()).isEqualTo(204);
        Mockito.verify(service).markRead(OWNER_PROFILE, ALERT_ID);
    }
}
