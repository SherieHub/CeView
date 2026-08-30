package com.ceview.module2;

import com.ceview.auth.CurrentBusinessProfile;
import com.ceview.module2.dto.MarketDtos.MarketsResponse;
import com.ceview.module2.submodule22.ForecastingService;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class ForecastingControllerJwtVariantTest {

    private static final UUID PROFILE = UUID.fromString("20000000-0000-0000-0000-000000000001");

    @Test
    void analyzeWithoutPathVariableResolvesProfileFromJwt() {
        ForecastingService service = Mockito.mock(ForecastingService.class);
        CurrentBusinessProfile current = Mockito.mock(CurrentBusinessProfile.class);
        Mockito.when(current.resolveOrValidate(null)).thenReturn(PROFILE);
        Mockito.when(service.forecastForProfile(PROFILE, true))
               .thenReturn(new MarketsResponse(List.of()));

        ForecastingController controller = new ForecastingController(service, current, Mockito.mock(WebClient.class));

        assertThat(controller.analyze().getStatusCode().value()).isEqualTo(200);
        Mockito.verify(current).resolveOrValidate(null);
        Mockito.verify(service).forecastForProfile(PROFILE, true);
    }

    @Test
    void ensureWithoutPathVariableResolvesProfileFromJwt() {
        ForecastingService service = Mockito.mock(ForecastingService.class);
        CurrentBusinessProfile current = Mockito.mock(CurrentBusinessProfile.class);
        Mockito.when(current.resolveOrValidate(null)).thenReturn(PROFILE);
        Mockito.when(service.ensureFreshForecast(PROFILE, 12L))
               .thenReturn(new MarketsResponse(List.of()));

        ForecastingController controller = new ForecastingController(service, current, Mockito.mock(WebClient.class));

        assertThat(controller.ensure(12L).getStatusCode().value()).isEqualTo(200);
        Mockito.verify(service).ensureFreshForecast(PROFILE, 12L);
    }
}
