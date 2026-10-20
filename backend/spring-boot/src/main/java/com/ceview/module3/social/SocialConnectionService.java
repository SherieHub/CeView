package com.ceview.module3.social;

import com.ceview.common.crypto.TokenCipher;
import com.ceview.module3.social.SocialDtos.PageOption;
import com.ceview.module3.social.SocialDtos.SocialConnectionView;
import com.ceview.module3.social.client.MetaGraphClient;
import com.ceview.module3.social.client.MetaGraphClient.PageInfo;
import com.ceview.module3.social.client.TikTokContentClient;
import com.ceview.module3.social.client.TikTokContentClient.CreatorGrant;
import com.ceview.module4.adconnections.AdConnectionService;
import com.ceview.module4.adconnections.AdPlatformConnection;
import com.ceview.module4.adconnections.AdPlatformConnectionRepository;
import com.ceview.module4.adconnections.AdProvider;
import com.ceview.module4.adconnections.AdProviderProperties;
import com.ceview.module4.adconnections.MetaConnectionResetEvent;
import com.ceview.module4.adconnections.client.MetaAdsClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.EventListener;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;

import java.time.OffsetDateTime;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Connection state for Facebook, Instagram and TikTok publishing.
 *
 * <p>Facebook and Instagram share one Meta login — the ads connection
 * ({@code tbl_ad_platform_connection}, provider {@code meta}) — plus the Page the operator
 * picks; their status is derived from both. TikTok has its own login.
 */
@Service
public class SocialConnectionService {

    private static final Logger log = LoggerFactory.getLogger(SocialConnectionService.class);

    public static final String FACEBOOK = "facebook";
    public static final String INSTAGRAM = "instagram";
    public static final String TIKTOK = "tiktok";
    private static final Set<String> PLATFORMS = Set.of(FACEBOOK, INSTAGRAM, TIKTOK);

    /** The state-table key for the TikTok creator login (see V49). */
    public static final String TIKTOK_STATE_KEY = "tiktok_creator";

    /** Scope without which TikTok publishing cannot work; its absence means "log in again". */
    private static final String TIKTOK_UPLOAD_SCOPE = "video.upload";

    private final PublishingAccountRepository accountRepo;
    private final AdPlatformConnectionRepository metaRepo;
    private final TokenCipher cipher;
    private final MetaGraphClient graph;
    private final TikTokContentClient tiktok;
    private final AdProviderProperties adProps;
    private final AdConnectionService stateService;
    private final TransactionTemplate tx;

    public SocialConnectionService(PublishingAccountRepository accountRepo,
                                   AdPlatformConnectionRepository metaRepo,
                                   TokenCipher cipher,
                                   MetaGraphClient graph,
                                   TikTokContentClient tiktok,
                                   AdProviderProperties adProps,
                                   AdConnectionService stateService,
                                   PlatformTransactionManager transactionManager) {
        this.accountRepo = accountRepo;
        this.metaRepo = metaRepo;
        this.cipher = cipher;
        this.graph = graph;
        this.tiktok = tiktok;
        this.adProps = adProps;
        this.stateService = stateService;
        this.tx = new TransactionTemplate(transactionManager);
    }

    // ── reading ──────────────────────────────────────────────────────────────

    /** Always three rows, in a stable order, so the UI never has to guess. */
    @Transactional(readOnly = true)
    public List<SocialConnectionView> list(UUID profileId) {
        Map<String, PublishingAccount> accounts = accountRepo.findByBusinessProfileId(profileId).stream()
                .collect(Collectors.toMap(PublishingAccount::getPlatform, Function.identity()));
        Optional<AdPlatformConnection> meta = activeMeta(profileId);
        return List.of(
                metaView(FACEBOOK, meta, accounts),
                metaView(INSTAGRAM, meta, accounts),
                tiktokView(accounts.get(TIKTOK)));
    }

    private SocialConnectionView metaView(String platform, Optional<AdPlatformConnection> meta,
                                          Map<String, PublishingAccount> accounts) {
        boolean configured = adProps.isConfigured(AdProvider.META) && cipher.isConfigured();
        if (meta.isEmpty()) {
            return view(platform, configured, SocialDtos.STATUS_DISCONNECTED, null, null);
        }
        if (!canPublish(meta.get())) {
            return view(platform, configured, SocialDtos.STATUS_NEEDS_RECONNECT, null, null);
        }
        PublishingAccount page = accounts.get(FACEBOOK);
        if (page != null && PublishingAccount.STATUS_NEEDS_RECONNECT.equals(page.getStatus())) {
            return view(platform, configured, SocialDtos.STATUS_NEEDS_RECONNECT, null, null);
        }
        if (!isActive(page)) {
            return view(platform, configured, SocialDtos.STATUS_NEEDS_PAGE, null, null);
        }
        if (FACEBOOK.equals(platform)) {
            return view(platform, configured, SocialDtos.STATUS_ACTIVE, page.getDisplayName(), page.getConnectedAt());
        }
        PublishingAccount ig = accounts.get(INSTAGRAM);
        if (ig != null && PublishingAccount.STATUS_NEEDS_RECONNECT.equals(ig.getStatus())) {
            return view(platform, configured, SocialDtos.STATUS_NEEDS_RECONNECT, null, null);
        }
        if (!isActive(ig)) {
            return view(platform, configured, SocialDtos.STATUS_NO_LINKED_INSTAGRAM, null, null);
        }
        return view(platform, configured, SocialDtos.STATUS_ACTIVE, ig.getDisplayName(), ig.getConnectedAt());
    }

    private SocialConnectionView tiktokView(PublishingAccount account) {
        boolean configured = tiktok.isConfigured() && cipher.isConfigured();
        if (account == null || PublishingAccount.STATUS_REVOKED.equals(account.getStatus())) {
            return view(TIKTOK, configured, SocialDtos.STATUS_DISCONNECTED, null, null);
        }
        if (PublishingAccount.STATUS_NEEDS_RECONNECT.equals(account.getStatus())) {
            return view(TIKTOK, configured, SocialDtos.STATUS_NEEDS_RECONNECT, null, null);
        }
        if (tiktokNeedsReconnect(account)) {
            return view(TIKTOK, configured, SocialDtos.STATUS_NEEDS_RECONNECT, null, null);
        }
        return view(TIKTOK, configured, SocialDtos.STATUS_ACTIVE, account.getDisplayName(), account.getConnectedAt());
    }

    /** The refresh token has lapsed, or the stored grant lacks the upload permission. */
    private static boolean tiktokNeedsReconnect(PublishingAccount account) {
        if (account.getRefreshExpiresAt() != null && account.getRefreshExpiresAt().isBefore(OffsetDateTime.now())) {
            return true;
        }
        // Unknown scopes (null) are not held against the grant.
        return account.getScopes() != null
                && !Arrays.asList(account.getScopes().split("[,\\s]+")).contains(TIKTOK_UPLOAD_SCOPE);
    }

    private static SocialConnectionView view(String platform, boolean configured, String status,
                                             String handle, OffsetDateTime connectedAt) {
        return new SocialConnectionView(platform, configured, status, handle, connectedAt);
    }

    private static boolean isActive(PublishingAccount a) {
        return a != null && PublishingAccount.STATUS_ACTIVE.equals(a.getStatus());
    }

    private Optional<AdPlatformConnection> activeMeta(UUID profileId) {
        return metaRepo.findByBusinessProfileIdAndProvider(profileId, AdProvider.META.key())
                .filter(c -> !AdPlatformConnection.STATUS_REVOKED.equals(c.getStatus()));
    }

    /** The login holds every publishing permission and has not expired. */
    private static boolean canPublish(AdPlatformConnection meta) {
        if (meta.getTokenExpiresAt() != null && meta.getTokenExpiresAt().isBefore(OffsetDateTime.now())) {
            return false;
        }
        Set<String> held = meta.getScopes() == null ? Set.of()
                : new HashSet<>(Arrays.asList(meta.getScopes().split("[,\\s]+")));
        return held.containsAll(MetaAdsClient.PUBLISH_SCOPES);
    }

    // ── Facebook Page / Instagram ────────────────────────────────────────────

    /**
     * The Pages the Meta login administers, for the operator to choose from. Deliberately not
     * transactional: no database connection is held while Meta is being called.
     */
    public List<PageOption> listPages(UUID profileId) {
        AdPlatformConnection meta = requirePublishableMeta(profileId);
        return fetchPages(meta).stream()
                .map(p -> new PageOption(p.id(), p.name(), p.instagramUsername()))
                .toList();
    }

    /**
     * Binds publishing to one Page (and its linked Instagram account, if any). The page id is
     * re-checked against what the login can really see - a posted id is never trusted. The Meta
     * connection is read and Graph is called outside any transaction; only the two row writes
     * share a short one.
     */
    public void selectPage(UUID profileId, String pageId) {
        AdPlatformConnection meta = requirePublishableMeta(profileId);
        String metaScopes = meta.getScopes();

        PageInfo chosen = fetchPages(meta).stream().filter(p -> pageId.equals(p.id())).findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "that Page is not available to this Meta connection"));
        if (chosen.accessToken() == null || chosen.accessToken().isBlank()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Meta did not grant access to that Page — reconnect and allow Page access");
        }

        String encryptedPageToken = cipher.encrypt(chosen.accessToken());
        tx.executeWithoutResult(status -> {
            AdPlatformConnection current = metaRepo.lockOwned(profileId, AdProvider.META.key()).orElseThrow(() ->
                    new ResponseStatusException(HttpStatus.CONFLICT,"Meta connection changed — choose the Page again"));
            if (!java.util.Objects.equals(meta.getAccessTokenEncrypted(),current.getAccessTokenEncrypted())
                    || AdPlatformConnection.STATUS_REVOKED.equals(current.getStatus()) || !canPublish(current)) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,"Meta connection changed — choose the Page again");
            }
            activate(profileId, FACEBOOK, chosen.id(), chosen.name(), encryptedPageToken, metaScopes);
            if (chosen.instagramId() != null) {
                activate(profileId, INSTAGRAM, chosen.instagramId(), instagramHandle(chosen.instagramUsername()),
                        encryptedPageToken, metaScopes);
            } else {
                accountRepo.findByBusinessProfileIdAndPlatform(profileId, INSTAGRAM).ifPresent(this::revoke);
            }
        });
        log.info("[Module3] profile={} chose Facebook Page {} (instagram linked: {})",
                profileId, chosen.id(), chosen.instagramId() != null);
    }

    private static String instagramHandle(String username) {
        return username == null || username.isBlank() ? "Instagram account" : "@" + username;
    }

    private List<PageInfo> fetchPages(AdPlatformConnection meta) {
        try {
            return graph.listPages(cipher.decrypt(meta.getAccessTokenEncrypted()));
        } catch (SocialPlatformException e) {
            if (e.isAuthFailure()) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Meta session expired — reconnect");
            }
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, e.getMessage());
        }
    }

    private AdPlatformConnection requirePublishableMeta(UUID profileId) {
        if (!cipher.isConfigured()) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,"Token encryption is not configured");
        AdPlatformConnection meta = activeMeta(profileId).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.CONFLICT, "connect Meta first"));
        if (!canPublish(meta)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "reconnect Meta to grant the publishing permissions");
        }
        return meta;
    }

    // ── TikTok ───────────────────────────────────────────────────────────────

    /**
     * Finishes the TikTok login for the <em>authenticated</em> caller. The public callback only
     * hands the code and state to the SPA; binding them to the caller's own session here is what
     * stops a victim's browser from completing an attacker-started flow. A state minted by a
     * different profile is burned and refused.
     */
    public void completeTikTok(UUID callerProfileId, String code, String state) {
        if (!cipher.isConfigured()) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,"Token encryption is not configured");
        UUID stateId;
        try {
            stateId = UUID.fromString(state);
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "invalid_state");
        }

        UUID stateProfileId;
        try {
            stateProfileId = stateService.consumeState(stateId, TIKTOK_STATE_KEY);
        } catch (IllegalStateException e) {
            log.info("[Module3] TikTok completion had an invalid state: {}", e.getMessage());
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "invalid_state");
        }
        if (!stateProfileId.equals(callerProfileId)) {
            log.warn("[Module3] TikTok completion refused: state belongs to a different profile");
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "this TikTok login was not started by you");
        }

        CreatorGrant grant;
        String displayName;
        try {
            grant = tiktok.exchangeCode(code);
            displayName = tiktok.fetchDisplayName(grant.accessToken());
        } catch (SocialPlatformException | IllegalStateException e) {
            log.warn("[Module3] TikTok token exchange failed: {}", e.getMessage());
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "TikTok token exchange failed");
        }

        try {
            tx.executeWithoutResult(status -> storeTikTokGrant(callerProfileId, grant, displayName));
        } catch (DataIntegrityViolationException e) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "TikTok connection is already being finished");
        }
    }

    /** Stores (or replaces) the TikTok creator login. {@code displayName} may be null. */
    @Transactional
    public void storeTikTokGrant(UUID profileId, CreatorGrant grant, String displayName) {
        PublishingAccount account = accountRepo.findByBusinessProfileIdAndPlatform(profileId, TIKTOK)
                .orElseGet(PublishingAccount::new);
        account.setBusinessProfileId(profileId);
        account.setPlatform(TIKTOK);
        account.setExternalId(grant.openId() != null ? grant.openId() : "unknown");
        account.setDisplayName(displayName != null && !displayName.isBlank() ? displayName : "TikTok account");
        account.setAccessTokenEncrypted(cipher.encrypt(grant.accessToken()));
        account.setRefreshTokenEncrypted(grant.refreshToken() == null ? null : cipher.encrypt(grant.refreshToken()));
        account.setTokenExpiresAt(grant.accessExpiresAt());
        account.setRefreshExpiresAt(grant.refreshExpiresAt());
        account.setScopes(grant.scopes());
        account.setStatus(PublishingAccount.STATUS_ACTIVE);
        account.setConnectedAt(OffsetDateTime.now());
        accountRepo.save(account);
        log.info("[Module3] stored TikTok creator grant for profile={}", profileId);
    }

    // ── Meta login changes ───────────────────────────────────────────────────────

    /**
     * The Meta login was replaced (possibly by a different Facebook user) or disconnected, so the
     * Page tokens derived from the old one must go. Runs synchronously in the publisher's
     * transaction, so the reset commits or rolls back together with the Meta change.
     */
    @EventListener
    @Transactional
    public void onMetaConnectionReset(MetaConnectionResetEvent event) {
        for (String platform : List.of(FACEBOOK, INSTAGRAM)) {
            accountRepo.findByBusinessProfileIdAndPlatform(event.businessProfileId(), platform)
                    .ifPresent(this::revoke);
        }
        log.info("[Module3] Meta login reset for profile={}; Facebook/Instagram publishing rows revoked",
                event.businessProfileId());
    }

    // ── disconnecting ────────────────────────────────────────────────────────

    /**
     * Discards the stored credentials. Facebook and Instagram are one grant, so disconnecting
     * either revokes both; the Meta ads connection is untouched.
     */
    @Transactional
    public void disconnect(UUID profileId, String platform) {
        if (!PLATFORMS.contains(platform)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "unknown platform: " + platform);
        }
        List<String> targets = TIKTOK.equals(platform) ? List.of(TIKTOK) : List.of(FACEBOOK, INSTAGRAM);
        for (String target : targets) {
            accountRepo.findByBusinessProfileIdAndPlatform(profileId, target).ifPresent(this::revoke);
        }
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private void activate(UUID profileId, String platform, String externalId, String displayName,
                          String encryptedToken, String scopes) {
        PublishingAccount account = accountRepo.findByBusinessProfileIdAndPlatform(profileId, platform)
                .orElseGet(PublishingAccount::new);
        account.setBusinessProfileId(profileId);
        account.setPlatform(platform);
        account.setExternalId(externalId);
        account.setDisplayName(displayName);
        account.setAccessTokenEncrypted(encryptedToken);
        account.setRefreshTokenEncrypted(null);
        // A Page token minted from a long-lived user token does not expire.
        account.setTokenExpiresAt(null);
        account.setRefreshExpiresAt(null);
        account.setScopes(scopes);
        account.setStatus(PublishingAccount.STATUS_ACTIVE);
        account.setConnectedAt(OffsetDateTime.now());
        accountRepo.save(account);
    }

    private void revoke(PublishingAccount account) {
        account.setAccessTokenEncrypted("");
        account.setRefreshTokenEncrypted(null);
        account.setTokenExpiresAt(null);
        account.setRefreshExpiresAt(null);
        account.setStatus(PublishingAccount.STATUS_REVOKED);
        accountRepo.save(account);
    }
}
