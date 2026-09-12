package com.ceview.module4.adconnections;

import com.ceview.auth.CurrentBusinessProfile;
import com.ceview.common.TraceIdFilter;
import com.ceview.module4.adconnections.AdConnectionDtos.AdAccountOption;
import com.ceview.module4.adconnections.AdConnectionDtos.AdCampaignOption;
import com.ceview.module4.adconnections.AdConnectionDtos.AdConnectionView;
import com.ceview.module4.adconnections.AdConnectionDtos.AuthorizeUrlResponse;
import com.ceview.module4.adconnections.AdConnectionDtos.InsightsResponse;
import com.ceview.module4.adconnections.AdConnectionDtos.SelectAccountRequest;
import com.ceview.module4.adconnections.AdConnectionDtos.SelectCampaignRequest;
import com.ceview.module4.adconnections.client.AdPlatformClient;
import com.ceview.module4.adconnections.client.AdPlatformException;
import com.ceview.module4.adconnections.client.TokenGrant;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Submodule 4.1 — ad-platform account connections.
 *
 * <p>Every endpoint except the callback is JWT-authenticated and scoped to the
 * caller's own business profile. The callback is deliberately public; see
 * {@link AdOAuthState} for how tenancy survives that.
 */
@RestController
@RequestMapping("/api/ad-connections")
public class AdConnectionController {

    private static final Logger log = LoggerFactory.getLogger(AdConnectionController.class);

    /** OAuth error codes the platforms are known to send — safe to echo verbatim. */
    private static final Set<String> KNOWN_OAUTH_ERRORS = Set.of(
            "access_denied", "server_error", "temporarily_unavailable", "invalid_scope");

    private final AdProviderProperties props;
    private final AdPlatformConnectionRepository connectionRepo;
    private final CurrentBusinessProfile currentBusinessProfile;
    private final AdConnectionService service;
    private final List<AdPlatformClient> clients;
    private final AdInsightSyncService syncService;

    /**
     * Built from {@link #clients} on first use rather than injected as a
     * ready-made {@code Map} bean: a {@code Map} bean assembled eagerly at
     * context-refresh time (via {@code Collectors.toMap(AdPlatformClient::provider, ...)})
     * would call {@code provider()} on every client bean before a test's
     * {@code @MockBean} has had a chance to stub it in {@code @BeforeEach},
     * silently keying the map on {@code null}. Resolving it lazily here means
     * the lookup only runs once a request is actually being served.
     */
    public AdConnectionController(AdProviderProperties props,
                                   AdPlatformConnectionRepository connectionRepo,
                                   CurrentBusinessProfile currentBusinessProfile,
                                   AdConnectionService service,
                                   List<AdPlatformClient> clients,
                                   AdInsightSyncService syncService) {
        this.props = props;
        this.connectionRepo = connectionRepo;
        this.currentBusinessProfile = currentBusinessProfile;
        this.service = service;
        this.clients = clients;
        this.syncService = syncService;
    }

    /**
     * One row per provider, always — a provider with no connection row reports
     * DISCONNECTED rather than being omitted, so the UI can render a stable list.
     */
    @GetMapping
    public List<AdConnectionView> list() {
        UUID profileId = currentBusinessProfile.resolveProfileId();

        Map<String, AdPlatformConnection> byProvider =
                connectionRepo.findByBusinessProfileId(profileId).stream()
                        .collect(Collectors.toMap(AdPlatformConnection::getProvider,
                                                  Function.identity()));

        return Arrays.stream(AdProvider.values())
                .map(provider -> toView(provider, byProvider.get(provider.key())))
                .toList();
    }

    private AdConnectionView toView(AdProvider provider, AdPlatformConnection conn) {
        boolean configured = props.isConfigured(provider);
        if (conn == null) {
            return new AdConnectionView(provider.key(), configured,
                    AdConnectionDtos.STATUS_DISCONNECTED, null, null, null, null, null, null);
        }
        return new AdConnectionView(
                provider.key(),
                configured,
                conn.getStatus(),
                conn.getExternalAccountName(),
                conn.getCurrency(),
                conn.getConnectedAt(),
                conn.getLastSyncedAt(),
                conn.getExternalCampaignId(),
                conn.getExternalCampaignName());
    }

    /**
     * Pulls the given period's metrics from every connected ad account.
     *
     * <p>Synchronous on purpose: the operator pressed a button and is waiting.
     * A scheduled variant can reuse {@link AdInsightSyncService} unchanged.
     *
     * <p>This route is deliberately NOT under {@code /{provider}} — it spans
     * every connected provider in one call.
     */
    @GetMapping("/insights")
    public InsightsResponse insights(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate periodStart,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate periodEnd,
            @RequestParam(required = false) List<String> providers) {

        if (periodEnd.isBefore(periodStart)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "periodEnd must not be before periodStart");
        }
        if (java.time.temporal.ChronoUnit.DAYS.between(periodStart, periodEnd) > 366) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "date range must not exceed 366 days");
        }

        // Absent/empty = sync every connected account; a list = only those the
        // operator chose to include in this analysis.
        Set<AdProvider> only = null;
        if (providers != null && !providers.isEmpty()) {
            only = providers.stream().map(this::parseProvider).collect(Collectors.toSet());
        }
        return syncService.sync(currentBusinessProfile.resolveProfileId(), periodStart, periodEnd, only);
    }

    /** POST /{provider}/authorize — mints OAuth state and returns the consent-screen URL. */
    @PostMapping("/{provider}/authorize")
    public AuthorizeUrlResponse authorize(@PathVariable String provider) {
        AdProvider p = parseProvider(provider);
        requireConfigured(p);

        UUID profileId = currentBusinessProfile.resolveProfileId();
        UUID state = service.mintState(profileId, p);
        return new AuthorizeUrlResponse(clientFor(p).buildAuthorizeUrl(state.toString()));
    }

    /** GET /{provider}/accounts — the ad accounts this operator's grant can see. */
    @GetMapping("/{provider}/accounts")
    public List<AdAccountOption> accounts(@PathVariable String provider) {
        AdProvider p = parseProvider(provider);
        requireConfigured(p);
        return listAccountsFor(p, currentBusinessProfile.resolveProfileId());
    }

    /** POST /{provider}/account — records which ad account to report on and activates the connection. */
    @PostMapping("/{provider}/account")
    public AdConnectionView selectAccount(@PathVariable String provider,
                                          @RequestBody SelectAccountRequest body) {
        AdProvider p = parseProvider(provider);
        requireConfigured(p);
        UUID profileId = currentBusinessProfile.resolveProfileId();

        if (body == null || body.externalAccountId() == null || body.externalAccountId().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "externalAccountId is required");
        }

        // Re-fetch rather than trusting the posted id: this is the only thing
        // stopping a client from binding the connection to an arbitrary account.
        AdAccountOption chosen = listAccountsFor(p, profileId).stream()
                .filter(a -> body.externalAccountId().equals(a.id()))
                .findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "that ad account is not available to this connection"));

        return toView(p, service.selectAccount(profileId, p, chosen));
    }

    /** GET /{provider}/campaigns — the campaigns on the connection's selected ad account. */
    @GetMapping("/{provider}/campaigns")
    public List<AdCampaignOption> campaigns(@PathVariable String provider) {
        AdProvider p = parseProvider(provider);
        requireConfigured(p);
        return listCampaignsFor(p, currentBusinessProfile.resolveProfileId());
    }

    /** POST /{provider}/campaign — pins the sync to one campaign, or clears it with a null id. */
    @PostMapping("/{provider}/campaign")
    public AdConnectionView selectCampaign(@PathVariable String provider,
                                           @RequestBody(required = false) SelectCampaignRequest body) {
        AdProvider p = parseProvider(provider);
        requireConfigured(p);
        UUID profileId = currentBusinessProfile.resolveProfileId();

        String campaignId = body == null ? null : body.externalCampaignId();
        if (campaignId == null || campaignId.isBlank()) {
            try {
                return toView(p, service.selectCampaign(profileId, p, null));
            } catch (IllegalStateException e) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, e.getMessage());
            }
        }

        // Re-fetch and match, exactly as selectAccount guards against an
        // arbitrary posted id.
        AdCampaignOption chosen = listCampaignsFor(p, profileId).stream()
                .filter(c -> campaignId.equals(c.id()))
                .findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "that campaign is not available on this ad account"));

        return toView(p, service.selectCampaign(profileId, p, chosen));
    }

    /** DELETE /{provider} — revokes the stored grant. */
    @DeleteMapping("/{provider}")
    public ResponseEntity<Void> disconnect(@PathVariable String provider) {
        AdProvider p = parseProvider(provider);
        service.disconnect(currentBusinessProfile.resolveProfileId(), p);
        return ResponseEntity.noContent().build();
    }

    /**
     * OAuth redirect target. Always answers with a 302 back to the frontend —
     * never a JSON error — because the caller here is a browser mid-redirect,
     * not our own client code.
     *
     * <p>{@code provider} is a raw, attacker-influenced path segment (it can
     * legally contain unencoded {@code & = #} per RFC 3986), so it is resolved
     * against the known {@link AdProvider} enum before it touches the redirect
     * URL — never echoed back verbatim. The same applies to {@code error}: it
     * is attacker-suppliable free text on a public endpoint, so it is mapped to
     * a bounded, known-safe error code rather than ever landing in a URL.
     */
    @GetMapping("/{provider}/callback")
    public ResponseEntity<Void> callback(@PathVariable String provider,
                                         @RequestParam(required = false) String code,
                                         // TikTok's Business API names it auth_code, not code.
                                         @RequestParam(name = "auth_code", required = false) String authCode,
                                         @RequestParam(required = false) String state,
                                         @RequestParam(name = "error", required = false) String error) {
        String grantCode = (code != null && !code.isBlank()) ? code : authCode;

        AdProvider resolved;
        try {
            resolved = AdProvider.fromKey(provider);
        } catch (IllegalArgumentException e) {
            return redirectToFrontend("invalid_provider", "invalid_provider");
        }

        if (error != null && !error.isBlank()) {
            log.info("[Module4] {} callback returned an OAuth error: {}", resolved.key(), error);
            String safeErrorCode = KNOWN_OAUTH_ERRORS.contains(error.toLowerCase())
                    ? error.toLowerCase() : "consent_declined";
            return redirectToFrontend(resolved.key(), safeErrorCode);
        }

        if (grantCode == null || grantCode.isBlank() || state == null || state.isBlank()) {
            return redirectToFrontend(resolved.key(), "missing_code_or_state");
        }

        UUID profileId;
        try {
            profileId = service.consumeState(UUID.fromString(state), resolved);
        } catch (IllegalArgumentException | IllegalStateException e) {
            log.info("[Module4] {} callback had an invalid state: {}", resolved.key(), e.getMessage());
            return redirectToFrontend(resolved.key(), "invalid_state");
        }

        try {
            TokenGrant grant = clientFor(resolved).exchangeCode(grantCode);
            service.storeGrant(profileId, resolved, grant);
        } catch (AdPlatformException | IllegalStateException e) {
            log.warn("[Module4] {} token exchange failed: {}", resolved.key(), e.getMessage());
            return redirectToFrontend(resolved.key(), "token_exchange_failed");
        }

        return successRedirect(resolved.key());
    }

    private ResponseEntity<Void> redirectToFrontend(String provider, String errorCode) {
        String url = UriComponentsBuilder.fromUriString(props.getFrontendBaseUrl())
                .path("/settings/platforms")
                .queryParam("adconnect_error", errorCode)
                .queryParam("provider", provider)
                .build()
                .toUriString();
        return ResponseEntity.status(HttpStatus.FOUND).location(URI.create(url)).build();
    }

    private ResponseEntity<Void> successRedirect(String provider) {
        String url = UriComponentsBuilder.fromUriString(props.getFrontendBaseUrl())
                .path("/settings/platforms")
                .queryParam("adconnect", provider)
                .build()
                .toUriString();
        return ResponseEntity.status(HttpStatus.FOUND).location(URI.create(url)).build();
    }

    private List<AdAccountOption> listAccountsFor(AdProvider p, UUID profileId) {
        AdPlatformConnection conn;
        try {
            conn = service.requireConnection(profileId, p);
        } catch (IllegalStateException e) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, e.getMessage());
        }
        try {
            return clientFor(p).listAccounts(service.accessTokenOf(conn));
        } catch (AdPlatformException e) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, e.getMessage());
        }
    }

    private List<AdCampaignOption> listCampaignsFor(AdProvider p, UUID profileId) {
        AdPlatformConnection conn;
        try {
            conn = service.requireConnection(profileId, p);
        } catch (IllegalStateException e) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, e.getMessage());
        }
        if (conn.getExternalAccountId() == null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "choose an ad account before choosing a campaign");
        }
        try {
            return clientFor(p).listCampaigns(service.accessTokenOf(conn), conn.getExternalAccountId());
        } catch (AdPlatformException e) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, e.getMessage());
        }
    }

    private AdProvider parseProvider(String key) {
        try {
            return AdProvider.fromKey(key);
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "unknown ad provider: " + key);
        }
    }

    private void requireConfigured(AdProvider provider) {
        if (!props.isConfigured(provider)) {
            MDC.put(TraceIdFilter.MDC_CODE_KEY, "AD_PROVIDER_NOT_CONFIGURED");
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "AD_PROVIDER_NOT_CONFIGURED");
        }
    }

    private AdPlatformClient clientFor(AdProvider provider) {
        AdPlatformClient client = clients.stream()
                .filter(c -> c.provider() == provider)
                .findFirst()
                .orElse(null);
        if (client == null) {
            MDC.put(TraceIdFilter.MDC_CODE_KEY, "AD_PROVIDER_NOT_CONFIGURED");
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "AD_PROVIDER_NOT_CONFIGURED");
        }
        return client;
    }
}
