package com.ceview.module4.postmetrics;

import com.ceview.auth.CurrentBusinessProfile;
import com.ceview.module3.social.publish.*;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import java.util.*;
import static org.mockito.Mockito.*;
import static org.assertj.core.api.Assertions.*;

class PostMetricsControllerTest {
    @Test void detailDelegatesToTenantScopedLookupAndRejectsForeignPost() {
        var current=mock(CurrentBusinessProfile.class);
        var posts=mock(PublishingService.class);
        var views=mock(PostViewService.class);
        UUID owner=UUID.randomUUID(),id=UUID.randomUUID();
        when(current.resolveProfileId()).thenReturn(owner);
        when(posts.get(owner,id)).thenThrow(new ResponseStatusException(HttpStatus.NOT_FOUND));
        assertThatThrownBy(() -> new PostMetricsController(current,posts,views).get(id))
                .isInstanceOf(ResponseStatusException.class);
        verify(posts).get(owner,id); verifyNoInteractions(views);
    }
    @Test void listExcludesUndeliveredPostsAndAppliesPlatformFilterWithinTenant() {
        var current=mock(CurrentBusinessProfile.class);
        var posts=mock(PublishingService.class);
        var views=mock(PostViewService.class);
        UUID owner=UUID.randomUUID(); when(current.resolveProfileId()).thenReturn(owner);
        SocialPost published=new SocialPost(); published.setPlatform("facebook"); published.setStatus("PUBLISHED");
        SocialPost pending=new SocialPost(); pending.setPlatform("facebook"); pending.setStatus("PENDING");
        SocialPost other=new SocialPost(); other.setPlatform("instagram"); other.setStatus("PUBLISHED");
        when(posts.list(owner)).thenReturn(List.of(published,pending,other));
        new PostMetricsController(current,posts,views).list("facebook");
        verify(posts).list(owner); verify(views).view(published); verifyNoMoreInteractions(views);
    }
}
