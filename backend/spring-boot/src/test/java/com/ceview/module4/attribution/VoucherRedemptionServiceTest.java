package com.ceview.module4.attribution;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.web.server.ResponseStatusException;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class VoucherRedemptionServiceTest {
    private final AttributionCodeRepository codes = mock(AttributionCodeRepository.class);
    private final AttributionRedemptionRepository rows = mock(AttributionRedemptionRepository.class);
    private final VoucherRedemptionService service = new VoucherRedemptionService(codes, rows);
    private final UUID profile = UUID.randomUUID();
    private final UUID id = UUID.randomUUID();
    private AttributionCode code;

    @BeforeEach
    void setUp() {
        code = new AttributionCode();
        code.setAttributionCodeId(id);
        code.setBusinessProfileId(profile);
        code.setCode("CVLAUNCH");
        code.setDiscountAmount(new BigDecimal("50.00"));
        code.setRedemptionLimit(10L);
        code.setWindowStart(OffsetDateTime.now().minusDays(1));
        code.setWindowEnd(OffsetDateTime.now().plusDays(1));
        when(codes.findLockedByAttributionCodeIdAndBusinessProfileId(id, profile)).thenReturn(Optional.of(code));
    }

    @Test
    void lastRedemptionPersistsGrossAndNetAndExhaustsVoucher() {
        when(rows.countByAttributionCodeIdAndSource(id, "MANUAL")).thenReturn(9L);
        var result = service.redeem(profile, id, new BigDecimal("200.00"), null);
        assertEquals(new BigDecimal("150.00"), result.netRevenue());
        assertEquals(0, result.redemptionsRemaining());
        assertEquals("EXHAUSTED", code.getVoucherStatus());
        var saved = ArgumentCaptor.forClass(AttributionRedemption.class);
        verify(rows).save(saved.capture());
        assertEquals(profile, saved.getValue().getBusinessProfileId());
        assertEquals(new BigDecimal("200.00"), saved.getValue().getGrossRevenue());
        assertEquals(result.netRevenue(), saved.getValue().getRevenue());
    }

    @Test
    void capCannotBeExceededEvenIfStatusIsStale() {
        when(rows.countByAttributionCodeIdAndSource(id, "MANUAL")).thenReturn(10L);
        assertEquals(409, assertThrows(ResponseStatusException.class,
                () -> service.redeem(profile, id, BigDecimal.TEN, null)).getStatusCode().value());
        verify(rows, never()).save(any());
    }

    @Test
    void anotherTenantCannotRedeemTheVoucher() {
        assertEquals(404, assertThrows(ResponseStatusException.class,
                () -> service.redeem(UUID.randomUUID(), id, BigDecimal.TEN, null)).getStatusCode().value());
        verify(rows, never()).save(any());
    }

    @Test
    void discountNeverProducesNegativeRevenue() {
        assertEquals(BigDecimal.ZERO, service.redeem(profile, id, BigDecimal.TEN, null).netRevenue());
    }
}
