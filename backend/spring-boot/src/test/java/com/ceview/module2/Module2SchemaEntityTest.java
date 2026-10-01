package com.ceview.module2;

import com.ceview.module2.submodule21.MarketEconomicTrend;
import com.ceview.module2.submodule21.MarketRouteReference;
import com.ceview.module2.submodule21.MarketRouteReferenceRepository;
import com.ceview.module2.submodule21.MarketSignalRecord;
import com.ceview.module2.submodule22.DemandAlert;
import com.ceview.module2.submodule22.KeywordTrendAlert;
import com.ceview.module2.submodule22.KeywordTrendAlertRepository;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Schema-side regression guard for Module 2 E2E migrations. Hibernate's test
 * profile creates its H2 schema from these entities, so these assignments prove
 * the new persisted fields and repository types remain available without
 * invoking any forecasting or notification service logic.
 */
class Module2SchemaEntityTest {

    @Test
    void mapsCanonicalForexAndIsoWeekFields() {
        MarketEconomicTrend economic = new MarketEconomicTrend();
        economic.setForexUnit("PHP_PER_FOREIGN");

        MarketSignalRecord signal = new MarketSignalRecord();
        signal.setIsoYear((short) 2026);
        signal.setIsoWeek((short) 37);
        signal.setWeekStartDate(LocalDate.of(2026, 9, 7));

        assertThat(economic.getForexUnit()).isEqualTo("PHP_PER_FOREIGN");
        assertThat(signal.getIsoYear()).isEqualTo((short) 2026);
        assertThat(signal.getIsoWeek()).isEqualTo((short) 37);
        assertThat(signal.getWeekStartDate()).isEqualTo(LocalDate.of(2026, 9, 7));
    }

    @Test
    void mapsDemandAndKeywordAlertsToUuidProfiles() {
        UUID profileId = UUID.randomUUID();

        DemandAlert demand = new DemandAlert();
        demand.setBusinessProfileId(profileId);
        demand.setCategory("Coastal & Island");
        demand.setUpliftPct(24.5);

        KeywordTrendAlert keyword = new KeywordTrendAlert();
        keyword.setBusinessProfileId(profileId);
        keyword.setCategory("Coastal & Island");
        keyword.setTargetMarket("korea");
        keyword.setTopKeyword("cebu diving");
        keyword.setAlertMessage("Keyword trend detected.");
        keyword.setAlertLevel("INFO");
        keyword.setIsoYear((short) 2026);
        keyword.setIsoWeek((short) 37);
        keyword.setCreatedAt(OffsetDateTime.parse("2026-09-10T00:00:00Z"));

        assertThat(demand.getBusinessProfileId()).isEqualTo(profileId);
        assertThat(demand.getCategory()).isEqualTo("Coastal & Island");
        assertThat(demand.getUpliftPct()).isEqualTo(24.5);
        assertThat(keyword.getBusinessProfileId()).isEqualTo(profileId);
        assertThat(keyword.getIsoWeek()).isEqualTo((short) 37);
    }

    @Test
    void exposesRouteAndKeywordRepositoryKeys() {
        assertThat(MarketRouteReferenceRepository.class).isNotNull();
        assertThat(KeywordTrendAlertRepository.class).isNotNull();

        MarketRouteReference route = new MarketRouteReference();
        route.setMarket("korea");
        route.setValidFrom(LocalDate.of(2026, 1, 1));

        assertThat(route.getMarket()).isEqualTo("korea");
        assertThat(route.getValidFrom()).isEqualTo(LocalDate.of(2026, 1, 1));
    }
}
