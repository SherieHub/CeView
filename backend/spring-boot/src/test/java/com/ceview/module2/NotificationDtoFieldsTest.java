package com.ceview.module2;

import com.ceview.module2.dto.NotificationDtos.NotificationDto;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;

class NotificationDtoFieldsTest {

    @Test
    void notificationCarriesCategoryAndAlertFields() {
        NotificationDto dto = new NotificationDto(
                "80000000-0000-0000-0000-000000000001",
                "Jul 27, 2026",
                "Demand Surge Detected — South Korea",
                "South Korea", "korea",
                "Rising demand window",
                false,
                null,
                "Coastal & Island",
                "WARNING",
                "Demand spike active — immediate action recommended");

        assertThat(dto.category()).isEqualTo("Coastal & Island");
        assertThat(dto.alertLevel()).isEqualTo("WARNING");
        assertThat(dto.alertMessage()).contains("immediate action");
    }
}
