package com.ceview.module4.attribution;

import org.junit.jupiter.api.Test;

import java.util.Arrays;

import static org.junit.jupiter.api.Assertions.assertTrue;

class CvLaunchVoucherTest {

    @Test
    void attributionCodeCarriesFixedVoucherTerms() {
        var fields = Arrays.stream(AttributionCode.class.getDeclaredFields())
                .map(field -> field.getName())
                .toList();

        assertTrue(fields.contains("discountAmount"));
        assertTrue(fields.contains("redemptionLimit"));
        assertTrue(fields.contains("voucherStatus"));
    }
}
