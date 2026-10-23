package com.ceview.module4.postmetrics;

import com.ceview.auth.CurrentBusinessProfile;
import com.ceview.module3.social.publish.*;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
@RequestMapping("/api/analytics/posts")
public class PostMetricsController {
    private final CurrentBusinessProfile current;
    private final PublishingService posts;
    private final PostViewService views;
    public PostMetricsController(CurrentBusinessProfile current, PublishingService posts, PostViewService views) {
        this.current=current; this.posts=posts; this.views=views;
    }
    @GetMapping
    public List<PublishingDtos.PostView> list(@RequestParam(required=false) String platform) {
        return posts.list(current.resolveProfileId()).stream()
                .filter(p -> Set.of("PUBLISHED","SENT_TO_INBOX","PAUSED").contains(p.getStatus()))
                .filter(p -> platform==null || platform.equals(p.getPlatform()))
                .map(views::view).toList();
    }
    @GetMapping("/{id}")
    public PublishingDtos.PostView get(@PathVariable UUID id) {
        return views.view(posts.get(current.resolveProfileId(),id));
    }
}
