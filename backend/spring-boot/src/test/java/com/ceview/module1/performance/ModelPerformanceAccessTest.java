package com.ceview.module1.performance;

import com.ceview.auth.CurrentOperator;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;
import java.util.UUID;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

class ModelPerformanceAccessTest {
    @Test void emptyAllowlistDeniesEvenAuthenticatedAccountsBeforeReadingMetrics() {
        var operator = mock(CurrentOperator.class);
        var repository = mock(ModelPerformanceRepository.class);
        when(operator.resolve()).thenReturn(UUID.randomUUID());
        var service = new ModelPerformanceService(operator, repository, "");
        assertThatThrownBy(() -> service.report(null, null, null))
            .isInstanceOf(ResponseStatusException.class)
            .hasMessageContaining("403");
        verifyNoInteractions(repository);
    }

    @Test void malformedAdminConfigurationFailsRatherThanGrantingAccess() {
        assertThatThrownBy(() -> new ModelPerformanceService(mock(CurrentOperator.class),
            mock(ModelPerformanceRepository.class), "invalid-uuid"))
            .isInstanceOf(IllegalArgumentException.class);
    }
}
