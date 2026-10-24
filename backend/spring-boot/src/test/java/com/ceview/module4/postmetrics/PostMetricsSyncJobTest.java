package com.ceview.module4.postmetrics;

import com.ceview.module3.social.*;
import com.ceview.module3.social.publish.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import java.time.OffsetDateTime;
import java.util.*;
import static org.mockito.Mockito.*;
import static org.assertj.core.api.Assertions.*;

class PostMetricsSyncJobTest {
    final SocialPostRepository posts=mock(SocialPostRepository.class);
    final PublishingAccountRepository accounts=mock(PublishingAccountRepository.class);
    final PostMetricRepository metrics=mock(PostMetricRepository.class);
    final PostMetricsClient client=mock(PostMetricsClient.class);
    final PublishingService publishing=mock(PublishingService.class);
    final PostMetricsSyncJob job=new PostMetricsSyncJob(posts,accounts,metrics,client,publishing,new ObjectMapper());
    final UUID owner=UUID.randomUUID();
    final SocialPost post=new SocialPost();
    final PublishingAccount account=new PublishingAccount();
    final PostMetric row=new PostMetric();
    final OffsetDateTime published=OffsetDateTime.parse("2026-10-01T12:00:00Z");
    @BeforeEach void setup() {
        account.setAccountId(UUID.randomUUID()); account.setExternalId("page"); account.setStatus("ACTIVE"); account.setAccessTokenEncrypted("encrypted");
        post.setId(UUID.randomUUID()); post.setBusinessProfileId(owner); post.setPlatform("facebook"); post.setExternalId("remote");
        post.setPublishingAccountId(account.getAccountId()); post.setTargetExternalId("page"); post.setPublishedAt(published);
        when(accounts.findByBusinessProfileIdAndPlatform(owner,"facebook")).thenReturn(Optional.of(account));
        when(metrics.findByPostIdAndBusinessProfileId(post.getId(),owner)).thenReturn(Optional.of(row));
        when(publishing.accessTokenForMetrics(post)).thenReturn("token");
        when(client.fetch("facebook","remote","token")).thenReturn(new PostMetricsClient.Snapshot(100L,4L,3L,3L));
    }
    @Test void sameDayReplacesOneSampleAndLateDaysDoNotGrowPastSeven() {
        job.syncPost(post,published); job.syncPost(post,published.plusHours(1));
        assertThat(row.getReachSeriesJson()).isEqualTo("[100]");
        assertThat(row.getEngagementRate()).isEqualTo(10.0);
        job.syncPost(post,published.plusDays(6));
        assertThat(row.getReachSeriesJson()).isEqualTo("[100,null,null,null,null,null,100]");
        job.syncPost(post,published.plusDays(8));
        assertThat(row.getReachSeriesJson()).isEqualTo("[100,null,null,null,null,null,100]");
    }
    @Test void unavailableReachDoesNotBecomeZeroOrAFabricatedSeries() {
        when(client.fetch("facebook","remote","token")).thenReturn(new PostMetricsClient.Snapshot(null,4L,3L,null));
        job.syncPost(post,published);
        assertThat(row.getReach()).isNull(); assertThat(row.getEngagementRate()).isNull();
        assertThat(row.getReachSeriesJson()).isEqualTo("[]");
    }
    @Test void pausedAdUsesTheAcceptedUserGrantAndKeepsUnknownPublicationHistoryEmpty() {
        post.setPlatform("meta_ads"); post.setPublishedAt(null);
        when(client.fetch("meta_ads","remote","token")).thenReturn(new PostMetricsClient.Snapshot(123L,null,null,null));
        job.syncPost(post,published);
        verify(publishing).accessTokenForMetrics(post); verifyNoInteractions(accounts);
        assertThat(row.getReach()).isEqualTo(123L); assertThat(row.getReachSeriesJson()).isEqualTo("[]");
        assertThat(row.getEngagementRate()).isNull();
    }
    @Test void reconnectedIdentityCannotFetchAnOldAccountsPost() {
        account.setExternalId("different-page"); job.syncPost(post,published);
        verifyNoInteractions(client,metrics,publishing);
    }
    @Test void noPublishedIdLeavesMetricsUnavailable() {
        post.setExternalId(null); job.syncPost(post,published);
        verifyNoInteractions(client,metrics,accounts);
    }
    @Test void inboxUsesStatusResolutionAndSharedRefreshingTokenHelper() {
        post.setPlatform("tiktok"); post.setStatus("SENT_TO_INBOX"); account.setScopes("video.upload video.list");
        when(accounts.findByBusinessProfileIdAndPlatform(owner,"tiktok")).thenReturn(Optional.of(account));
        when(client.fetchTikTokInbox("remote","token")).thenReturn(new PostMetricsClient.Snapshot(null,4L,3L,2L));
        job.syncPost(post,published);
        verify(publishing).accessTokenForMetrics(post);
        verify(client).fetchTikTokInbox("remote","token");
        verify(client,never()).fetch(eq("tiktok"),anyString(),anyString());
        assertThat(row.getLikes()).isEqualTo(4L);
    }
    @Test void accountLookupAndMetricsWriteAlwaysUsePersistedTenant() {
        job.syncPost(post,published);
        verify(accounts).findByBusinessProfileIdAndPlatform(owner,"facebook");
        verify(metrics).findByPostIdAndBusinessProfileId(post.getId(),owner);
        assertThat(row.getBusinessProfileId()).isEqualTo(owner);
    }
}
