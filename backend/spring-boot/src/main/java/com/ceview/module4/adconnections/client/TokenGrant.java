package com.ceview.module4.adconnections.client;

import java.time.OffsetDateTime;

/**
 * A usable token plus what we know about its lifetime.
 *
 * @param refreshToken null where the platform does not issue one (Meta's
 *                     long-lived token has no refresh partner — it is
 *                     re-exchanged before expiry instead)
 * @param expiresAt    null when the platform does not say
 */
public record TokenGrant(String accessToken,
                         String refreshToken,
                         OffsetDateTime expiresAt,
                         String scopes) {}
