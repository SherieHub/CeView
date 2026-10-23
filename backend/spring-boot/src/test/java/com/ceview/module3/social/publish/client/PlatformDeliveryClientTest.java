package com.ceview.module3.social.publish.client;

import com.ceview.module3.media.MediaAsset;
import com.ceview.module3.media.MediaAssetRepository;
import com.ceview.module3.media.MediaService;
import com.ceview.module3.media.MediaStorage;
import com.ceview.module3.social.PublishingAccount;
import com.ceview.module3.social.publish.SocialPost;
import com.ceview.common.crypto.TokenCipher;
import com.ceview.module4.adconnections.*;
import com.ceview.module4.attribution.link.AdUrlBuilder;
import okhttp3.mockwebserver.*;
import org.junit.jupiter.api.*;
import java.time.OffsetDateTime;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class PlatformDeliveryClientTest {
    MockWebServer server;
    SocialPost post;
    MediaAsset media;
    PublishingAccount account;
    MetaOrganicDeliveryClient organic;
    MediaService mediaService;
    @BeforeEach void setup() throws Exception {
        server = new MockWebServer(); server.start();
        mediaService = mediaServiceFor("https://cdn.test");
        organic = new MetaOrganicDeliveryClient(server.url("").toString(), mediaService);
        UUID tenant = UUID.randomUUID();
        post = new SocialPost(); post.setId(UUID.randomUUID()); post.setBusinessProfileId(tenant); post.setPlatform("facebook"); post.setCaption("Visit Cebu!");
        // The stored public_url is stale (an earlier base URL); delivery must use the current one.
        media = new MediaAsset(); media.setBusinessProfileId(tenant); media.setKind("image"); media.setContentType("image/jpeg");
        media.setStorageKey("media/tenant/image.jpg"); media.setPublicUrl("https://stale.example/media/tenant/image.jpg");
        account = new PublishingAccount(); account.setBusinessProfileId(tenant); account.setExternalId("123");
    }
    @AfterEach void close() throws Exception { server.shutdown(); }
    static MediaService mediaServiceFor(String base) { return new MediaService(mock(MediaAssetRepository.class), mock(MediaStorage.class), base); }
    @Test void facebookPhotoUsesTheCurrentPublicBaseUrlNotTheStoredOne() throws Exception {
        json("{\"id\":\"photo\",\"post_id\":\"123_456\"}"); json("{\"permalink_url\":\"https://facebook.com/1\"}");
        organic.deliver(post, media, account, "secret", p -> {});
        assertThat(body()).contains("url=https://cdn.test/media/tenant/image.jpg").doesNotContain("stale.example");
    }
    @Test void instagramImageUsesTheCurrentPublicBaseUrlNotTheStoredOne() throws Exception {
        post.setPlatform("instagram");
        json("{\"id\":\"container\"}"); json("{\"status_code\":\"FINISHED\"}"); json("{\"id\":\"published\"}"); json("{\"permalink\":\"https://instagram.com/p/1\"}");
        organic.deliver(post, media, account, "secret", p -> {});
        assertThat(body()).contains("image_url=https://cdn.test/media/tenant/image.jpg").doesNotContain("stale.example");
    }
    @Test void tiktokPhotoUsesTheCurrentPublicBaseUrlNotTheStoredOne() throws Exception {
        json("{\"data\":{\"publish_id\":\"photo\"}}");
        new TikTokDeliveryClient(server.url("").toString(), "key", "secret", mediaService).upload(media, "caption", "token");
        assertThat(server.takeRequest().getBody().readUtf8()).contains("https://cdn.test/media/tenant/image.jpg").doesNotContain("stale.example");
    }
    void json(String body) { server.enqueue(new MockResponse().setHeader("Content-Type", "application/json").setBody(body)); }
    String body() throws Exception { return URLDecoder.decode(server.takeRequest().getBody().readUtf8(), StandardCharsets.UTF_8); }
    @Test void facebookNativeScheduleUsesUnpublishedAndUnixTime() throws Exception {
        post.setScheduledFor(OffsetDateTime.now().plusHours(2)); json("{\"id\":\"photo\",\"post_id\":\"123_456\"}");
        var result = organic.deliver(post, media, account, "secret", p -> assertThat(p.getExternalId()).isEqualTo("123_456"));
        assertThat(result.status()).isEqualTo("SCHEDULED_ON_PLATFORM");
        assertThat(body()).contains("published=false", "scheduled_publish_time=" + post.getScheduledFor().toEpochSecond());
    }
    @Test void instagramProcessingResumesExistingContainer() throws Exception {
        post.setPlatform("instagram"); media.setKind("video");
        json("{\"id\":\"container\"}"); json("{\"status_code\":\"IN_PROGRESS\"}");
        assertThatThrownBy(() -> organic.deliver(post, media, account, "secret", p -> {})).isInstanceOf(ProcessingPendingException.class);
        json("{\"status_code\":\"FINISHED\"}"); json("{\"id\":\"published\"}"); json("{\"permalink\":\"https://instagram.com/p/1\"}");
        assertThat(organic.deliver(post, media, account, "secret", p -> {}).externalId()).isEqualTo("published");
        assertThat(server.takeRequest().getPath()).isEqualTo("/123/media");
        assertThat(server.takeRequest().getPath()).startsWith("/container?");
        assertThat(server.takeRequest().getPath()).startsWith("/container?");
        assertThat(server.takeRequest().getPath()).isEqualTo("/123/media_publish");
    }
    @Test void failedPermalinkDoesNotRepublish() {
        json("{\"id\":\"photo\",\"post_id\":\"published\"}"); json("{\"error\":{\"code\":190,\"message\":\"secret\"}}");
        var result = organic.deliver(post, media, account, "secret", p -> {});
        assertThat(result.status()).isEqualTo("PUBLISHED"); assertThat(result.permalink()).isNull();
        json("{\"permalink_url\":\"https://facebook.com/1\"}"); organic.deliver(post, media, account, "secret", p -> {});
        assertThat(server.getRequestCount()).isEqualTo(3);
    }
    @Test void tiktokPhotoAndVideoUseDifferentInboxPayloads() throws Exception {
        var client = new TikTokDeliveryClient(server.url("").toString(), "key", "secret", mediaService);
        json("{\"data\":{\"publish_id\":\"photo\"},\"error\":{\"code\":\"ok\"}}");
        assertThat(client.upload(media, "caption", "token")).isEqualTo("photo");
        var photo = server.takeRequest(); assertThat(photo.getPath()).isEqualTo("/v2/post/publish/content/init/");
        assertThat(photo.getBody().readUtf8()).contains("MEDIA_UPLOAD", "caption", "photo_images");
        media.setKind("video"); json("{\"data\":{\"publish_id\":\"video\"}}"); client.upload(media, "caption", "token");
        var video = server.takeRequest(); assertThat(video.getPath()).isEqualTo("/v2/post/publish/inbox/video/init/");
        assertThat(video.getBody().readUtf8()).contains("video_url").doesNotContain("caption", "privacy_level");
    }
    @Test void errorsAreSanitizedAndAuthRecognized() {
        json("{\"error\":{\"code\":190,\"message\":\"secret token URL\"}}");
        assertThatThrownBy(() -> organic.deliver(post, media, account, "secret", p -> {}))
                .isInstanceOfSatisfying(DeliveryException.class, e -> { assertThat(e.isAuthFailure()).isTrue(); assertThat(e.getMessage()).doesNotContain("secret"); assertThat(e.getCause()).isNull(); });
    }
    @Test void tiktokConfirmsInboxWithoutRepeatingInitialization() throws Exception {
        post.setPlatform("tiktok");
        var facade = new PlatformDeliveryClient(organic, new TikTokDeliveryClient(server.url("").toString(),"key","secret", mediaService), mock(MetaAdDeliveryClient.class));
        json("{\"data\":{\"publish_id\":\"inbox\"}}"); json("{\"data\":{\"status\":\"PROCESSING_DOWNLOAD\"}}");
        assertThatThrownBy(() -> facade.deliver(post,media,account,"token",p -> {})).isInstanceOf(ProcessingPendingException.class);
        json("{\"data\":{\"status\":\"SEND_TO_USER_INBOX\"}}");
        assertThat(facade.deliver(post,media,account,"token",p -> {}).status()).isEqualTo("SENT_TO_INBOX");
        assertThat(server.takeRequest().getPath()).isEqualTo("/v2/post/publish/content/init/");
        assertThat(server.takeRequest().getPath()).isEqualTo("/v2/post/publish/status/fetch/");
        assertThat(server.takeRequest().getPath()).isEqualTo("/v2/post/publish/status/fetch/");
    }
    @Test void tiktokProcessingFailureIsNotReportedAsInboxSuccess() {
        var client = new TikTokDeliveryClient(server.url("").toString(),"key","secret", mediaService);
        json("{\"data\":{\"status\":\"FAILED\",\"fail_reason\":\"photo_pull_failed secret\"}}");
        assertThatThrownBy(() -> client.confirmInbox("id","token")).isInstanceOfSatisfying(DeliveryException.class,e -> {
            assertThat(e.isRetryable()).isFalse(); assertThat(e.getMessage()).doesNotContain("secret");
        });
    }
    @Test void metaAdFailureResumesWithoutRecreatingCampaign() throws Exception {
        var repo = mock(AdPlatformConnectionRepository.class); var cipher = mock(TokenCipher.class);
        var conn = new AdPlatformConnection(); conn.setStatus("ACTIVE"); conn.setScopes("ads_management"); conn.setExternalAccountId("act_123"); conn.setAccessTokenEncrypted("encrypted");
        when(repo.findByBusinessProfileIdAndProvider(post.getBusinessProfileId(), "meta")).thenReturn(Optional.of(conn)); when(cipher.decrypt("encrypted")).thenReturn("user-token");
        // The ad image is downloaded from the asset's public URL, so serve it from the mock server.
        var client = new MetaAdDeliveryClient(server.url("").toString(), repo, cipher, new AdUrlBuilder("https://example.com"), mediaServiceFor(server.url("").toString()));
        post.setAdAccountExternalId("123"); post.setAdObjective("OUTCOME_TRAFFIC"); post.setAdCountries("PH"); post.setAdDailyBudgetMinor(1000L); post.setAdStartTime(OffsetDateTime.now()); post.setAdEndTime(OffsetDateTime.now().plusDays(5)); post.setAttributionSlug("owned");
        json("{\"id\":\"campaign\"}"); json("{\"error\":{\"code\":4}}");
        assertThatThrownBy(() -> client.deliver(post, media, account, p -> {})).isInstanceOf(DeliveryException.class);
        assertThat(post.getCampaignId()).isEqualTo("campaign");
        media.setStorageKey("owned-media.jpg");
        json("{\"id\":\"adset\"}"); server.enqueue(new MockResponse().setBody("image-bytes")); json("{\"images\":{\"x\":{\"hash\":\"hash\"}}}"); json("{\"id\":\"creative\"}"); json("{\"id\":\"ad\"}");
        assertThat(client.deliver(post, media, account, p -> {}).externalId()).isEqualTo("ad");
        assertThat(body()).contains("status=PAUSED"); body();
        assertThat(body()).contains("status=PAUSED", "campaign_id=campaign"); body(); body();
        assertThat(body()).contains("/r/owned?cmp={{campaign.id}}"); assertThat(body()).contains("status=PAUSED");
        assertThat(server.getRequestCount()).isEqualTo(7);
    }
    @Test void metaAdCampaignDeclaresBudgetSharingBecauseTheBudgetLivesOnTheAdSet() throws Exception {
        // Graph API v24+ rejects a campaign with no campaign-level budget (error 4834011) unless it
        // says whether its ad sets share budgets.
        var repo = mock(AdPlatformConnectionRepository.class); var cipher = mock(TokenCipher.class);
        var conn = new AdPlatformConnection(); conn.setStatus("ACTIVE"); conn.setScopes("ads_management"); conn.setExternalAccountId("act_123"); conn.setAccessTokenEncrypted("encrypted");
        when(repo.findByBusinessProfileIdAndProvider(post.getBusinessProfileId(), "meta")).thenReturn(Optional.of(conn)); when(cipher.decrypt("encrypted")).thenReturn("user-token");
        var client = new MetaAdDeliveryClient(server.url("").toString(), repo, cipher, new AdUrlBuilder("https://example.com"), mediaService);
        post.setAdAccountExternalId("123"); post.setAdObjective("OUTCOME_TRAFFIC"); post.setAdCountries("PH"); post.setAdDailyBudgetMinor(1000L);
        post.setAdStartTime(OffsetDateTime.now()); post.setAdEndTime(OffsetDateTime.now().plusDays(5)); post.setAttributionSlug("owned");
        json("{\"error\":{\"code\":4}}");
        assertThatThrownBy(() -> client.deliver(post, media, account, p -> {})).isInstanceOf(DeliveryException.class);
        var campaign = server.takeRequest();
        assertThat(campaign.getPath()).isEqualTo("/act_123/campaigns");
        assertThat(URLDecoder.decode(campaign.getBody().readUtf8(), StandardCharsets.UTF_8)).contains("is_adset_budget_sharing_enabled=false", "status=PAUSED");
    }
    /** The ad set request's form fields, decoded; "targeting" is JSON. */
    java.util.Map<String,String> adSetForm(MetaAdDeliveryClient client) throws Exception {
        post.setAdAccountExternalId("123"); post.setCampaignId("campaign"); post.setAttributionSlug("owned"); post.setAdCountries("KR");
        post.setAdDailyBudgetMinor(10_000L); post.setAdStartTime(OffsetDateTime.parse("2026-11-01T01:00:00Z")); post.setAdEndTime(OffsetDateTime.parse("2026-11-15T01:00:00Z"));
        media.setKind("video");
        json("{\"id\":\"adset\"}"); json("{\"error\":{\"code\":4}}"); // the next stage (video upload) ends the run
        assertThatThrownBy(() -> client.deliver(post, media, account, p -> {})).isInstanceOf(DeliveryException.class);
        var request = server.takeRequest();
        assertThat(request.getPath()).isEqualTo("/act_123/adsets");
        var form = new java.util.LinkedHashMap<String,String>();
        for (String pair : request.getBody().readUtf8().split("&")) {
            String[] kv = pair.split("=", 2); form.put(kv[0], URLDecoder.decode(kv[1], StandardCharsets.UTF_8));
        }
        return form;
    }
    MetaAdDeliveryClient adClient() {
        var repo = mock(AdPlatformConnectionRepository.class); var cipher = mock(TokenCipher.class);
        var conn = new AdPlatformConnection(); conn.setStatus("ACTIVE"); conn.setScopes("ads_management"); conn.setExternalAccountId("act_123"); conn.setAccessTokenEncrypted("encrypted");
        when(repo.findByBusinessProfileIdAndProvider(post.getBusinessProfileId(), "meta")).thenReturn(Optional.of(conn)); when(cipher.decrypt("encrypted")).thenReturn("user-token");
        return new MetaAdDeliveryClient(server.url("").toString(), repo, cipher, new AdUrlBuilder("https://example.com"), mediaService);
    }
    @Test void adSetTargetsTheMarketCountryLanguageAndInterestsAndKeepsAdvantageAudienceOffByDefault() throws Exception {
        post.setAdObjective("OUTCOME_TRAFFIC"); post.setAdLocales("26");
        post.setAdInterestsJson("[{\"id\":\"6003020834693\",\"name\":\"Scuba diving\"}]");

        var form = adSetForm(adClient());

        var targeting = new com.fasterxml.jackson.databind.ObjectMapper().readTree(form.get("targeting"));
        assertThat(targeting.path("geo_locations").path("countries").toString()).isEqualTo("[\"KR\"]");
        assertThat(targeting.path("locales").toString()).isEqualTo("[26]");
        assertThat(targeting.path("flexible_spec").toString()).isEqualTo("[{\"interests\":[{\"id\":\"6003020834693\",\"name\":\"Scuba diving\"}]}]");
        assertThat(targeting.path("targeting_automation").path("advantage_audience").asInt()).isZero();
        assertThat(targeting.has("age_min")).isFalse(); assertThat(targeting.has("genders")).isFalse();
        assertThat(form.get("daily_budget")).isEqualTo("10000");
        assertThat(form.get("start_time")).isEqualTo("2026-11-01T01:00Z"); assertThat(form.get("end_time")).isEqualTo("2026-11-15T01:00Z");
    }
    @Test void adSetOmitsLanguageAndInterestsWhenNoneWereChosenAndCanLetMetaWidenTheAudience() throws Exception {
        post.setAdObjective("OUTCOME_TRAFFIC"); post.setAdAdvantageAudience(true);

        var targeting = new com.fasterxml.jackson.databind.ObjectMapper().readTree(adSetForm(adClient()).get("targeting"));

        assertThat(targeting.has("locales")).isFalse(); assertThat(targeting.has("flexible_spec")).isFalse();
        assertThat(targeting.path("targeting_automation").path("advantage_audience").asInt()).isEqualTo(1);
        assertThat(targeting.path("geo_locations").path("countries").toString()).isEqualTo("[\"KR\"]");
    }
    @Test void eachObjectiveOptimisesForItsOwnResult() throws Exception {
        post.setAdObjective("OUTCOME_ENGAGEMENT");
        assertThat(adSetForm(adClient()).get("optimization_goal")).isEqualTo("POST_ENGAGEMENT");
    }
    @Test void engagementPromotesTheFacebookPageSoMetaAcceptsTheAd() throws Exception {
        // Meta refused the final /ads call with "an ad set with a selected object to promote ... (Page, URL, event)".
        post.setAdObjective("OUTCOME_ENGAGEMENT");
        var form = adSetForm(adClient());
        assertThat(new com.fasterxml.jackson.databind.ObjectMapper().readTree(form.get("promoted_object")).toString()).isEqualTo("{\"page_id\":\"123\"}");
    }
    @Test void engagementSaysItIsAboutThePostSoThePostEngagementGoalIsAllowed() throws Exception {
        // With only a Page attached, Meta read the ad set as "promote the Page" and refused POST_ENGAGEMENT
        // ("Performance goal isn't available", subcode 2490408).
        post.setAdObjective("OUTCOME_ENGAGEMENT");
        var form = adSetForm(adClient());
        assertThat(form.get("destination_type")).isEqualTo("ON_POST");
        assertThat(form.get("optimization_goal")).isEqualTo("POST_ENGAGEMENT");
    }
    @Test void trafficAndAwarenessDoNotSendAPromotedObjectOrDestination() throws Exception {
        post.setAdObjective("OUTCOME_TRAFFIC");
        var form = adSetForm(adClient());
        assertThat(form).doesNotContainKey("promoted_object").doesNotContainKey("destination_type");
    }
    @Test void awarenessOptimisesForReachAndTrafficForLinkClicks() throws Exception {
        post.setAdObjective("OUTCOME_AWARENESS");
        assertThat(adSetForm(adClient()).get("optimization_goal")).isEqualTo("REACH");
    }
    @Test void aDamagedInterestListStopsTheAdInsteadOfWideningTheAudience() {
        post.setAdObjective("OUTCOME_TRAFFIC"); post.setAdInterestsJson("not json");
        post.setAdAccountExternalId("123"); post.setCampaignId("campaign"); post.setAttributionSlug("owned"); post.setAdCountries("KR");
        post.setAdDailyBudgetMinor(10_000L); post.setAdStartTime(OffsetDateTime.now().plusHours(1)); post.setAdEndTime(OffsetDateTime.now().plusDays(2));
        assertThatThrownBy(() -> adClient().deliver(post, media, account, p -> {}))
                .isInstanceOf(DeliveryException.class).hasMessageContaining("audience");
        assertThat(server.getRequestCount()).isZero();
    }
    @Test void refreshRotatesTokens() {
        json("{\"access_token\":\"new\",\"refresh_token\":\"rotated\",\"expires_in\":86400,\"refresh_expires_in\":99999}");
        var grant = new TikTokDeliveryClient(server.url("").toString(), "key", "secret", mediaService).refreshToken("old");
        assertThat(grant.accessToken()).isEqualTo("new"); assertThat(grant.refreshToken()).isEqualTo("rotated"); assertThat(grant.toString()).doesNotContain("rotated");
    }
    @Test void finishedAdPinsOnlyItsAcceptedConnectionWithoutOverwritingTheGrant() {
        var repo=mock(AdPlatformConnectionRepository.class); var cipher=mock(TokenCipher.class);
        var connection=new AdPlatformConnection(); connection.setStatus("ACTIVE"); connection.setScopes("ads_management");
        connection.setExternalAccountId("act_123"); connection.setAccessTokenEncrypted("encrypted");
        when(repo.findByBusinessProfileIdAndProvider(post.getBusinessProfileId(),"meta")).thenReturn(Optional.of(connection));
        when(cipher.decrypt("encrypted")).thenReturn("user-token");
        post.setAdAccountExternalId("123"); post.setCampaignId("campaign"); post.setAdSetId("adset"); post.setAdMediaId("image");
        post.setCreativeId("creative"); post.setExternalId("ad"); post.setPinCampaign(true);
        var client=new MetaAdDeliveryClient(server.url("").toString(),repo,cipher,new AdUrlBuilder("https://example.com"),mediaService);
        assertThat(client.deliver(post,media,account,p -> {}).adsManagerUrl()).contains("act=123");
        verify(repo).pinCampaignIfUnchanged(eq(post.getBusinessProfileId()),eq("act_123"),eq("encrypted"),eq("campaign"),anyString());
        verify(repo,never()).save(any()); assertThat(server.getRequestCount()).isZero();
        connection.setExternalAccountId("act_999");
        assertThatThrownBy(() -> client.deliver(post,media,account,p -> {})).hasMessageContaining("account changed");
        assertThat(server.getRequestCount()).isZero();
    }
    @Test void adVideoWaitsForProcessingThenUsesPlatformThumbnailWithoutReupload() throws Exception {
        var repo = mock(AdPlatformConnectionRepository.class); var cipher = mock(TokenCipher.class);
        var conn = new AdPlatformConnection(); conn.setStatus("ACTIVE"); conn.setScopes("ads_management"); conn.setExternalAccountId("123"); conn.setAccessTokenEncrypted("encrypted");
        when(repo.findByBusinessProfileIdAndProvider(post.getBusinessProfileId(), "meta")).thenReturn(Optional.of(conn)); when(cipher.decrypt("encrypted")).thenReturn("user-token");
        var client = new MetaAdDeliveryClient(server.url("").toString(), repo, cipher, new AdUrlBuilder("https://example.com"), mediaService);
        post.setAdAccountExternalId("123"); post.setCampaignId("campaign"); post.setAdSetId("adset"); post.setAttributionSlug("owned"); media.setKind("video");
        json("{\"id\":\"video\"}"); json("{\"status\":{\"video_status\":\"processing\"}}");
        assertThatThrownBy(() -> client.deliver(post, media, account, p -> {})).isInstanceOf(ProcessingPendingException.class);
        assertThat(post.getAdMediaId()).isEqualTo("video");
        json("{\"status\":{\"video_status\":\"ready\"},\"thumbnails\":{\"data\":[{\"uri\":\"https://cdn.example/thumbnail.jpg\"}]}}");
        json("{\"id\":\"creative\"}"); json("{\"id\":\"ad\"}");
        assertThat(client.deliver(post, media, account, p -> {}).externalId()).isEqualTo("ad");
        assertThat(server.takeRequest().getPath()).isEqualTo("/act_123/advideos");
        assertThat(server.takeRequest().getPath()).isEqualTo("/video?fields=status,thumbnails");
        assertThat(server.takeRequest().getPath()).isEqualTo("/video?fields=status,thumbnails");
        assertThat(body()).contains("video_data", "https://cdn.example/thumbnail.jpg", "video_id");
        assertThat(body()).contains("status=PAUSED");
    }
    @Test void scheduledReconciliationUsesPlatformState() {
        post.setExternalId("123"); json("{\"is_published\":false}");
        assertThat(organic.reconcileScheduled(post, "token").status()).isEqualTo("SCHEDULED_ON_PLATFORM");
        json("{\"is_published\":true,\"permalink_url\":\"https://facebook.com/123\"}");
        assertThat(organic.reconcileScheduled(post, "token").status()).isEqualTo("PUBLISHED");
    }
    @Test void cancellationRequiresRemoteAcknowledgement() throws Exception {
        post.setExternalId("123_456"); json("{\"success\":true}"); organic.cancel(post, "token");
        var request = server.takeRequest(); assertThat(request.getMethod()).isEqualTo("DELETE"); assertThat(request.getPath()).isEqualTo("/123_456");
        json("{\"success\":false}"); assertThatThrownBy(() -> organic.cancel(post, "token")).isInstanceOf(DeliveryException.class);
    }
    @Test void facebookMissingStoryIdResumesWithoutUploadingAgain() throws Exception {
        post.setScheduledFor(OffsetDateTime.now().plusHours(2));
        json("{\"id\":\"photo\"}"); json("{}");
        assertThatThrownBy(() -> organic.deliver(post, media, account, "token", p -> {})).isInstanceOf(ProcessingPendingException.class);
        assertThat(post.getContainerId()).isEqualTo("photo");
        json("{\"page_story_id\":\"123_456\"}");
        assertThat(organic.deliver(post, media, account, "token", p -> {}).externalId()).isEqualTo("123_456");
        assertThat(server.takeRequest().getMethod()).isEqualTo("POST");
        assertThat(server.takeRequest().getPath()).isEqualTo("/photo?fields=page_story_id");
        assertThat(server.takeRequest().getMethod()).isEqualTo("GET");
    }
    @Test void cancelsFacebookPhotoBeforeStoryIdBecomesAvailable() throws Exception {
        post.setContainerId("photo"); json("{\"success\":true}"); organic.cancel(post,"token");
        var request=server.takeRequest(); assertThat(request.getMethod()).isEqualTo("DELETE"); assertThat(request.getPath()).isEqualTo("/photo");
    }
    @Test void immediateFacebookVideoWaitsForPublicationWithoutReupload() throws Exception {
        media.setKind("video"); json("{\"id\":\"video\"}");
        json("{\"status\":{\"publishing_phase\":{\"status\":\"not_started\"}}}");
        assertThatThrownBy(() -> organic.deliver(post,media,account,"token",p -> {})).isInstanceOf(ProcessingPendingException.class);
        json("{\"status\":{\"publishing_phase\":{\"status\":\"complete\"}},\"permalink_url\":\"https://facebook.com/video\"}");
        assertThat(organic.deliver(post,media,account,"token",p -> {}).status()).isEqualTo("PUBLISHED");
        assertThat(server.takeRequest().getMethod()).isEqualTo("POST");
        assertThat(server.takeRequest().getMethod()).isEqualTo("GET"); assertThat(server.takeRequest().getMethod()).isEqualTo("GET");
    }
    @Test void scheduledVideoReconciliationRequiresPublishingComplete() throws Exception {
        post.setExternalId("video"); post.setContainerId("video");
        json("{\"status\":{\"video_status\":\"ready\",\"publishing_phase\":{\"status\":\"not_started\"}}}");
        assertThat(organic.reconcileScheduled(post, "token").status()).isEqualTo("SCHEDULED_ON_PLATFORM");
        json("{\"status\":{\"publishing_phase\":{\"status\":\"complete\"}}}");
        assertThat(organic.reconcileScheduled(post, "token").status()).isEqualTo("PUBLISHED");
        assertThat(server.takeRequest().getPath()).isEqualTo("/video?fields=status,permalink_url");
    }
    @Test void rejectsForeignMediaAndIncompatibleImageBeforeNetwork() {
        var facade = new PlatformDeliveryClient(organic, mock(TikTokDeliveryClient.class), mock(MetaAdDeliveryClient.class));
        media.setBusinessProfileId(UUID.randomUUID());
        assertThatThrownBy(() -> facade.deliver(post, media, account, "token", p -> {})).isInstanceOf(DeliveryException.class);
        media.setBusinessProfileId(post.getBusinessProfileId()); media.setContentType("image/png"); post.setPlatform("instagram");
        assertThatThrownBy(() -> facade.deliver(post, media, account, "token", p -> {})).hasMessageContaining("JPEG");
        assertThat(server.getRequestCount()).isZero();
    }
}
