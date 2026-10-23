package com.ceview.module3.submodule31;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Every query is scoped by profile: there is no way to read another tenant's draft. */
public interface ContentStudioDraftRepository extends JpaRepository<ContentStudioDraft, UUID> {

    List<ContentStudioDraft> findByBusinessProfileIdAndMarketAndKindOrderByUpdatedAtDesc(
            UUID businessProfileId, String market, String kind);

    Optional<ContentStudioDraft> findByDraftIdAndBusinessProfileId(UUID draftId, UUID businessProfileId);

    Optional<ContentStudioDraft> findFirstByBusinessProfileIdAndMarketAndKind(
            UUID businessProfileId, String market, String kind);

    long countByBusinessProfileIdAndMarketAndKind(UUID businessProfileId, String market, String kind);
}
