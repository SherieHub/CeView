package com.ceview.module4.postmetrics;

import okhttp3.mockwebserver.*;
import org.junit.jupiter.api.*;
import static org.assertj.core.api.Assertions.*;

class PostMetricsClientTest {
    @Test void paidAdReachDoesNotFabricateOrganicInteractions() throws Exception {
        response("{\"data\":[{\"reach\":\"1234\"}]}");
        assertThat(client.fetch("meta_ads","ad-123","secret")).isEqualTo(new PostMetricsClient.Snapshot(1234L,null,null,null));
        assertThat(server.takeRequest().getPath()).isEqualTo("/ad-123/insights?fields=reach");
    }
    MockWebServer server;
    PostMetricsClient client;
    @BeforeEach void setup() throws Exception {
        server=new MockWebServer(); server.start();
        String base=server.url("/").toString().replaceAll("/$","");
        client=new PostMetricsClient(base,base);
    }
    @AfterEach void close() throws Exception { server.close(); }
    void response(String json) { server.enqueue(new MockResponse().setHeader("Content-Type","application/json").setBody(json)); }
    @Test void instagramCombinesCountsAndInsightsWithBearerAuthentication() throws Exception {
        response("{\"like_count\":5,\"comments_count\":2}");
        response("{\"data\":[{\"name\":\"reach\",\"values\":[{\"value\":100}]},{\"name\":\"shares\",\"total_value\":{\"value\":3}}]}");
        assertThat(client.fetch("instagram","media","secret")).isEqualTo(new PostMetricsClient.Snapshot(100L,5L,2L,3L));
        RecordedRequest request=server.takeRequest();
        assertThat(request.getHeader("Authorization")).isEqualTo("Bearer secret");
        assertThat(request.getPath()).doesNotContain("secret");
    }
    @Test void tiktokUsesOwnedVideoQueryWithoutCallingViewsReach() throws Exception {
        response("{\"error\":{\"code\":\"ok\"},\"data\":{\"videos\":[{\"id\":\"123\",\"like_count\":5,\"comment_count\":2,\"share_count\":3,\"view_count\":999}]}}");
        assertThat(client.fetch("tiktok","123","secret")).isEqualTo(new PostMetricsClient.Snapshot(null,5L,2L,3L));
        assertThat(server.takeRequest().getBody().readUtf8()).contains("\"video_ids\":[\"123\"]");
    }
    @Test void unavailableFacebookReachPreservesOtherCounts() {
        response("{\"likes\":{\"summary\":{\"total_count\":5}},\"comments\":{\"summary\":{\"total_count\":2}},\"shares\":{\"count\":3}}");
        server.enqueue(new MockResponse().setResponseCode(400));
        assertThat(client.fetch("facebook","123","secret")).isEqualTo(new PostMetricsClient.Snapshot(null,5L,2L,3L));
    }
    @Test void unavailableInstagramInsightsPreserveCountsWithoutFabricatingZero() {
        response("{\"like_count\":5,\"comments_count\":2}");
        server.enqueue(new MockResponse().setResponseCode(403));
        assertThat(client.fetch("instagram","123","secret")).isEqualTo(new PostMetricsClient.Snapshot(null,5L,2L,null));
    }
    @Test void inboxWithoutPublicPostIdNeverQueriesThePublishIdAsVideo() throws Exception {
        response("{\"error\":{\"code\":\"ok\"},\"data\":{\"status\":\"SEND_TO_USER_INBOX\",\"publicaly_available_post_id\":[]}}");
        assertThat(client.fetchTikTokInbox("publish-123","secret")).isEqualTo(new PostMetricsClient.Snapshot(null,null,null,null));
        RecordedRequest request=server.takeRequest();
        assertThat(request.getPath()).isEqualTo("/v2/post/publish/status/fetch/");
        assertThat(request.getBody().readUtf8()).isEqualTo("{\"publish_id\":\"publish-123\"}");
        assertThat(server.getRequestCount()).isEqualTo(1);
    }
    @Test void inboxUsesOnlyPublishedIdsAndAggregatesMultiplePosts() throws Exception {
        response("{\"error\":{\"code\":\"ok\"},\"data\":{\"status\":\"PUBLISH_COMPLETE\",\"publicaly_available_post_id\":[123,456]}}");
        response("{\"error\":{\"code\":\"ok\"},\"data\":{\"videos\":[{\"id\":\"123\",\"like_count\":5,\"comment_count\":2,\"share_count\":3}]}}");
        response("{\"error\":{\"code\":\"ok\"},\"data\":{\"videos\":[{\"id\":\"456\",\"like_count\":7,\"comment_count\":1,\"share_count\":4}]}}");
        assertThat(client.fetchTikTokInbox("publish-123","secret")).isEqualTo(new PostMetricsClient.Snapshot(null,12L,3L,7L));
        server.takeRequest();
        assertThat(server.takeRequest().getBody().readUtf8()).contains("\"video_ids\":[\"123\"]").doesNotContain("publish-123");
        assertThat(server.takeRequest().getBody().readUtf8()).contains("\"video_ids\":[\"456\"]");
    }
}
