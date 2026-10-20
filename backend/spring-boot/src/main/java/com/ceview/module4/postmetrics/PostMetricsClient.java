package com.ceview.module4.postmetrics;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.util.UriComponentsBuilder;
import java.time.Duration;
import java.util.*;

/** Optional insight fields stay null: views are never presented as unique reach. */
@Component
public class PostMetricsClient {
    public record Snapshot(Long reach, Long likes, Long comments, Long shares) {}
    private final WebClient http=WebClient.builder().build();
    private final String graph;
    private final String tiktok;
    public PostMetricsClient(
            @Value("${ceview.adplatform.meta.graph-base-url:https://graph.facebook.com/v25.0}") String graph,
            @Value("${ceview.social.tiktok.api-base-url:https://open.tiktokapis.com}") String tiktok) {
        this.graph=graph; this.tiktok=tiktok;
    }
    public Snapshot fetch(String platform, String id, String token) {
        if ("meta_ads".equals(platform)) {
            JsonNode result=get(id+"/insights","fields","reach",token).path("data").path(0).path("reach");
            Long reach=null;
            try { if (result.asText("").matches("[0-9]+")) reach=Long.parseLong(result.asText()); }
            catch (NumberFormatException ignored) { }
            // Paid reach does not imply the organic likes/comments/shares denominators.
            return new Snapshot(reach,null,null,null);
        }
        if ("instagram".equals(platform)) {
            JsonNode counts=get(id,"fields","like_count,comments_count",token);
            JsonNode insights=null;
            try { insights=get(id+"/insights","metric","reach,shares",token); }
            catch (RuntimeException ignored) { /* Keep independently available counts. */ }
            return new Snapshot(metric(insights,"reach"),number(counts.path("like_count")),
                    number(counts.path("comments_count")),metric(insights,"shares"));
        }
        if ("facebook".equals(platform)) {
            JsonNode counts=get(id,"fields","likes.limit(0).summary(true),comments.limit(0).summary(true),shares",token);
            // Meta can withhold reach for a media type or API version; preserve the
            // independently available engagement counts without inventing reach.
            Long reach=null;
            try { reach=metric(get(id+"/insights","metric","post_impressions_unique",token),"post_impressions_unique"); }
            catch (RuntimeException ignored) { }
            return new Snapshot(reach,number(counts.path("likes").path("summary").path("total_count")),
                    number(counts.path("comments").path("summary").path("total_count")),number(counts.path("shares").path("count")));
        }
        if ("tiktok".equals(platform)) {
            JsonNode root=http.post().uri(tiktok+"/v2/video/query/?fields=id,like_count,comment_count,share_count")
                    .headers(h -> h.setBearerAuth(token)).bodyValue(Map.of("filters",Map.of("video_ids",List.of(id))))
                    .retrieve().bodyToMono(JsonNode.class).block(Duration.ofSeconds(20));
            if (root==null || !"ok".equals(root.path("error").path("code").asText())) throw new IllegalStateException("Metrics unavailable");
            JsonNode video=root.path("data").path("videos").path(0);
            if (!id.equals(video.path("id").asText())) throw new IllegalStateException("Metrics unavailable");
            return new Snapshot(null,number(video.path("like_count")),number(video.path("comment_count")),number(video.path("share_count")));
        }
        throw new IllegalArgumentException("Unsupported metrics platform");
    }
    /** Inbox external IDs are publish IDs, never video IDs. A draft can produce several posts. */
    public Snapshot fetchTikTokInbox(String publishId,String token) {
        JsonNode root=http.post().uri(tiktok+"/v2/post/publish/status/fetch/")
                .headers(h -> h.setBearerAuth(token)).bodyValue(Map.of("publish_id",publishId))
                .retrieve().bodyToMono(JsonNode.class).block(Duration.ofSeconds(20));
        if (root==null || !"ok".equals(root.path("error").path("code").asText())) throw new IllegalStateException("Metrics unavailable");
        JsonNode ids=root.path("data").path("publicaly_available_post_id"); // TikTok's documented spelling.
        if (!"PUBLISH_COMPLETE".equals(root.path("data").path("status").asText()) || !ids.isArray() || ids.isEmpty()) {
            return new Snapshot(null,null,null,null);
        }
        Long likes=0L,comments=0L,shares=0L;
        Set<String> seen=new HashSet<>();
        for (JsonNode id:ids) {
            if (id.asText().isBlank() || !seen.add(id.asText())) continue;
            Snapshot video=fetch("tiktok",id.asText(),token);
            likes=add(likes,video.likes()); comments=add(comments,video.comments()); shares=add(shares,video.shares());
        }
        return seen.isEmpty() ? new Snapshot(null,null,null,null):new Snapshot(null,likes,comments,shares);
    }
    private static Long add(Long a,Long b) { return a==null || b==null ? null:Math.addExact(a,b); }
    private JsonNode get(String path,String key,String value,String token) {
        var uri=UriComponentsBuilder.fromUriString(graph).pathSegment(path.split("/"))
                .queryParam(key,"{value}").encode().buildAndExpand(value).toUri();
        JsonNode root=http.get().uri(uri).headers(h -> h.setBearerAuth(token)).retrieve()
                .bodyToMono(JsonNode.class).block(Duration.ofSeconds(20));
        if (root==null || root.has("error")) throw new IllegalStateException("Metrics unavailable");
        return root;
    }
    private static Long number(JsonNode node) { return node.isIntegralNumber() && node.asLong()>=0 ? node.asLong():null; }
    private static Long metric(JsonNode root,String name) {
        if (root==null) return null;
        for (JsonNode row:root.path("data")) if (name.equals(row.path("name").asText())) {
            Long total=number(row.path("total_value").path("value"));
            return total!=null ? total:number(row.path("values").path(0).path("value"));
        }
        return null;
    }
}
