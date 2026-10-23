package com.ceview.module2;

import com.ceview.auth.CurrentBusinessProfile;
import com.ceview.module2.dto.MarketDtos.MarketsResponse;
import com.ceview.module2.submodule22.ForecastingService;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.http.ResponseEntity;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class ForecastingControllerJwtVariantTest {

    private static final UUID PROFILE = UUID.fromString("20000000-0000-0000-0000-000000000001");

    @Test
    void analyzeWithoutPathVariableResolvesProfileFromJwt() {
        ForecastingService service = Mockito.mock(ForecastingService.class);
        CurrentBusinessProfile current = Mockito.mock(CurrentBusinessProfile.class);
        Mockito.when(current.resolveOrValidate(null)).thenReturn(PROFILE);
        Mockito.when(service.forecastForProfile(PROFILE, true, true))
               .thenReturn(new MarketsResponse(List.of()));

        ForecastingController controller = new ForecastingController(service, current, Mockito.mock(WebClient.class));

        assertThat(controller.analyze().getStatusCode().value()).isEqualTo(200);
        Mockito.verify(current).resolveOrValidate(null);
        Mockito.verify(service).forecastForProfile(PROFILE, true, true);
    }

    @Test
    void ensureWithoutPathVariableResolvesProfileFromJwt() {
        ForecastingService service = Mockito.mock(ForecastingService.class);
        CurrentBusinessProfile current = Mockito.mock(CurrentBusinessProfile.class);
        Mockito.when(current.resolveOrValidate(null)).thenReturn(PROFILE);
        OffsetDateTime generatedAt = OffsetDateTime.parse("2026-10-22T06:30:00Z");
        Mockito.when(service.ensureFresh(PROFILE, 12L))
               .thenReturn(new ForecastingService.EnsureResult(false, generatedAt));

        ForecastingController controller = new ForecastingController(service, current, Mockito.mock(WebClient.class));

        ResponseEntity<?> response = controller.ensure(12L);
        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody()).isEqualTo(Map.of("refreshed", false, "generatedAt", generatedAt.toString()));
        Mockito.verify(service).ensureFresh(PROFILE, 12L);
        Mockito.verify(service, Mockito.never()).ensureFreshForecast(Mockito.any(), Mockito.anyLong());
    }

    @Test
    void ensureReportsThatThePipelineRan() {
        ForecastingService service = Mockito.mock(ForecastingService.class);
        CurrentBusinessProfile current = Mockito.mock(CurrentBusinessProfile.class);
        Mockito.when(current.resolveOrValidate(null)).thenReturn(PROFILE);
        Mockito.when(service.ensureFresh(PROFILE, 12L))
               .thenReturn(new ForecastingService.EnsureResult(true, OffsetDateTime.parse("2026-10-22T07:00:00Z")));

        ForecastingController controller = new ForecastingController(service, current, Mockito.mock(WebClient.class));

        assertThat(controller.ensure(12L).getBody())
                .isEqualTo(Map.of("refreshed", true, "generatedAt", "2026-10-22T07:00:00Z"));
    }

    @Test
    void ensureForAnIncompleteProfileIsA409NotAServerError() {
        ForecastingService service = Mockito.mock(ForecastingService.class);
        CurrentBusinessProfile current = Mockito.mock(CurrentBusinessProfile.class);
        Mockito.when(current.resolveOrValidate(null)).thenReturn(PROFILE);
        Mockito.when(service.ensureFresh(PROFILE, 12L)).thenThrow(new IllegalArgumentException("categories not set"));

        ForecastingController controller = new ForecastingController(service, current, Mockito.mock(WebClient.class));

        assertThat(controller.ensure(12L).getStatusCode().value()).isEqualTo(409);
    }
}
