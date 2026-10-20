package com.ceview.module3.social.publish;

import com.ceview.common.crypto.TokenCipher;
import com.ceview.module3.media.*;
import com.ceview.module3.social.*;
import com.ceview.module3.social.publish.PublishingDtos.*;
import com.ceview.module3.social.publish.client.*;
import com.ceview.module3.submodule31.LocalizedPromotionalContentRepository;
import com.ceview.module4.adconnections.AdPlatformConnectionRepository;
import com.ceview.module4.attribution.link.AttributionLinkRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.SimpleTransactionStatus;
import org.springframework.web.server.ResponseStatusException;
import java.time.OffsetDateTime;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class PublishingServiceTest {
    final UUID profile=UUID.randomUUID(), mediaId=UUID.randomUUID();
    final SocialPostRepository posts=mock(SocialPostRepository.class);
    final MediaAssetRepository media=mock(MediaAssetRepository.class);
    final MediaStorage storage=mock(MediaStorage.class);
    final PublishingAccountRepository accounts=mock(PublishingAccountRepository.class);
    final SocialConnectionService connections=mock(SocialConnectionService.class);
    final LocalizedPromotionalContentRepository content=mock(LocalizedPromotionalContentRepository.class);
    final AttributionLinkRepository links=mock(AttributionLinkRepository.class);
    final AdPlatformConnectionRepository ads=mock(AdPlatformConnectionRepository.class);
    final PlatformDeliveryClient delivery=mock(PlatformDeliveryClient.class);
    final TikTokDeliveryClient tiktok=mock(TikTokDeliveryClient.class);
    final TokenCipher cipher=mock(TokenCipher.class);
    final PlatformTransactionManager tm=mock(PlatformTransactionManager.class);
    PublishingService service;
    MediaAsset asset;
    PublishingAccount account;
    @BeforeEach void setup() {
        when(tm.getTransaction(any())).thenReturn(new SimpleTransactionStatus());
        service=new PublishingService(posts,media,storage,accounts,connections,content,links,ads,delivery,tiktok,cipher,tm,new ObjectMapper().findAndRegisterModules());
        asset=new MediaAsset(); asset.setMediaId(mediaId); asset.setBusinessProfileId(profile); asset.setKind("image");
        asset.setContentType("image/jpeg"); asset.setStatus("READY"); asset.setStorageKey("owned.jpg"); asset.setSizeBytes(42);
        when(media.findByMediaIdAndBusinessProfileId(mediaId,profile)).thenReturn(Optional.of(asset));
        when(storage.sizeOf("owned.jpg")).thenReturn(OptionalLong.of(42));
        account=new PublishingAccount(); account.setAccountId(UUID.randomUUID()); account.setBusinessProfileId(profile);
        account.setPlatform("instagram"); account.setExternalId("ig-1"); account.setStatus("ACTIVE"); account.setAccessTokenEncrypted("ciphertext");
        when(accounts.findByBusinessProfileIdAndPlatform(profile,"instagram")).thenReturn(Optional.of(account));
        when(accounts.lockOwned(profile,"instagram")).thenReturn(Optional.of(account));
        when(connections.list(profile)).thenReturn(List.of(new SocialDtos.SocialConnectionView("instagram",true,"ACTIVE","ig",null)));
        when(cipher.decrypt("ciphertext")).thenReturn("secret");
        when(cipher.isConfigured()).thenReturn(true);
        when(posts.saveAndFlush(any())).thenAnswer(i -> i.getArgument(0));
    }
    PublishRequest request(UUID id,OffsetDateTime when) {
        return new PublishRequest(id,List.of("instagram"),Map.of("instagram","Approved caption"),mediaId,null,"Japan","public",when,true,null);
    }
    SocialPost post() {
        SocialPost p=new SocialPost(); p.setId(UUID.randomUUID()); p.setBusinessProfileId(profile); p.setMediaAssetId(mediaId);
        p.setPlatform("instagram"); p.setStatus("PUBLISHING"); p.setCaption("Approved caption"); p.setCreatedAt(OffsetDateTime.now());
        p.setPublishingAccountId(account.getAccountId()); p.setTargetExternalId(account.getExternalId()); p.setAttempts(1);
        return p;
    }
    @Test void rejectsForeignMediaBeforeWriting() {
        when(media.findByMediaIdAndBusinessProfileId(mediaId,profile)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.publish(profile,request(UUID.randomUUID(),null))).isInstanceOf(ResponseStatusException.class);
        verify(posts,never()).saveAllAndFlush(any()); verifyNoInteractions(delivery);
    }
    @Test void missingEncryptionConfigurationReturns503BeforeCreatingWork() {
        when(cipher.isConfigured()).thenReturn(false);
        assertThatThrownBy(() -> service.publish(profile,request(UUID.randomUUID(),null)))
                .isInstanceOfSatisfying(ResponseStatusException.class,e -> assertThat(e.getStatusCode().value()).isEqualTo(503));
        verify(posts,never()).saveAllAndFlush(any()); verifyNoInteractions(delivery);
    }
    @Test void rejectsChangedStoredSizeBeforeWriting() {
        when(storage.sizeOf("owned.jpg")).thenReturn(OptionalLong.of(43));
        assertThatThrownBy(() -> service.publish(profile,request(UUID.randomUUID(),null))).hasMessageContaining("Stored media changed");
        verify(posts,never()).saveAllAndFlush(any());
    }
    @Test void rejectsUnapprovedForeignContent() {
        var r=request(UUID.randomUUID(),null);
        var foreign=new PublishRequest(r.requestId(),r.platforms(),r.captionsByPlatform(),mediaId,UUID.randomUUID(),r.market(),r.visibility(),null,true,null);
        assertThatThrownBy(() -> service.publish(profile,foreign)).hasMessageContaining("approved");
        verify(posts,never()).saveAllAndFlush(any());
    }
    @Test void scheduledPostPersistsWithoutDeliveryAndReplayDoesNotDuplicate() {
        UUID requestId=UUID.randomUUID(); var r=request(requestId,OffsetDateTime.now().plusHours(2));
        List<SocialPost> saved=new ArrayList<>();
        when(posts.saveAllAndFlush(any())).thenAnswer(i -> { ((Iterable<SocialPost>)i.getArgument(0)).forEach(saved::add); return saved; });
        when(posts.findByBusinessProfileIdAndRequestId(profile,requestId)).thenAnswer(i -> List.copyOf(saved));
        assertThat(service.publish(profile,r)).hasSize(1);
        assertThat(saved.get(0).getStatus()).isEqualTo("PENDING");
        assertThat(service.publish(profile,r)).hasSize(1);
        verify(posts,times(1)).saveAllAndFlush(any()); verifyNoInteractions(delivery);
        var changed=new PublishRequest(requestId,r.platforms(),Map.of("instagram","Different"),mediaId,null,r.market(),r.visibility(),r.scheduledFor(),true,null);
        assertThatThrownBy(() -> service.publish(profile,changed)).hasMessageContaining("already used");
    }
    @Test void recordsConfirmedPublication() {
        SocialPost p=post(); when(delivery.deliver(eq(p),eq(asset),eq(account),eq("secret"),any()))
                .thenReturn(new PlatformDeliveryClient.DeliveryResult("PUBLISHED","remote","https://instagram.com/p/test",null));
        service.deliverClaimed(p);
        assertThat(p.getStatus()).isEqualTo("PUBLISHED"); assertThat(p.getPublishedAt()).isNotNull();
        assertThat(p.getExternalId()).isEqualTo("remote");
    }
    @Test void rateLimitRetriesAtMostThreeAttempts() {
        SocialPost p=post(); when(delivery.deliver(eq(p),any(),any(),any(),any())).thenThrow(new DeliveryException("Rate limited",false,true));
        service.deliverClaimed(p); assertThat(p.getStatus()).isEqualTo("PENDING"); assertThat(p.getNextAttemptAt()).isAfter(OffsetDateTime.now());
        p.setAttempts(3); service.deliverClaimed(p); assertThat(p.getStatus()).isEqualTo("FAILED");
    }
    @Test void ambiguousFailureNeverRetriesAndNeverLeaksToken() {
        SocialPost p=post(); when(delivery.deliver(eq(p),any(),any(),any(),any())).thenThrow(new IllegalStateException("secret URL access_token=secret"));
        service.deliverClaimed(p); assertThat(p.getStatus()).isEqualTo("FAILED"); assertThat(p.getErrorMessage()).doesNotContain("secret");
    }
    @Test void authFailureMarksAccountReconnect() {
        SocialPost p=post(); when(delivery.deliver(eq(p),any(),any(),any(),any())).thenThrow(new DeliveryException("Reconnect",true,false));
        service.deliverClaimed(p); assertThat(account.getStatus()).isEqualTo("NEEDS_RECONNECT"); assertThat(p.getStatus()).isEqualTo("FAILED");
    }
    @Test void pendingContainerPollDoesNotConsumeFailureBudget() {
        SocialPost p=post(); when(delivery.deliver(eq(p),any(),any(),any(),any())).thenThrow(new ProcessingPendingException());
        service.deliverClaimed(p); assertThat(p.getAttempts()).isZero(); assertThat(p.getStatus()).isEqualTo("PENDING");
    }
    @Test void longScheduledPostGetsFullProcessingWindowAfterDispatch() {
        SocialPost p=post(); p.setCreatedAt(OffsetDateTime.now().minusDays(7)); p.setProcessingStartedAt(OffsetDateTime.now());
        when(delivery.deliver(eq(p),any(),any(),any(),any())).thenThrow(new ProcessingPendingException());
        service.deliverClaimed(p); assertThat(p.getStatus()).isEqualTo("PENDING");
    }
    @Test void doesNotPretendToCancelAnAcceptedTikTokUpload() {
        SocialPost p=post(); p.setPlatform("tiktok"); p.setExternalId("accepted-upload"); p.setStatus("PENDING");
        when(posts.lockOwned(p.getId(),profile)).thenReturn(Optional.of(p));
        assertThatThrownBy(() -> service.cancel(profile,p.getId())).hasMessageContaining("TikTok already accepted");
        verifyNoInteractions(delivery);
    }
    @Test void accountSwitchDoesNotSendScheduledPostToNewPage() {
        SocialPost p=post(); account.setExternalId("other-page"); service.deliverClaimed(p);
        assertThat(p.getStatus()).isEqualTo("FAILED"); verifyNoInteractions(delivery);
    }
    @Test void foreignTenantCannotReadOrCancel() {
        UUID id=UUID.randomUUID(); when(posts.lockOwned(id,profile)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.get(profile,id)).hasMessageContaining("404");
        assertThatThrownBy(() -> service.cancel(profile,id)).hasMessageContaining("404"); verifyNoInteractions(delivery);
    }
    @Test void secondWorkerCannotDispatchClaimedPost() {
        SocialPost p=post(); when(posts.lockOwned(p.getId(),profile)).thenReturn(Optional.of(p));
        service.dispatch(profile,p.getId()); verifyNoInteractions(delivery);
    }
    @Test void cancelsPendingWithoutCallingPlatform() {
        SocialPost p=post(); p.setStatus("PENDING"); when(posts.lockOwned(p.getId(),profile)).thenReturn(Optional.of(p));
        service.cancel(profile,p.getId()); assertThat(p.getStatus()).isEqualTo("CANCELLED"); verifyNoInteractions(delivery);
    }
    @Test void rejectsUnsupportedImageFormatAndPrivateVisibility() {
        asset.setContentType("image/png"); assertThatThrownBy(() -> PublishingService.validateFormat("instagram",asset)).hasMessageContaining("JPEG");
        var r=request(UUID.randomUUID(),null);
        assertThatThrownBy(() -> PublishingService.validate(new PublishRequest(r.requestId(),r.platforms(),r.captionsByPlatform(),mediaId,null,null,"private",null,true,null)))
                .hasMessageContaining("Private publishing");
    }
    void tiktokAccount() {
        account.setPlatform("tiktok"); account.setTokenExpiresAt(OffsetDateTime.now().minusMinutes(1));
        account.setRefreshTokenEncrypted("refresh-encrypted"); account.setRefreshExpiresAt(OffsetDateTime.now().plusDays(30));
        when(accounts.findByBusinessProfileIdAndPlatform(profile,"tiktok")).thenReturn(Optional.of(account));
        when(accounts.lockOwned(profile,"tiktok")).thenReturn(Optional.of(account));
        when(accounts.saveAndFlush(any())).thenAnswer(i -> i.getArgument(0));
        when(connections.list(profile)).thenReturn(List.of(new SocialDtos.SocialConnectionView("tiktok",true,"ACTIVE","mine",null)));
        when(cipher.decrypt("refresh-encrypted")).thenReturn("refresh-token");
    }
    @Test void refreshLeasePreventsConcurrentRotatingTokenExchange() {
        tiktokAccount(); account.setRefreshClaimedAt(OffsetDateTime.now()); SocialPost p=post(); p.setPlatform("tiktok");
        assertThatThrownBy(() -> service.accessTokenForMetrics(p)).isInstanceOfSatisfying(DeliveryException.class,e -> assertThat(e.isRetryable()).isTrue());
        verifyNoInteractions(tiktok);
    }
    @Test void refreshStoresRotatedGrantAndReleasesLease() {
        tiktokAccount(); SocialPost p=post(); p.setPlatform("tiktok");
        when(tiktok.refreshToken("refresh-token")).thenReturn(new com.ceview.module3.social.client.TikTokContentClient.CreatorGrant(
                "new-token","new-refresh",OffsetDateTime.now().plusDays(1),OffsetDateTime.now().plusDays(30),account.getExternalId(),"video.upload"));
        when(cipher.encrypt("new-token")).thenReturn("new-encrypted"); when(cipher.encrypt("new-refresh")).thenReturn("new-refresh-encrypted");
        assertThat(service.accessTokenForMetrics(p)).isEqualTo("new-token");
        assertThat(account.getAccessTokenEncrypted()).isEqualTo("new-encrypted"); assertThat(account.getRefreshClaimedAt()).isNull();
    }
    @Test void refreshCannotResurrectDisconnectedAccount() {
        tiktokAccount(); SocialPost p=post(); p.setPlatform("tiktok");
        when(tiktok.refreshToken("refresh-token")).thenAnswer(i -> {
            account.setStatus("REVOKED"); account.setAccessTokenEncrypted("");
            return new com.ceview.module3.social.client.TikTokContentClient.CreatorGrant("new",null,OffsetDateTime.now().plusDays(1),null,account.getExternalId(),"video.upload");
        });
        assertThatThrownBy(() -> service.accessTokenForMetrics(p)).hasMessageContaining("connection changed");
        assertThat(account.getStatus()).isEqualTo("REVOKED"); assertThat(account.getAccessTokenEncrypted()).isEmpty();
    }
}
