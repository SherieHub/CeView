package com.ceview.module2.submodule21;

import org.springframework.data.jpa.repository.JpaRepository;

/** Route reference lookup by the stable market identifier. */
public interface MarketRouteReferenceRepository extends JpaRepository<MarketRouteReference, String> {
}
