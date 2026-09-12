package com.ceview.module4.adconnections;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.UUID;

public interface AdOAuthStateRepository extends JpaRepository<AdOAuthState, UUID> {

    /**
     * Housekeeping for rows nobody came back for. Called opportunistically on
     * each authorize request — this table churns slowly enough that it does not
     * warrant a scheduled job.
     *
     * <p><b>Must be called from within a {@code @Transactional} method</b> — as
     * a bulk {@code @Modifying} DELETE, it throws
     * {@link jakarta.persistence.TransactionRequiredException} if invoked
     * without an active transaction.
     */
    @Modifying
    @Query("DELETE FROM AdOAuthState s WHERE s.expiresAt < :cutoff")
    int deleteExpiredBefore(@Param("cutoff") OffsetDateTime cutoff);

    /**
     * Atomically marks a state consumed, returning 1 only if it was actually
     * unconsumed at the moment of the update — this is what makes
     * {@code AdConnectionService.consumeState} safe against two concurrent
     * requests racing on the same state value. A plain read-then-write is not
     * safe here: at READ COMMITTED isolation, two transactions can both read
     * {@code consumedAt == null} before either commits.
     */
    @Modifying
    @Query("UPDATE AdOAuthState s SET s.consumedAt = :now " +
           "WHERE s.state = :state AND s.consumedAt IS NULL")
    int markConsumedIfUnconsumed(@Param("state") UUID state, @Param("now") OffsetDateTime now);
}
