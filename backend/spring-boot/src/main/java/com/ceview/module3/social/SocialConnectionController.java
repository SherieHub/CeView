package com.ceview.module3.social;

import com.ceview.auth.CurrentBusinessProfile;
import com.ceview.module3.social.SocialDtos.PageOption;
import com.ceview.module3.social.SocialDtos.SelectPageRequest;
import com.ceview.module3.social.SocialDtos.SocialConnectionView;
import com.ceview.module3.social.SocialDtos.TikTokCompleteRequest;
import com.ceview.module3.social.client.TikTokContentClient;
import com.ceview.module4.adconnections.AdConnectionDtos.AuthorizeUrlResponse;
import com.ceview.module4.adconnections.AdConnectionService;
import com.ceview.module4.adconnections.AdProviderProperties;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Facebook / Instagram / TikTok publishing connections.
 *
 * <p>Meta's login itself is {@code POST /api/ad-connections/meta/authorize} (one login for ads
 * and publishing); this controller adds choosing the Page, TikTok's own login, and the combined
 * status list. Every endpoint except the TikTok callback is JWT-authenticated and scoped to the
 * caller's profile; the callback only redirects to the SPA, which finishes the login through
 * the authenticated {@code /tiktok/complete}.
 */
@RestController
@RequestMapping("/api/social-connections")
public class SocialConnectionController {

    private static final Logger log = LoggerFactory.getLogger(SocialConnectionController.class);

    /** OAuth error codes TikTok is known to send — safe to echo verbatim. */
    private static final Set<String> KNOWN_OAUTH_ERRORS = Set.of(
            "access_denied", "server_error", "temporarily_unavailable", "invalid_scope");

    private final CurrentBusinessProfile currentBusinessProfile;
    private final SocialConnectionService service;
    private final AdConnectionService stateService;
    private final TikTokContentClient tiktok;
    private final AdProviderProperties adProps;

    public SocialConnectionController(CurrentBusinessProfile currentBusinessProfile,
                                      SocialConnectionService service,
                                      AdConnectionService stateService,
                                      TikTokContentClient tiktok,
                                      AdProviderProperties adProps) {
        this.currentBusinessProfile = currentBusinessProfile;
        this.service = service;
        this.stateService = stateService;
        this.tiktok = tiktok;
        this.adProps = adProps;
    }

    @GetMapping
    public List<SocialConnectionView> list() {
        return service.list(currentBusinessProfile.resolveProfileId());
    }

    @GetMapping("/meta/pages")
    public List<PageOption> metaPages() {
        return service.listPages(currentBusinessProfile.resolveProfileId());
    }

    /** Chooses the Facebook Page (and its linked Instagram account); returns the fresh list. */
    @PutMapping("/meta/page")
    public List<SocialConnectionView> selectMetaPage(@Valid @RequestBody SelectPageRequest body) {
        UUID profileId = currentBusinessProfile.resolveProfileId();
        service.selectPage(profileId, body.pageId());
        return service.list(profileId);
    }

    @PostMapping("/tiktok/authorize")
    public AuthorizeUrlResponse tiktokAuthorize() {
        if (!tiktok.isConfigured() || !stateService.isEncryptionConfigured()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "SOCIAL_PROVIDER_NOT_CONFIGURED");
        }
        UUID state = stateService.mintState(currentBusinessProfile.resolveProfileId(), SocialConnectionService.TIKTOK_STATE_KEY);
        return new AuthorizeUrlResponse(tiktok.buildAuthorizeUrl(state.toString()));
    }

    /**
     * TikTok's redirect target. Always answers with a 302 back to the frontend - never JSON -
     * because the caller is a browser mid-redirect. It deliberately does nothing else: no
     * database write and no outbound call. The state identifies the profile that STARTED the
     * flow, not the browser that approved it, so finishing the grant here would let an attacker
     * bind their login to a victim. The SPA hands the code and state to the authenticated
     * {@code POST /tiktok/complete}. {@code error} is attacker-suppliable free text on a public
     * endpoint, so it is mapped to a bounded code (and only that code is logged).
     */
    @GetMapping("/tiktok/callback")
    public ResponseEntity<Void> tiktokCallback(@RequestParam(required = false) String code,
                                               @RequestParam(required = false) String state,
                                               @RequestParam(required = false) String error) {
        if (error != null && !error.isBlank()) {
            String mapped = KNOWN_OAUTH_ERRORS.contains(error.toLowerCase())
                    ? error.toLowerCase() : "consent_declined";
            log.info("[Module3] TikTok callback returned an OAuth error: {}", mapped);
            return redirect(Map.of("social_error", mapped));
        }
        if (code == null || code.isBlank() || state == null || state.isBlank()) {
            return redirect(Map.of("social_error", "missing_code_or_state"));
        }
        Map<String, String> params = new LinkedHashMap<>();
        params.put("tiktok_code", code);
        params.put("state", state);
        return redirect(params);
    }

    /** Finishes the TikTok login for the authenticated caller; returns the fresh list. */
    @PostMapping("/tiktok/complete")
    public List<SocialConnectionView> tiktokComplete(@Valid @RequestBody TikTokCompleteRequest body) {
        UUID profileId = currentBusinessProfile.resolveProfileId();
        service.completeTikTok(profileId, body.code(), body.state());
        return service.list(profileId);
    }

    @DeleteMapping("/{platform}")
    public ResponseEntity<Void> disconnect(@PathVariable String platform) {
        service.disconnect(currentBusinessProfile.resolveProfileId(), platform);
        return ResponseEntity.noContent().build();
    }

    /** Every value is percent-encoded as a URI variable: some of them come from the query string. */
    private ResponseEntity<Void> redirect(Map<String, String> params) {
        UriComponentsBuilder builder = UriComponentsBuilder.fromUriString(adProps.getFrontendBaseUrl())
                .path("/settings/platforms");
        params.keySet().forEach(name -> builder.queryParam(name, "{" + name + "}"));
        String url = builder.encode().buildAndExpand(params).toUriString();
        return ResponseEntity.status(HttpStatus.FOUND).location(URI.create(url)).build();
    }
}
