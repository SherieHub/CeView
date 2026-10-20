package com.ceview.module3.social.publish.client;

import com.ceview.module3.media.MediaAsset;
import com.ceview.module3.social.PublishingAccount;
import com.ceview.module3.social.publish.SocialPost;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.function.Consumer;

@Component
public class MetaOrganicDeliveryClient {
    private final String base;
    private final DeliveryHttp http = new DeliveryHttp();
    public MetaOrganicDeliveryClient(@Value("${ceview.adplatform.meta.graph-base-url:https://graph.facebook.com/v25.0}") String base) {
        this.base = base.replaceAll("/$", "");
    }
    public void cancel(SocialPost post, String token) {
        String remoteId = post.getExternalId() != null ? post.getExternalId() : post.getContainerId();
        if (remoteId == null) throw new DeliveryException("There is no confirmed Facebook delivery to cancel.", false, false);
        if (post.getExternalId()!=null && post.getScheduledFor()!=null && !post.getScheduledFor().isAfter(OffsetDateTime.now())
                && "PUBLISHED".equals(reconcileScheduled(post,token).status()))
            throw new DeliveryException("Facebook already published this post. Manage the post in Facebook.",false,false);
        if (!http.delete(base + "/" + remoteId, token).path("success").asBoolean())
            throw new DeliveryException("Facebook did not confirm cancellation.", false, false);
    }
    public PlatformDeliveryClient.DeliveryResult reconcileScheduled(SocialPost post, String token) {
        // Facebook video ids are persisted in both fields; photos retain their separate photo id.
        if (post.getExternalId().equals(post.getContainerId())) {
            var video = http.get(base + "/" + post.getExternalId() + "?fields=status,permalink_url", token);
            String phase = video.path("status").path("publishing_phase").path("status").asText();
            if ("error".equals(phase)) throw new DeliveryException("Facebook could not publish the scheduled video.", false, false);
            return new PlatformDeliveryClient.DeliveryResult("complete".equals(phase) ? "PUBLISHED" : "SCHEDULED_ON_PLATFORM",
                    post.getExternalId(), video.path("permalink_url").asText(null), null);
        }
        var result = http.get(base + "/" + post.getExternalId() + "?fields=is_published,permalink_url", token);
        return new PlatformDeliveryClient.DeliveryResult(result.path("is_published").asBoolean() ? "PUBLISHED" : "SCHEDULED_ON_PLATFORM",
                post.getExternalId(), result.path("permalink_url").asText(null), null);
    }
    public PlatformDeliveryClient.DeliveryResult deliver(SocialPost post, MediaAsset media, PublishingAccount account,
                                                        String token, Consumer<SocialPost> checkpoint) {
        boolean video = "video".equals(media.getKind());
        boolean instagram = "instagram".equals(post.getPlatform());
        boolean scheduled = !instagram && post.getScheduledFor() != null && post.getScheduledFor().isAfter(OffsetDateTime.now());
        if (post.getExternalId() == null) {
            if (instagram) {
                if (post.getContainerId() == null) {
                    var values = new LinkedHashMap<String, Object>();
                    values.put("caption", post.getCaption());
                    values.put(video ? "video_url" : "image_url", media.getPublicUrl());
                    if (video) values.put("media_type", "REELS");
                    post.setContainerId(DeliveryHttp.id(http.form(base + "/" + account.getExternalId() + "/media", token, values), "id"));
                    checkpoint.accept(post);
                }
                String state = http.get(base + "/" + post.getContainerId() + "?fields=status_code", token).path("status_code").asText();
                if ("IN_PROGRESS".equals(state)) throw new ProcessingPendingException();
                if (!"FINISHED".equals(state)) throw new DeliveryException("Instagram could not prepare this media. Check the post in Instagram before retrying.", false, false);
                post.setExternalId(DeliveryHttp.id(http.form(base + "/" + account.getExternalId() + "/media_publish", token,
                        Map.of("creation_id", post.getContainerId())), "id"));
            } else {
                if (post.getContainerId() == null) {
                    var values = new LinkedHashMap<String, Object>();
                    values.put(video ? "file_url" : "url", media.getPublicUrl());
                    values.put(video ? "description" : "caption", post.getCaption());
                    if (scheduled) { values.put("published", false); values.put("scheduled_publish_time", post.getScheduledFor().toEpochSecond()); }
                    var result = http.form(base + "/" + account.getExternalId() + (video ? "/videos" : "/photos"), token, values);
                    post.setContainerId(DeliveryHttp.id(result, "id"));
                    if (video) post.setExternalId(post.getContainerId());
                    else if (result.hasNonNull("post_id")) post.setExternalId(result.get("post_id").asText());
                    checkpoint.accept(post);
                }
                if (post.getExternalId() == null) {
                    // The upload can omit post_id. Resolve the Page story without uploading again.
                    String storyId = http.get(base + "/" + post.getContainerId() + "?fields=page_story_id", token).path("page_story_id").asText("");
                    if (storyId.isBlank()) throw new ProcessingPendingException();
                    post.setExternalId(storyId);
                }
            }
            checkpoint.accept(post);
        }
        if (!instagram && !scheduled && (video || post.getScheduledFor() != null)) {
            var confirmed = reconcileScheduled(post, token);
            if (!"PUBLISHED".equals(confirmed.status())) throw new ProcessingPendingException();
            return confirmed;
        }
        String permalink = null;
        if (!scheduled) {
            // Delivery is already confirmed; a link lookup failure must never duplicate the post.
            try { permalink = http.get(base + "/" + post.getExternalId() + "?fields=" + (instagram ? "permalink" : "permalink_url"), token)
                    .path(instagram ? "permalink" : "permalink_url").asText(null); }
            catch (DeliveryException ignored) { }
        }
        return new PlatformDeliveryClient.DeliveryResult(scheduled ? "SCHEDULED_ON_PLATFORM" : "PUBLISHED", post.getExternalId(), permalink, null);
    }
}
