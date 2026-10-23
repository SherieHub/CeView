package com.ceview.module3.social.publish.client;

import com.ceview.module3.media.MediaAsset;
import com.ceview.module3.media.MediaService;
import com.ceview.module3.social.client.TikTokContentClient.CreatorGrant;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import java.time.OffsetDateTime;
import java.util.Map;
import java.util.List;

@Component
public class TikTokDeliveryClient {
    private final String base, key, secret;
    private final MediaService mediaService;
    private final DeliveryHttp http = new DeliveryHttp();
    public TikTokDeliveryClient(@Value("${ceview.social.tiktok.api-base-url:https://open.tiktokapis.com}") String base,
            @Value("${ceview.social.tiktok.client-key:}") String key,
            @Value("${ceview.social.tiktok.client-secret:}") String secret,
            MediaService mediaService) {
        this.base = base.replaceAll("/$", ""); this.key = key; this.secret = secret; this.mediaService = mediaService;
    }
    public String upload(MediaAsset media, String caption, String token) {
        boolean video = "video".equals(media.getKind());
        String mediaUrl = mediaService.publicUrlOf(media);
        Object body = video ? Map.of("source_info", Map.of("source", "PULL_FROM_URL", "video_url", mediaUrl))
                : Map.of("media_type", "PHOTO", "post_mode", "MEDIA_UPLOAD", "post_info", Map.of("description", caption),
                    "source_info", Map.of("source", "PULL_FROM_URL", "photo_images", List.of(mediaUrl), "photo_cover_index", 0));
        return DeliveryHttp.id(http.json(base + (video ? "/v2/post/publish/inbox/video/init/" : "/v2/post/publish/content/init/"), token, body).path("data"), "publish_id");
    }
    public CreatorGrant refreshToken(String token) {
        if (key.isBlank() || secret.isBlank()) throw new DeliveryException("TikTok publishing is not configured.", false, false);
        var json = http.form(base + "/v2/oauth/token/", null, Map.of("client_key", key, "client_secret", secret,
                "grant_type", "refresh_token", "refresh_token", token));
        return new CreatorGrant(DeliveryHttp.id(json, "access_token"), DeliveryHttp.id(json, "refresh_token"),
                OffsetDateTime.now().plusSeconds(json.path("expires_in").asLong()),
                OffsetDateTime.now().plusSeconds(json.path("refresh_expires_in").asLong()),
                json.path("open_id").asText(null), json.path("scope").asText(null));
    }
    public void confirmInbox(String publishId, String token) {
        var data = http.json(base + "/v2/post/publish/status/fetch/", token, Map.of("publish_id", publishId)).path("data");
        String status = data.path("status").asText();
        if ("SEND_TO_USER_INBOX".equals(status) || "PUBLISH_COMPLETE".equals(status)) return;
        if ("FAILED".equals(status)) {
            boolean revoked = "auth_removed".equals(data.path("fail_reason").asText());
            throw new DeliveryException(revoked ? "Reconnect TikTok before sending another draft."
                    : "TikTok could not process this draft. Check the media and verified media URL.", revoked, false);
        }
        if ("PROCESSING_UPLOAD".equals(status) || "PROCESSING_DOWNLOAD".equals(status)) throw new ProcessingPendingException();
        throw new DeliveryException("TikTok did not confirm inbox delivery. Check TikTok before sending another draft.", false, false);
    }
}
