package com.ceview.module3.social.publish.client;

import com.ceview.common.crypto.TokenCipher;
import com.ceview.module3.media.MediaAsset;
import com.ceview.module3.social.PublishingAccount;
import com.ceview.module3.social.publish.SocialPost;
import com.ceview.module4.adconnections.AdPlatformConnection;
import com.ceview.module4.adconnections.AdPlatformConnectionRepository;
import com.ceview.module4.attribution.link.AdUrlBuilder;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import java.util.*;
import java.util.function.Consumer;

/** Each successful remote write is durably checkpointed before the next write. */
@Component
public class MetaAdDeliveryClient {
    private final String base;
    private final AdPlatformConnectionRepository connections;
    private final TokenCipher cipher;
    private final AdUrlBuilder urls;
    private final DeliveryHttp http = new DeliveryHttp();
    public MetaAdDeliveryClient(@Value("${ceview.adplatform.meta.graph-base-url:https://graph.facebook.com/v25.0}") String base,
            AdPlatformConnectionRepository connections, TokenCipher cipher, AdUrlBuilder urls) {
        this.base = base.replaceAll("/$", ""); this.connections = connections; this.cipher = cipher; this.urls = urls;
    }
    public PlatformDeliveryClient.DeliveryResult deliver(SocialPost post, MediaAsset media, PublishingAccount page, Consumer<SocialPost> checkpoint) {
        var connection = connections.findByBusinessProfileIdAndProvider(post.getBusinessProfileId(), "meta")
                .filter(c -> AdPlatformConnection.STATUS_ACTIVE.equals(c.getStatus()))
                .filter(c -> c.getExternalAccountId() != null && c.getScopes() != null && Arrays.asList(c.getScopes().split("[,\\s]+")).contains("ads_management"))
                .orElseThrow(() -> new DeliveryException("Connect a Meta ad account with advertising permission.", true, false));
        String token = cipher.decrypt(connection.getAccessTokenEncrypted());
        String accountId = connection.getExternalAccountId().replaceFirst("^act_", "");
        if (!accountId.equals(post.getAdAccountExternalId()))
            throw new DeliveryException("The selected Meta ad account changed. Create a new ad for the current account.", false, false);
        if (!accountId.matches("[0-9]+")) throw new DeliveryException("Select a valid Meta ad account.", false, false);
        String account = base + "/act_" + accountId;
        String name = "CeView " + post.getId();
        boolean video = "video".equals(media.getKind());
        if (post.getCampaignId() == null) {
            post.setCampaignId(DeliveryHttp.id(http.form(account + "/campaigns", token, Map.of("name", name,
                    "objective", post.getAdObjective(), "status", "PAUSED", "special_ad_categories", List.of())), "id"));
            checkpoint.accept(post);
        }
        if (post.getAdSetId() == null) {
            var values = new LinkedHashMap<String, Object>();
            values.put("name", name); values.put("campaign_id", post.getCampaignId()); values.put("status", "PAUSED");
            values.put("daily_budget", post.getAdDailyBudgetMinor()); values.put("billing_event", "IMPRESSIONS");
            values.put("optimization_goal", "OUTCOME_AWARENESS".equals(post.getAdObjective()) ? "REACH" : "LINK_CLICKS");
            values.put("bid_strategy", "LOWEST_COST_WITHOUT_CAP");
            values.put("targeting", Map.of("geo_locations", Map.of("countries", Arrays.asList(post.getAdCountries().split(",")))));
            values.put("start_time", post.getAdStartTime().toString()); values.put("end_time", post.getAdEndTime().toString());
            post.setAdSetId(DeliveryHttp.id(http.form(account + "/adsets", token, values), "id")); checkpoint.accept(post);
        }
        if (post.getAdMediaId() == null) {
            if (video) post.setAdMediaId(DeliveryHttp.id(http.form(account + "/advideos", token, Map.of("file_url", media.getPublicUrl())), "id"));
            else {
                var images = http.image(account + "/adimages", token, media.getPublicUrl()).path("images");
                if (!images.elements().hasNext()) throw new DeliveryException("Meta did not accept the ad image.", false, false);
                post.setAdMediaId(DeliveryHttp.id(images.elements().next(), "hash"));
            }
            checkpoint.accept(post);
        }
        if (post.getCreativeId() == null) {
            Map<String, Object> data = new LinkedHashMap<>();
            data.put("message", post.getCaption());
            data.put(video ? "video_id" : "image_hash", post.getAdMediaId());
            String link = urls.metaAdUrl(post.getAttributionSlug());
            data.put("call_to_action", Map.of("type", "LEARN_MORE", "value", Map.of("link", link)));
            if (video) {
                var state = http.get(base + "/" + post.getAdMediaId() + "?fields=status,thumbnails", token);
                String videoState = state.path("status").path("video_status").asText();
                if ("error".equals(videoState)) throw new DeliveryException("Meta could not process the ad video. Upload a compatible video.", false, false);
                if (!"ready".equals(videoState)) throw new ProcessingPendingException();
                var thumbs = state.path("thumbnails").path("data");
                if (!thumbs.isArray() || thumbs.isEmpty()) throw new ProcessingPendingException();
                data.put("image_url", DeliveryHttp.id(thumbs.get(0), "uri"));
            } else data.put("link", link);
            post.setCreativeId(DeliveryHttp.id(http.form(account + "/adcreatives", token, Map.of("name", name,
                    "object_story_spec", Map.of("page_id", page.getExternalId(), video ? "video_data" : "link_data", data))), "id"));
            checkpoint.accept(post);
        }
        if (post.getExternalId() == null) {
            post.setExternalId(DeliveryHttp.id(http.form(account + "/ads", token, Map.of("name", name, "adset_id", post.getAdSetId(),
                    "creative", Map.of("creative_id", post.getCreativeId()), "status", "PAUSED")), "id"));
            checkpoint.accept(post);
        }
        if (post.isPinCampaign()) {
            connections.pinCampaignIfUnchanged(post.getBusinessProfileId(), connection.getExternalAccountId(),
                    connection.getAccessTokenEncrypted(), post.getCampaignId(), name);
        }
        return new PlatformDeliveryClient.DeliveryResult("PUBLISHED", post.getExternalId(), null,
                "https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=" + accountId);
    }
}
