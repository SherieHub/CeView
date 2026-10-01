package com.ceview.module4.adconnections.client;

import java.math.BigDecimal;

/**
 * Parsed account-level metrics for one period, plus the untouched payload they
 * came from (stored on the insight row for later diagnosis).
 */
public record AdInsightData(long impressions,
                            long clicks,
                            BigDecimal spend,
                            long conversions,
                            String currency,
                            String rawResponse) {}
