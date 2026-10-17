package com.ceview.module3.submodule32;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CreativeDirectionOutputRepository
    extends JpaRepository<CreativeDirectionOutput, UUID> {

  /** Latest approved creative output for a profile+market (FR3.11 dependency check). */
  Optional<CreativeDirectionOutput>
      findTopByBusinessProfileIdAndSelectedMarketAndApprovalStatusTrueOrderByGeneratedAtDesc(
          UUID businessProfileId, String selectedMarket);

  /** Latest generated output (approved or not) for regeneration flow. */
  Optional<CreativeDirectionOutput>
      findTopByBusinessProfileIdAndSelectedMarketOrderByGeneratedAtDesc(
          UUID businessProfileId, String selectedMarket);
}
