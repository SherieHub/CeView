package com.ceview.module3.social;

import com.ceview.common.crypto.TokenCipher;
import com.ceview.module3.social.SocialDtos.PageOption;
import com.ceview.module3.social.SocialDtos.SocialConnectionView;
import com.ceview.module3.social.client.MetaGraphClient;
import com.ceview.module3.social.client.MetaGraphClient.PageInfo;
import com.ceview.module3.social.client.TikTokContentClient.CreatorGrant;
import com.ceview.module3.social.client.TikTokContentClient;
import com.ceview.module4.adconnections.AdConnectionService;
import com.ceview.module4.adconnections.AdPlatformConnection;
import com.ceview.module4.adconnections.AdPlatformConnectionRepository;
import com.ceview.module4.adconnections.AdProvider;
import com.ceview.module4.adconnections.client.TokenGrant;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.boot.test.mock.mockito.SpyBean;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.server.ResponseStatusException;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.when;

@SpringBootTest
class SocialConnectionServiceTest {

    private static final String ALL_PUBLISH_SCOPES =
            "ads_read,pages_show_list,pages_read_engagement,pages_manage_posts,instagram_basic,instagram_content_publish";

    @Autowired private SocialConnectionService service;
    @SpyBean private PublishingAccountRepository accountRepo;
    @Autowired private AdConnectionService adConnectionService;
    @Autowired private AdPlatformConnectionRepository metaRepo;
    @Autowired private TokenCipher cipher;
    @MockBean private MetaGraphClient graph;
    @MockBean private TikTokContentClient tiktok;

    private UUID profile;

    @BeforeEach
    void setUp() {
        accountRepo.deleteAll();
        metaRepo.deleteAll();
        profile = UUID.randomUUID();
    }

    private void metaLogin(UUID profileId, String scopes, OffsetDateTime expiresAt) {
        AdPlatformConnection c = new AdPlatformConnection();
        c.setBusinessProfileId(profileId);
        c.setProvider("meta");
        c.setAccessTokenEncrypted(cipher.encrypt("USER-TOKEN"));
        c.setScopes(scopes);
        c.setTokenExpiresAt(expiresAt);
        c.setStatus(AdPlatformConnection.STATUS_PENDING_ACCOUNT_SELECTION);
        metaRepo.save(c);
    }

    private SocialConnectionView row(List<SocialConnectionView> views, String platform) {
        return views.stream().filter(v -> v.platform().equals(platform)).findFirst().orElseThrow();
    }

    private static PageInfo page(String id, String name, String igId, String igUser) {
        return new PageInfo(id, name, "PAGE-TOKEN-" + id, igId, igUser);
    }

    @Test
    void aFreshProfileSeesAllThreePlatformsDisconnected() {
        List<SocialConnectionView> views = service.list(profile);

        assertThat(views).extracting(SocialConnectionView::platform)
                .containsExactly("facebook", "instagram", "tiktok");
        assertThat(views).allSatisfy(v -> assertThat(v.status()).isEqualTo("DISCONNECTED"));
    }
    @Test
    void aMetaGrantChangedDuringPageDiscoveryCannotRestoreTheOldPageToken() {
        metaLogin(profile, ALL_PUBLISH_SCOPES, null);
        when(graph.listPages("USER-TOKEN")).thenAnswer(invocation -> {
            adConnectionService.storeGrant(profile, AdProvider.META,
                    new TokenGrant("DIFFERENT-USER", null, OffsetDateTime.now().plusDays(60), ALL_PUBLISH_SCOPES));
            return List.of(page("old-page", "Old Page", null, null));
        });
        assertThatThrownBy(() -> service.selectPage(profile,"old-page"))
                .isInstanceOfSatisfying(ResponseStatusException.class,e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.CONFLICT));
        assertThat(accountRepo.findByBusinessProfileIdAndPlatform(profile,"facebook")).isEmpty();
    }
    @Test
    void aRejectedPublishingCredentialPromptsReconnectRatherThanPageSelection() {
        connectPageAndInstagram();
        PublishingAccount page=accountRepo.findByBusinessProfileIdAndPlatform(profile,"facebook").orElseThrow();
        page.setStatus(PublishingAccount.STATUS_NEEDS_RECONNECT); accountRepo.save(page);
        assertThat(row(service.list(profile),"facebook").status()).isEqualTo("NEEDS_RECONNECT");
        assertThat(row(service.list(profile),"instagram").status()).isEqualTo("NEEDS_RECONNECT");
    }

    @Test
    void anAdsOnlyMetaLoginNeedsAReconnectToPublish() {
        metaLogin(profile, "ads_read", null);

        List<SocialConnectionView> views = service.list(profile);

        assertThat(row(views, "facebook").status()).isEqualTo("NEEDS_RECONNECT");
        assertThat(row(views, "instagram").status()).isEqualTo("NEEDS_RECONNECT");
    }

    @Test
    void anExpiredMetaTokenNeedsAReconnect() {
        metaLogin(profile, ALL_PUBLISH_SCOPES, OffsetDateTime.now().minusDays(1));

        assertThat(row(service.list(profile), "facebook").status()).isEqualTo("NEEDS_RECONNECT");
    }

    @Test
    void aPublishCapableMetaLoginWithoutAPageNeedsAPage() {
        metaLogin(profile, ALL_PUBLISH_SCOPES, OffsetDateTime.now().plusDays(50));

        List<SocialConnectionView> views = service.list(profile);

        assertThat(row(views, "facebook").status()).isEqualTo("NEEDS_PAGE");
        assertThat(row(views, "instagram").status()).isEqualTo("NEEDS_PAGE");
    }

    @Test
    void listPagesReturnsOptionsWithoutTokens() {
        metaLogin(profile, ALL_PUBLISH_SCOPES, null);
        when(graph.listPages("USER-TOKEN")).thenReturn(List.of(
                page("111", "Cebu Dive Co.", "179", "cebu.dive"), page("222", "Mactan Cafe", null, null)));

        List<PageOption> pages = service.listPages(profile);

        assertThat(pages).containsExactly(
                new PageOption("111", "Cebu Dive Co.", "cebu.dive"), new PageOption("222", "Mactan Cafe", null));
    }

    @Test
    void listPagesWithoutAMetaLoginIsAConflict() {
        assertThatThrownBy(() -> service.listPages(profile))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.CONFLICT));
    }

    @Test
    void selectingAPageWithInstagramActivatesBothAndEncryptsTheToken() {
        metaLogin(profile, ALL_PUBLISH_SCOPES, null);
        when(graph.listPages("USER-TOKEN")).thenReturn(List.of(page("111", "Cebu Dive Co.", "179", "cebu.dive")));

        service.selectPage(profile, "111");

        List<SocialConnectionView> views = service.list(profile);
        assertThat(row(views, "facebook").status()).isEqualTo("ACTIVE");
        assertThat(row(views, "facebook").handle()).isEqualTo("Cebu Dive Co.");
        assertThat(row(views, "instagram").status()).isEqualTo("ACTIVE");
        assertThat(row(views, "instagram").handle()).isEqualTo("@cebu.dive");

        PublishingAccount fb = accountRepo.findByBusinessProfileIdAndPlatform(profile, "facebook").orElseThrow();
        assertThat(fb.getExternalId()).isEqualTo("111");
        assertThat(fb.getAccessTokenEncrypted()).isNotEqualTo("PAGE-TOKEN-111");
        assertThat(cipher.decrypt(fb.getAccessTokenEncrypted())).isEqualTo("PAGE-TOKEN-111");
        PublishingAccount ig = accountRepo.findByBusinessProfileIdAndPlatform(profile, "instagram").orElseThrow();
        assertThat(ig.getExternalId()).isEqualTo("179");
        assertThat(cipher.decrypt(ig.getAccessTokenEncrypted())).isEqualTo("PAGE-TOKEN-111");
    }

    @Test
    void aPageWithoutALinkedInstagramLeavesInstagramNeedingALink() {
        metaLogin(profile, ALL_PUBLISH_SCOPES, null);
        when(graph.listPages("USER-TOKEN")).thenReturn(List.of(page("222", "Mactan Cafe", null, null)));

        service.selectPage(profile, "222");

        List<SocialConnectionView> views = service.list(profile);
        assertThat(row(views, "facebook").status()).isEqualTo("ACTIVE");
        assertThat(row(views, "instagram").status()).isEqualTo("NO_LINKED_INSTAGRAM");
    }

    @Test
    void switchingToAPageWithoutInstagramRevokesTheOldInstagramRow() {
        metaLogin(profile, ALL_PUBLISH_SCOPES, null);
        when(graph.listPages("USER-TOKEN")).thenReturn(List.of(
                page("111", "Cebu Dive Co.", "179", "cebu.dive"), page("222", "Mactan Cafe", null, null)));
        service.selectPage(profile, "111");

        service.selectPage(profile, "222");

        assertThat(row(service.list(profile), "instagram").status()).isEqualTo("NO_LINKED_INSTAGRAM");
        assertThat(accountRepo.findByBusinessProfileIdAndPlatform(profile, "instagram").orElseThrow().getAccessTokenEncrypted())
                .isEmpty();
    }

    @Test
    void selectingAPageTheLoginCannotSeeIsRejected() {
        metaLogin(profile, ALL_PUBLISH_SCOPES, null);
        when(graph.listPages(anyString())).thenReturn(List.of(page("111", "Cebu Dive Co.", null, null)));

        assertThatThrownBy(() -> service.selectPage(profile, "999"))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST));
        assertThat(accountRepo.findAll()).isEmpty();
    }

    @Test
    void aPageMetaWithheldATokenForIsRejected() {
        metaLogin(profile, ALL_PUBLISH_SCOPES, null);
        when(graph.listPages(anyString())).thenReturn(List.of(new PageInfo("111", "Cebu Dive Co.", null, null, null)));

        assertThatThrownBy(() -> service.selectPage(profile, "111"))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.CONFLICT));
    }

    @Test
    void disconnectingFacebookRevokesBothRowsAndKeepsTheAdsConnection() {
        metaLogin(profile, ALL_PUBLISH_SCOPES, null);
        when(graph.listPages("USER-TOKEN")).thenReturn(List.of(page("111", "Cebu Dive Co.", "179", "cebu.dive")));
        service.selectPage(profile, "111");

        service.disconnect(profile, "facebook");

        List<SocialConnectionView> views = service.list(profile);
        assertThat(row(views, "facebook").status()).isEqualTo("NEEDS_PAGE");
        assertThat(row(views, "instagram").status()).isEqualTo("NEEDS_PAGE");
        assertThat(accountRepo.findByBusinessProfileId(profile))
                .allSatisfy(a -> {
                    assertThat(a.getStatus()).isEqualTo("REVOKED");
                    assertThat(a.getAccessTokenEncrypted()).isEmpty();
                });
        assertThat(metaRepo.findByBusinessProfileIdAndProvider(profile, "meta")).isPresent();
    }

    @Test
    void aTikTokGrantActivatesTheConnectionAndDisconnectClearsIt() {
        CreatorGrant grant = new CreatorGrant("ACCESS-1", "REFRESH-1",
                OffsetDateTime.now().plusDays(1), OffsetDateTime.now().plusDays(365), "OPEN-1", "user.info.basic,video.upload");

        service.storeTikTokGrant(profile, grant, "Cebu Dive");

        SocialConnectionView tiktok = row(service.list(profile), "tiktok");
        assertThat(tiktok.status()).isEqualTo("ACTIVE");
        assertThat(tiktok.handle()).isEqualTo("Cebu Dive");
        PublishingAccount account = accountRepo.findByBusinessProfileIdAndPlatform(profile, "tiktok").orElseThrow();
        assertThat(cipher.decrypt(account.getAccessTokenEncrypted())).isEqualTo("ACCESS-1");
        assertThat(cipher.decrypt(account.getRefreshTokenEncrypted())).isEqualTo("REFRESH-1");

        service.disconnect(profile, "tiktok");

        assertThat(row(service.list(profile), "tiktok").status()).isEqualTo("DISCONNECTED");
    }

    @Test
    void reconnectingTikTokReplacesTheExistingRow() {
        CreatorGrant first = new CreatorGrant("A1", "R1", null, null, "OPEN-1", "s");
        CreatorGrant second = new CreatorGrant("A2", "R2", null, null, "OPEN-2", "s");

        service.storeTikTokGrant(profile, first, "First");
        service.storeTikTokGrant(profile, second, null);

        PublishingAccount account = accountRepo.findByBusinessProfileIdAndPlatform(profile, "tiktok").orElseThrow();
        assertThat(account.getExternalId()).isEqualTo("OPEN-2");
        assertThat(account.getDisplayName()).isEqualTo("TikTok account");
        assertThat(accountRepo.findByBusinessProfileId(profile)).hasSize(1);
    }

    @Test
    void anUnknownPlatformIsABadRequest() {
        assertThatThrownBy(() -> service.disconnect(profile, "myspace"))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    void anotherTenantSeesNothingOfMine() {
        metaLogin(profile, ALL_PUBLISH_SCOPES, null);
        when(graph.listPages("USER-TOKEN")).thenReturn(List.of(page("111", "Cebu Dive Co.", "179", "cebu.dive")));
        service.selectPage(profile, "111");

        List<SocialConnectionView> theirs = service.list(UUID.randomUUID());

        assertThat(theirs).allSatisfy(v -> assertThat(v.status()).isEqualTo("DISCONNECTED"));
    }

    // ── review amendments ────────────────────────────────────────────────────

    private void connectPageAndInstagram() {
        metaLogin(profile, ALL_PUBLISH_SCOPES, null);
        when(graph.listPages("USER-TOKEN")).thenReturn(List.of(page("111", "Cebu Dive Co.", "179", "cebu.dive")));
        service.selectPage(profile, "111");
    }

    @Test
    void spaceSeparatedGrantedScopesStillCountAsPublishCapable() {
        metaLogin(profile, ALL_PUBLISH_SCOPES.replace(',', ' '), null);

        assertThat(row(service.list(profile), "facebook").status()).isEqualTo("NEEDS_PAGE");
    }

    @Test
    void blankOrMissingGrantedScopesNeedAReconnect() {
        metaLogin(profile, "", null);
        assertThat(row(service.list(profile), "facebook").status()).isEqualTo("NEEDS_RECONNECT");

        metaRepo.deleteAll();
        metaLogin(profile, null, null);
        assertThat(row(service.list(profile), "facebook").status()).isEqualTo("NEEDS_RECONNECT");
    }

    @Test
    void anInstagramAccountWithoutAUsernameIsNeverShownAsAtNull() {
        metaLogin(profile, ALL_PUBLISH_SCOPES, null);
        when(graph.listPages("USER-TOKEN")).thenReturn(List.of(page("111", "Cebu Dive Co.", "179", null)));

        service.selectPage(profile, "111");

        assertThat(row(service.list(profile), "instagram").handle()).isEqualTo("Instagram account");
    }

    @Test
    void metaSessionExpiryWhileListingPagesIsA409() {
        metaLogin(profile, ALL_PUBLISH_SCOPES, null);
        when(graph.listPages(anyString())).thenThrow(new SocialPlatformException("Invalid OAuth access token.", true));

        assertThatThrownBy(() -> service.listPages(profile))
                .isInstanceOfSatisfying(ResponseStatusException.class, e -> {
                    assertThat(e.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
                    assertThat(e.getReason()).contains("reconnect");
                });
    }

    @Test
    void metaSessionExpiryWhileSelectingAPageIsA409AndOtherGraphFailuresStay502() {
        metaLogin(profile, ALL_PUBLISH_SCOPES, null);
        when(graph.listPages(anyString())).thenThrow(new SocialPlatformException("Invalid OAuth access token.", true));
        assertThatThrownBy(() -> service.selectPage(profile, "111"))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.CONFLICT));

        doThrow(new SocialPlatformException("Meta API call failed")).when(graph).listPages(anyString());
        assertThatThrownBy(() -> service.selectPage(profile, "111"))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.BAD_GATEWAY));
        assertThatThrownBy(() -> service.listPages(profile))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.BAD_GATEWAY));
    }

    @Test
    void noDatabaseTransactionIsOpenAcrossTheGraphCalls() {
        metaLogin(profile, ALL_PUBLISH_SCOPES, null);
        List<Boolean> transactionOpenDuringGraphCall = new java.util.ArrayList<>();
        when(graph.listPages("USER-TOKEN")).thenAnswer(invocation -> {
            transactionOpenDuringGraphCall.add(TransactionSynchronizationManager.isActualTransactionActive());
            return List.of(page("111", "Cebu Dive Co.", "179", "cebu.dive"));
        });

        service.listPages(profile);
        service.selectPage(profile, "111");

        assertThat(transactionOpenDuringGraphCall).containsExactly(false, false);
        assertThat(row(service.list(profile), "facebook").status()).isEqualTo("ACTIVE");
    }

    @Test
    void aTikTokGrantThatLacksTheUploadScopeNeedsAReconnect() {
        service.storeTikTokGrant(profile, new CreatorGrant("A", "R", null, null, "OPEN-1", "user.info.basic"), "X");

        assertThat(row(service.list(profile), "tiktok").status()).isEqualTo("NEEDS_RECONNECT");
    }

    @Test
    void aTikTokGrantWithUnknownScopesOrTheUploadScopeIsActive() {
        service.storeTikTokGrant(profile, new CreatorGrant("A", "R", null, null, "OPEN-1", null), "X");
        assertThat(row(service.list(profile), "tiktok").status()).isEqualTo("ACTIVE");

        service.storeTikTokGrant(profile, new CreatorGrant("A", "R", null, null, "OPEN-1", "user.info.basic,video.upload"), "X");
        assertThat(row(service.list(profile), "tiktok").status()).isEqualTo("ACTIVE");
    }

    @Test
    void aTikTokGrantWhoseRefreshTokenHasExpiredNeedsAReconnect() {
        service.storeTikTokGrant(profile, new CreatorGrant("A", "R",
                OffsetDateTime.now().minusDays(400), OffsetDateTime.now().minusDays(1), "OPEN-1", "video.upload"), "X");

        assertThat(row(service.list(profile), "tiktok").status()).isEqualTo("NEEDS_RECONNECT");
    }

    @Test
    void reconnectingMetaRevokesThePageRowsSoThePageMustBeChosenAgain() {
        connectPageAndInstagram();
        service.storeTikTokGrant(profile, new CreatorGrant("A", "R", null, null, "OPEN-1", "video.upload"), "Tok");

        adConnectionService.storeGrant(profile, AdProvider.META,
                new TokenGrant("NEW-USER-TOKEN", null, OffsetDateTime.now().plusDays(60), ALL_PUBLISH_SCOPES));

        List<SocialConnectionView> views = service.list(profile);
        assertThat(row(views, "facebook").status()).isEqualTo("NEEDS_PAGE");
        assertThat(row(views, "instagram").status()).isEqualTo("NEEDS_PAGE");
        assertThat(row(views, "tiktok").status()).isEqualTo("ACTIVE");
        assertThat(accountRepo.findByBusinessProfileIdAndPlatform(profile, "facebook").orElseThrow())
                .satisfies(a -> {
                    assertThat(a.getStatus()).isEqualTo("REVOKED");
                    assertThat(a.getAccessTokenEncrypted()).isEmpty();
                });
        assertThat(accountRepo.findByBusinessProfileIdAndPlatform(profile, "tiktok").orElseThrow().getStatus())
                .isEqualTo("ACTIVE");
    }

    @Test
    void disconnectingMetaRevokesThePageRowsAndLeavesTikTokAlone() {
        connectPageAndInstagram();
        service.storeTikTokGrant(profile, new CreatorGrant("A", "R", null, null, "OPEN-1", "video.upload"), "Tok");

        adConnectionService.disconnect(profile, AdProvider.META);

        List<SocialConnectionView> views = service.list(profile);
        assertThat(row(views, "facebook").status()).isEqualTo("DISCONNECTED");
        assertThat(row(views, "instagram").status()).isEqualTo("DISCONNECTED");
        assertThat(row(views, "tiktok").status()).isEqualTo("ACTIVE");
        assertThat(accountRepo.findByBusinessProfileIdAndPlatform(profile, "instagram").orElseThrow().getStatus())
                .isEqualTo("REVOKED");
    }

    @Test
    void reconnectingMetaForOneProfileDoesNotTouchAnotherProfilesPages() {
        connectPageAndInstagram();

        adConnectionService.storeGrant(UUID.randomUUID(), AdProvider.META,
                new TokenGrant("OTHER", null, null, ALL_PUBLISH_SCOPES));

        assertThat(row(service.list(profile), "facebook").status()).isEqualTo("ACTIVE");
    }

    @Test
    void connectingTikTokAdsDoesNotRevokeMetaPages() {
        connectPageAndInstagram();

        adConnectionService.storeGrant(profile, AdProvider.TIKTOK, new TokenGrant("T", "R", null, "ads"));
        adConnectionService.disconnect(profile, AdProvider.TIKTOK);

        assertThat(row(service.list(profile), "facebook").status()).isEqualTo("ACTIVE");
    }

    // ── completing the TikTok login ──────────────────────────────────────────

    @Test
    void completingTikTokWithAMalformedStateIsA400() {
        assertThatThrownBy(() -> service.completeTikTok(profile, "CODE", "not-a-uuid"))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    void aConcurrentFinishThatLosesTheUniqueRaceIsA409() {
        UUID state = adConnectionService.mintState(profile, "tiktok_creator");
        when(tiktok.exchangeCode("CODE")).thenReturn(new CreatorGrant("A", "R", null, null, "OPEN-1", "video.upload"));
        doThrow(new DataIntegrityViolationException("uq_publishing_account")).when(accountRepo).save(any());

        assertThatThrownBy(() -> service.completeTikTok(profile, "CODE", state.toString()))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.CONFLICT));
    }
}
