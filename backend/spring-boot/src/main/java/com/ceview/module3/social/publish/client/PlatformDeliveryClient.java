package com.ceview.module3.social.publish.client;

import com.ceview.module3.media.MediaAsset;
import com.ceview.module3.social.PublishingAccount;
import com.ceview.module3.social.publish.SocialPost;
import org.springframework.stereotype.Component;
import java.util.function.Consumer;

@Component
public class PlatformDeliveryClient {
    public record DeliveryResult(String status, String externalId, String permalink, String adsManagerUrl) { }
    private final MetaOrganicDeliveryClient organic;
    private final TikTokDeliveryClient tiktok;
    private final MetaAdDeliveryClient ads;
    public PlatformDeliveryClient(MetaOrganicDeliveryClient organic, TikTokDeliveryClient tiktok, MetaAdDeliveryClient ads) {
        this.organic = organic; this.tiktok = tiktok; this.ads = ads;
    }
    public void validate(SocialPost post, MediaAsset media, PublishingAccount account) {
        if (!post.getBusinessProfileId().equals(media.getBusinessProfileId()) || !post.getBusinessProfileId().equals(account.getBusinessProfileId()))
            throw new DeliveryException("This media or account is not available.", false, false);
        if ("image".equals(media.getKind())) {
            if ("instagram".equals(post.getPlatform()) && !"image/jpeg".equals(media.getContentType()))
                throw new DeliveryException("Instagram requires a JPEG image. Upload a JPEG or video.", false, false);
            if ("tiktok".equals(post.getPlatform()) && !java.util.Set.of("image/jpeg", "image/webp").contains(media.getContentType()))
                throw new DeliveryException("TikTok photos require JPEG or WEBP. Upload a compatible image or video.", false, false);
        }
    }
    public void cancel(SocialPost post, PublishingAccount account, String token) {
        checkAccount(post, account); organic.cancel(post, token);
    }
    public DeliveryResult reconcileScheduled(SocialPost post, PublishingAccount account, String token) {
        checkAccount(post, account); return organic.reconcileScheduled(post, token);
    }
    private void checkAccount(SocialPost post, PublishingAccount account) {
        if (!"facebook".equals(post.getPlatform()) || !post.getBusinessProfileId().equals(account.getBusinessProfileId()))
            throw new DeliveryException("This scheduled post is not available.", false, false);
    }
    public DeliveryResult deliver(SocialPost post, MediaAsset media, PublishingAccount account, String token, Consumer<SocialPost> checkpoint) {
        validate(post, media, account);
        return switch (post.getPlatform()) {
            case "facebook", "instagram" -> organic.deliver(post, media, account, token, checkpoint);
            case "meta_ads" -> ads.deliver(post, media, account, checkpoint);
            case "tiktok" -> {
                if (post.getExternalId() == null) { post.setExternalId(tiktok.upload(media, post.getCaption(), token)); checkpoint.accept(post); }
                tiktok.confirmInbox(post.getExternalId(), token);
                yield new DeliveryResult("SENT_TO_INBOX", post.getExternalId(), null, null);
            }
            default -> throw new DeliveryException("Unsupported publishing platform.", false, false);
        };
    }
}
