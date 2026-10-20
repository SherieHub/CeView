package com.ceview.module3.media;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

/**
 * Tenant-scoped lookups only: there is deliberately no way to fetch an asset by
 * id alone for an authenticated caller. (The dev-only local upload endpoint reads
 * by id because the unguessable id is its credential.)
 */
public interface MediaAssetRepository extends JpaRepository<MediaAsset, UUID> {

    Optional<MediaAsset> findByMediaIdAndBusinessProfileId(UUID mediaId, UUID businessProfileId);
}
