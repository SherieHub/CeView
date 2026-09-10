package com.ceview.module4.adconnections;

import com.ceview.common.crypto.TokenCipher;
import com.ceview.module4.adconnections.AdConnectionDtos.AdAccountOption;
import com.ceview.module4.adconnections.client.TokenGrant;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Owns the connection lifecycle: minting and consuming OAuth state, storing an
 * encrypted grant, recording the operator's account choice, and disconnecting.
 *
 * <p>It does not talk to the platforms — that is {@code AdPlatformClient}'s job.
 */
@Service
public class AdConnectionService {

    private static final Logger log = LoggerFactory.getLogger(AdConnectionService.class);

    /**
     * How long an operator has to complete the consent screen. Ten minutes is
     * generous for a redirect flow and short enough that a leaked state value
     * is not useful for long.
     */
    static final Duration STATE_TTL = Duration.ofMinutes(10);

    private final AdOAuthStateRepository stateRepo;
    private final AdPlatformConnectionRepository connectionRepo;
    private final TokenCipher tokenCipher;

    public AdConnectionService(AdOAuthStateRepository stateRepo,
                               AdPlatformConnectionRepository connectionRepo,
                               TokenCipher tokenCipher) {
        this.stateRepo = stateRepo;
        this.connectionRepo = connectionRepo;
        this.tokenCipher = tokenCipher;
    }

    /**
     * Creates the single-use token that carries this operator's identity through
     * the un-authenticated callback.
     */
    @Transactional
    public UUID mintState(UUID businessProfileId, AdProvider provider) {
        // Opportunistic housekeeping — rows nobody came back for.
        stateRepo.deleteExpiredBefore(OffsetDateTime.now().minusDays(1));

        AdOAuthState state = new AdOAuthState();
        state.setBusinessProfileId(businessProfileId);
        state.setProvider(provider.key());
        state.setExpiresAt(OffsetDateTime.now().plus(STATE_TTL));
        return stateRepo.save(state).getState();
    }

    /**
     * Validates and burns a state token.
     *
     * <p>The "already used" check cannot be a plain read-then-write: two
     * concurrent callbacks carrying the same state value (double-submit,
     * browser retry, a replayed callback within the TTL window) could both
     * read {@code consumedAt == null} before either commits. The actual burn
     * is therefore an atomic conditional {@code UPDATE}
     * ({@link AdOAuthStateRepository#markConsumedIfUnconsumed}) — only one
     * concurrent caller can ever have it report success, regardless of how
     * many threads read the row as unconsumed beforehand.
     *
     * @return the business profile that started this flow
     * @throws IllegalStateException if the token is unknown, expired, already
     *         used, or was minted for a different provider — the caller turns
     *         this into an error redirect, never a stack trace in the browser
     */
    @Transactional
    public UUID consumeState(UUID state, AdProvider provider) {
        AdOAuthState row = stateRepo.findById(state)
                .orElseThrow(() -> new IllegalStateException("unknown oauth state"));

        if (row.getConsumedAt() != null) {
            throw new IllegalStateException("oauth state already used");
        }
        if (row.getExpiresAt().isBefore(OffsetDateTime.now())) {
            throw new IllegalStateException("oauth state expired");
        }
        if (!row.getProvider().equals(provider.key())) {
            throw new IllegalStateException("oauth state was minted for a different provider");
        }

        int updated = stateRepo.markConsumedIfUnconsumed(state, OffsetDateTime.now());
        if (updated == 0) {
            // Someone else won the race (or it expired in the gap since the read above).
            throw new IllegalStateException("oauth state already used");
        }
        return row.getBusinessProfileId();
    }

    /**
     * Persists a fresh grant, replacing any existing one for this provider so a
     * reconnect does not violate {@code uq_ad_conn_profile_provider}.
     *
     * <p>The connection lands in PENDING_ACCOUNT_SELECTION: a grant without a
     * chosen ad account cannot be synced.
     */
    @Transactional
    public void storeGrant(UUID businessProfileId, AdProvider provider, TokenGrant grant) {
        AdPlatformConnection conn = connectionRepo
                .findByBusinessProfileIdAndProvider(businessProfileId, provider.key())
                .orElseGet(AdPlatformConnection::new);

        conn.setBusinessProfileId(businessProfileId);
        conn.setProvider(provider.key());
        conn.setAccessTokenEncrypted(tokenCipher.encrypt(grant.accessToken()));
        conn.setRefreshTokenEncrypted(grant.refreshToken() == null
                ? null : tokenCipher.encrypt(grant.refreshToken()));
        conn.setTokenExpiresAt(grant.expiresAt());
        conn.setScopes(grant.scopes());
        conn.setStatus(AdPlatformConnection.STATUS_PENDING_ACCOUNT_SELECTION);
        conn.setConnectedAt(OffsetDateTime.now());
        // A reconnect may be to a different account entirely — clear the old choice.
        conn.setExternalAccountId(null);
        conn.setExternalAccountName(null);
        conn.setCurrency(null);
        conn.setExternalCampaignId(null);
        conn.setExternalCampaignName(null);

        connectionRepo.save(conn);
        log.info("[Module4] stored {} grant for profile={}", provider.key(), businessProfileId);
    }

    /** Records which ad account to report on, and activates the connection. */
    @Transactional
    public AdPlatformConnection selectAccount(UUID businessProfileId, AdProvider provider,
                                              AdAccountOption account) {
        AdPlatformConnection conn = requireConnection(businessProfileId, provider);

        conn.setExternalAccountId(account.id());
        conn.setExternalAccountName(account.name());
        conn.setCurrency(account.currency() == null ? null : account.currency().toUpperCase());
        // A campaign belongs to the account it was chosen from — dropping the
        // account invalidates it.
        conn.setExternalCampaignId(null);
        conn.setExternalCampaignName(null);
        conn.setStatus(AdPlatformConnection.STATUS_ACTIVE);

        log.info("[Module4] {} connection activated for profile={} account={}",
                 provider.key(), businessProfileId, account.id());
        return connectionRepo.save(conn);
    }

    /**
     * Pins the connection to one campaign, or clears the pin when {@code campaign}
     * is null (report on the whole account again).
     *
     * @throws IllegalStateException if no ad account has been chosen yet — a
     *         campaign only makes sense within a selected account
     */
    @Transactional
    public AdPlatformConnection selectCampaign(UUID businessProfileId, AdProvider provider,
                                               AdConnectionDtos.AdCampaignOption campaign) {
        AdPlatformConnection conn = requireConnection(businessProfileId, provider);
        if (conn.getExternalAccountId() == null) {
            throw new IllegalStateException(
                    "choose an ad account before choosing a campaign for " + provider.key());
        }
        if (campaign == null) {
            conn.setExternalCampaignId(null);
            conn.setExternalCampaignName(null);
        } else {
            conn.setExternalCampaignId(campaign.id());
            conn.setExternalCampaignName(campaign.name());
        }
        log.info("[Module4] {} reporting scope set for profile={}: {}",
                 provider.key(), businessProfileId,
                 campaign == null ? "whole account" : "campaign " + campaign.id());
        return connectionRepo.save(conn);
    }

    /**
     * Discards the tokens and marks the connection revoked. The row itself is
     * kept: "this operator once connected Meta and disconnected" is worth
     * knowing, and historical insight rows still reference the provider.
     */
    @Transactional
    public void disconnect(UUID businessProfileId, AdProvider provider) {
        connectionRepo.findByBusinessProfileIdAndProvider(businessProfileId, provider.key())
                .ifPresent(conn -> {
                    conn.setAccessTokenEncrypted("");
                    conn.setRefreshTokenEncrypted(null);
                    conn.setTokenExpiresAt(null);
                    conn.setStatus(AdPlatformConnection.STATUS_REVOKED);
                    connectionRepo.save(conn);
                    log.info("[Module4] {} connection revoked for profile={}",
                             provider.key(), businessProfileId);
                });
    }

    /** The usable, decrypted access token for a stored connection. */
    public String accessTokenOf(AdPlatformConnection conn) {
        return tokenCipher.decrypt(conn.getAccessTokenEncrypted());
    }

    public AdPlatformConnection requireConnection(UUID businessProfileId, AdProvider provider) {
        return connectionRepo
                .findByBusinessProfileIdAndProvider(businessProfileId, provider.key())
                .filter(c -> !AdPlatformConnection.STATUS_REVOKED.equals(c.getStatus()))
                .orElseThrow(() -> new IllegalStateException(
                        "no active " + provider.key() + " connection for this operator"));
    }
}
