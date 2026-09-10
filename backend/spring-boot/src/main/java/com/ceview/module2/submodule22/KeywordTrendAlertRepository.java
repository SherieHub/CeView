package com.ceview.module2.submodule22;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Database access for idempotent weekly keyword-trend alerts. */
public interface KeywordTrendAlertRepository extends JpaRepository<KeywordTrendAlert, UUID> {

    Optional<KeywordTrendAlert> findByBusinessProfileIdAndCategoryAndIsoYearAndIsoWeek(
            UUID businessProfileId, String category, Short isoYear, Short isoWeek);

    List<KeywordTrendAlert> findByBusinessProfileIdOrderByCreatedAtDesc(UUID businessProfileId);

    Optional<KeywordTrendAlert> findByKeywordTrendAlertIdAndBusinessProfileId(
            UUID keywordTrendAlertId, UUID businessProfileId);
}
