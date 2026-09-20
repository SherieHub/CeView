package com.ceview.module4.attribution.link;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AttributionLinkRepository extends JpaRepository<AttributionLink, UUID> {

    /**
     * The redirect's only lookup, and the hottest query in the feature — it runs
     * on the traveller's critical path, before anything is rendered. Backed by
     * {@code uq_attr_link_slug}.
     *
     * <p>Deliberately not profile-scoped: the request arrives from a browser
     * with no JWT. The slug <em>is</em> the credential, which is why it is
     * random rather than derived.
     */
    Optional<AttributionLink> findBySlug(String slug);

    /**
     * The mint lookup. Keyed on the window tuple, not the alert id — alerts are
     * deleted and re-inserted on every pipeline run, and a slug already live
     * inside a running ad must survive that.
     */
    Optional<AttributionLink> findByBusinessProfileIdAndCategoryAndTargetMarketAndWindowStart(
            UUID businessProfileId, String category, String targetMarket, OffsetDateTime windowStart);

    List<AttributionLink> findByBusinessProfileIdOrderByWindowStartDesc(UUID businessProfileId);

    /** Always paired with the profile id: a link id alone must never resolve cross-tenant. */
    Optional<AttributionLink> findByLinkIdAndBusinessProfileId(UUID linkId, UUID businessProfileId);

    Optional<AttributionLink> findByDemandAlertId(UUID demandAlertId);

    boolean existsBySlug(String slug);
}
