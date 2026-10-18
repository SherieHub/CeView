package com.ceview.auth;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface EmailCodeRepository extends JpaRepository<EmailCode, UUID> {

    /** The most recent code for this operator and purpose that has not been consumed. */
    Optional<EmailCode> findFirstByOperatorIdAndPurposeAndConsumedAtIsNullOrderByCreatedAtDesc(
        UUID operatorId, EmailCode.Purpose purpose);

    /** Newest code of any state, used for the resend cooldown. */
    Optional<EmailCode> findFirstByOperatorIdAndPurposeOrderByCreatedAtDesc(
        UUID operatorId, EmailCode.Purpose purpose);

    /** Codes issued since {@code since}, oldest first, used for the hourly send cap. */
    List<EmailCode> findByOperatorIdAndPurposeAndCreatedAtAfterOrderByCreatedAtAsc(
        UUID operatorId, EmailCode.Purpose purpose, OffsetDateTime since);

    List<EmailCode> findByOperatorIdAndConsumedAtIsNull(UUID operatorId);

    void deleteByOperatorId(UUID operatorId);
}
