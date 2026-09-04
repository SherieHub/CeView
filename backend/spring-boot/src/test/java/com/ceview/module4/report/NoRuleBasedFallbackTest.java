package com.ceview.module4.report;

import org.junit.jupiter.api.Test;

import java.util.Arrays;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * FR4.26's "fallback mechanism" is removed. A rule-based report is not an AI
 * report, and rendering one under the same heading misrepresents it.
 *
 * The broad catch(Exception) it lived inside also swallowed genuine bugs — its
 * removal is a correctness win beyond the fabrication question.
 */
class NoRuleBasedFallbackTest {

    @Test
    void theRuleBasedReportServiceIsGone() {
        assertThatThrownBy(() -> Class.forName("com.ceview.module4.report.PrescriptiveReportService"))
                .isInstanceOf(ClassNotFoundException.class);
    }

    @Test
    void theControllerNoLongerWiresAFallbackService() {
        assertThat(Arrays.stream(PrescriptiveReportController.class.getDeclaredFields())
                .map(f -> f.getType().getSimpleName()))
                .doesNotContain("PrescriptiveReportService");
    }
}
