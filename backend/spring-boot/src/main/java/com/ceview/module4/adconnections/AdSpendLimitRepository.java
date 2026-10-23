package com.ceview.module4.adconnections;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

/** Keyed by the business profile id, so every lookup is already tenant-scoped. */
public interface AdSpendLimitRepository extends JpaRepository<AdSpendLimit, UUID> {
}
