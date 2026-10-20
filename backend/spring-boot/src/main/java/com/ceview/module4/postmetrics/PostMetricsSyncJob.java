package com.ceview.module4.postmetrics;

import com.ceview.module3.social.*;
import com.ceview.module3.social.publish.*;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.slf4j.LoggerFactory;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;

/** Remote reads hold no database transaction; daily samples use UTC day boundaries. */
@Service
@ConditionalOnProperty(name="ceview.social.metrics-enabled",havingValue="true",matchIfMissing=true)
public class PostMetricsSyncJob {
    private final SocialPostRepository posts;
    private final PublishingAccountRepository accounts;
    private final PostMetricRepository metrics;
    private final PostMetricsClient client;
    private final PublishingService publishing;
    private final ObjectMapper mapper;
    public PostMetricsSyncJob(SocialPostRepository posts, PublishingAccountRepository accounts,
            PostMetricRepository metrics, PostMetricsClient client,PublishingService publishing,ObjectMapper mapper) {
        this.posts=posts; this.accounts=accounts; this.metrics=metrics; this.client=client; this.publishing=publishing; this.mapper=mapper;
    }
    @Scheduled(cron="${ceview.social.metrics-cron:0 0 3 * * *}",zone="UTC")
    public void sync() {
        for (SocialPost post:posts.findByStatusIn(List.of("PUBLISHED","SENT_TO_INBOX"))) {
            try { syncPost(post,OffsetDateTime.now(ZoneOffset.UTC)); }
            catch (RuntimeException e) {
                // No exception text: upstream failures may include a token-bearing URL.
                LoggerFactory.getLogger(getClass()).warn("Post metrics refresh unavailable for {}",post.getId());
            }
        }
    }
    void syncPost(SocialPost post,OffsetDateTime now) {
        if (post.getExternalId()==null || post.getExternalId().isBlank()) return;
        if (!"meta_ads".equals(post.getPlatform())) {
        var account=accounts.findByBusinessProfileIdAndPlatform(post.getBusinessProfileId(),post.getPlatform()).orElse(null);
        if (account==null || !PublishingAccount.STATUS_ACTIVE.equals(account.getStatus())) return;
        // Never query a former owner's post using a newly reconnected account.
        if (!Objects.equals(post.getPublishingAccountId(),account.getAccountId()) ||
                !Objects.equals(post.getTargetExternalId(),account.getExternalId())) return;
        if ("tiktok".equals(post.getPlatform()) && (account.getScopes()==null ||
                !Arrays.asList(account.getScopes().split("[,\\s]+")).contains("video.list"))) return;
        }
        String token=publishing.accessTokenForMetrics(post);
        var snapshot="tiktok".equals(post.getPlatform()) && "SENT_TO_INBOX".equals(post.getStatus())
                ? client.fetchTikTokInbox(post.getExternalId(),token):client.fetch(post.getPlatform(),post.getExternalId(),token);
        if (snapshot.reach()==null && snapshot.likes()==null && snapshot.comments()==null && snapshot.shares()==null) return;
        var row=metrics.findByPostIdAndBusinessProfileId(post.getId(),post.getBusinessProfileId()).orElseGet(PostMetric::new);
        row.setPostId(post.getId()); row.setBusinessProfileId(post.getBusinessProfileId());
        row.setReach(snapshot.reach()); row.setLikes(snapshot.likes()); row.setComments(snapshot.comments()); row.setShares(snapshot.shares());
        row.setEngagementRate(snapshot.reach()!=null && snapshot.reach()>0 && snapshot.likes()!=null && snapshot.comments()!=null && snapshot.shares()!=null
                ? 100.0*(snapshot.likes()+snapshot.comments()+snapshot.shares())/snapshot.reach():null);
        List<Long> series=new ArrayList<>();
        try { if (row.getReachSeriesJson()!=null) series=mapper.readValue(row.getReachSeriesJson(),new TypeReference<List<Long>>(){}); }
        catch (Exception e) { throw new IllegalStateException("Invalid stored reach series"); }
        if (snapshot.reach()!=null && post.getPublishedAt()!=null) {
            long day=ChronoUnit.DAYS.between(post.getPublishedAt().atZoneSameInstant(ZoneOffset.UTC).toLocalDate(),now.toLocalDate());
            if (day>=0 && day<7) {
                while(series.size()<=day) series.add(null);
                series.set((int)day,snapshot.reach());
            }
        }
        try { row.setReachSeriesJson(mapper.writeValueAsString(series)); }
        catch(Exception e) { throw new IllegalStateException("Could not store reach series"); }
        row.setLastSyncedAt(now); metrics.save(row);
    }
}
