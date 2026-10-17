package com.ceview.module4.attribution;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AttributionCodeRepository extends JpaRepository<AttributionCode, UUID> {

  /**
   * The mint lookup. Keyed on the window tuple rather than the alert id, because alerts are deleted
   * and re-inserted on every pipeline run — see {@link AttributionCode}.
   */
  Optional<AttributionCode> findByBusinessProfileIdAndCategoryAndTargetMarketAndWindowStart(
      UUID businessProfileId, String category, String targetMarket, OffsetDateTime windowStart);

  /** Tenant-scoped read for the Performance screen and the code picker. */
  List<AttributionCode> findByBusinessProfileIdOrderByWindowStartDesc(UUID businessProfileId);

  /** Codes whose window covers {@code at}. Used by the log-a-booking picker. */
  List<AttributionCode>
      findByBusinessProfileIdAndWindowStartLessThanEqualAndWindowEndGreaterThanEqual(
          UUID businessProfileId, OffsetDateTime at, OffsetDateTime sameAt);

  /** Always paired with the profile id: a code id alone must never resolve cross-tenant. */
  Optional<AttributionCode> findByAttributionCodeIdAndBusinessProfileId(
      UUID attributionCodeId, UUID businessProfileId);

  Optional<AttributionCode> findByBusinessProfileIdAndCode(UUID businessProfileId, String code);

  /** Resolves the code for content generation, given the alert the operator opened. */
  Optional<AttributionCode> findByDemandAlertId(UUID demandAlertId);
}
