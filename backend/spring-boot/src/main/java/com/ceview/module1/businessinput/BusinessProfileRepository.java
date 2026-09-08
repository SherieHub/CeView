package com.ceview.module1.businessinput;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface BusinessProfileRepository extends JpaRepository<BusinessProfile, UUID> {
    Optional<BusinessProfile> findFirstByUserId(UUID userId);

    /**
     * Every real tenant profile, with the V26 uniqueness-corpus reference rows
     * ({@code is_reference = TRUE}, no operator) excluded. Use this for any
     * cross-operator sweep — {@code findAll()} would drag the reference corpus
     * into tenant-facing work. See {@code ReferenceProfileIsolationTest}.
     */
    @Query("select p from BusinessProfile p where p.isReference = false")
    List<BusinessProfile> findAllNonReference();
}
