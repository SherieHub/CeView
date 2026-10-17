package com.ceview.module4.attribution.link;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AttributionEnquiryRepository extends JpaRepository<AttributionEnquiry, UUID> {

  /** Backs the one-enquiry-per-click rule; a double-submit must not book twice. */
  boolean existsByClickId(UUID clickId);

  Optional<AttributionEnquiry> findByClickId(UUID clickId);

  List<AttributionEnquiry> findByBusinessProfileIdOrderByCreatedAtDesc(UUID businessProfileId);
}
