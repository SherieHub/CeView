package com.ceview.module4.adconnections;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;

public interface AdInsightRepository extends JpaRepository<AdInsight, UUID> {

    Optional<AdInsight> findByBusinessProfileIdAndProviderAndPeriodStartAndPeriodEnd(
            UUID businessProfileId, String provider, LocalDate periodStart, LocalDate periodEnd);
}
