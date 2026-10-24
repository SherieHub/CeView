package com.ceview.module3.social.publish;

import com.ceview.module3.media.MediaAssetRepository;
import com.ceview.module3.media.MediaService;
import com.ceview.module3.social.publish.PublishingDtos.PostView;
import com.ceview.module4.postmetrics.PostMetricRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import java.util.*;

/** One response shape for Content Studio, Calendar and Performance; never exposes credentials. */
@Service
public class PostViewService {
    private final MediaAssetRepository media;
    private final MediaService mediaService;
    private final PostMetricRepository metrics;
    private final ObjectMapper mapper;
    public PostViewService(MediaAssetRepository media,MediaService mediaService,PostMetricRepository metrics,ObjectMapper mapper) {
        this.media=media; this.mediaService=mediaService; this.metrics=metrics; this.mapper=mapper;
    }
    public PostView view(SocialPost post) {
        var asset=media.findByMediaIdAndBusinessProfileId(post.getMediaAssetId(),post.getBusinessProfileId());
        var metric=metrics.findByPostIdAndBusinessProfileId(post.getId(),post.getBusinessProfileId());
        List<Long> series=List.of();
        if (metric.isPresent()) {
            try { series=mapper.readValue(metric.get().getReachSeriesJson(),new TypeReference<List<Long>>() {}); }
            catch (Exception ignored) { /* Missing series is not a fabricated history. */ }
        }
        String status=switch (post.getStatus()) {
            case "PUBLISHED" -> "meta_ads".equals(post.getPlatform()) ? "draft" : "published";
            case "PENDING" -> post.getScheduledFor()==null ? "processing" : "scheduled";
            case "SCHEDULED_ON_PLATFORM" -> "scheduled";
            case "SENT_TO_INBOX" -> "inbox";
            case "FAILED" -> "failed";
            case "CANCELLED" -> "cancelled";
            default -> "processing";
        };
        var date=post.getScheduledFor()!=null ? post.getScheduledFor() : post.getCreatedAt();
        return new PostView(post.getId(),date.toLocalDate().toString(),post.getPlatform(),post.getCaption(),status,
                post.getStatus(),asset.map(mediaService::publicUrlOf).orElse(null),asset.map(a -> a.getKind()).orElse(null),
                post.getScheduledFor(),post.getPermalink(),post.getAdsManagerUrl(),post.getErrorMessage(),metric.isPresent(),
                metric.map(m -> m.getReach()).orElse(null),metric.map(m -> m.getLikes()).orElse(null),
                metric.map(m -> m.getComments()).orElse(null),metric.map(m -> m.getShares()).orElse(null),
                metric.map(m -> m.getEngagementRate()).orElse(null),series);
    }
}
