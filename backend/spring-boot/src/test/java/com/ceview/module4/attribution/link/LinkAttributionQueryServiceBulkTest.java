package com.ceview.module4.attribution.link;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import com.ceview.module4.attribution.AttributionRedemptionRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;

@ExtendWith(MockitoExtension.class)
class LinkAttributionQueryServiceBulkTest {

  @Mock private AttributionLinkRepository links;
  @Mock private AttributionClickRepository clicks;
  @Mock private AttributionRedemptionRepository redemptions;

  private LinkAttributionQueryService queryService;

  @BeforeEach
  void setUp() {
    queryService = new LinkAttributionQueryService(links, clicks, redemptions);
  }

  @Test
  void oneLookupOneCountOneClickLoadOneRedemptionLoadRegardlessOfCreativeCount() {
    UUID profileId = UUID.randomUUID();
    UUID linkId = UUID.randomUUID();
    AttributionLink link = new AttributionLink();
    link.setLinkId(linkId);
    link.setBusinessProfileId(profileId);
    link.setSlug("slug1234");
    when(links.findByLinkIdAndBusinessProfileId(linkId, profileId)).thenReturn(Optional.of(link));

    AttributionClickRepository.CreativeClickCount countA =
        new AttributionClickRepository.CreativeClickCount() {
          public String getAdId() {
            return "ad-A";
          }

          public long getClicks() {
            return 100;
          }
        };
    AttributionClickRepository.CreativeClickCount countB =
        new AttributionClickRepository.CreativeClickCount() {
          public String getAdId() {
            return "ad-B";
          }

          public long getClicks() {
            return 50;
          }
        };
    when(clicks.countClicksByCreative(linkId)).thenReturn(List.of(countA, countB));

    AttributionClick clickA = new AttributionClick();
    clickA.setClickId(UUID.randomUUID());
    clickA.setBusinessProfileId(profileId);
    clickA.setLinkId(linkId);
    clickA.setInWindow(true);

    when(clicks.findByLinkIdOrderByClickedAtDesc(linkId)).thenReturn(List.of(clickA));
    when(redemptions.findByAttributionClickIdIn(List.of(clickA.getClickId())))
        .thenReturn(List.of());

    queryService.performance(profileId, linkId);

    verify(links, times(1)).findByLinkIdAndBusinessProfileId(linkId, profileId);
    verify(clicks, times(1)).countClicksByCreative(linkId);
    verify(clicks, times(1)).findByLinkIdOrderByClickedAtDesc(linkId);
    verify(redemptions, times(1)).findByAttributionClickIdIn(any());
    verifyNoMoreInteractions(links, clicks, redemptions);
  }

  @Test
  void emptyLinkNeverCallsRedemptions() {
    UUID profileId = UUID.randomUUID();
    UUID linkId = UUID.randomUUID();
    AttributionLink link = new AttributionLink();
    link.setLinkId(linkId);
    link.setBusinessProfileId(profileId);
    link.setSlug("slug1234");
    when(links.findByLinkIdAndBusinessProfileId(linkId, profileId)).thenReturn(Optional.of(link));

    when(clicks.countClicksByCreative(linkId)).thenReturn(List.of());
    when(clicks.findByLinkIdOrderByClickedAtDesc(linkId)).thenReturn(List.of());

    queryService.performance(profileId, linkId);

    verify(links, times(1)).findByLinkIdAndBusinessProfileId(linkId, profileId);
    verify(clicks, times(1)).countClicksByCreative(linkId);
    verify(clicks, times(1)).findByLinkIdOrderByClickedAtDesc(linkId);
    verifyNoInteractions(redemptions);
  }

  @Test
  void unauthorizedLookupShortCircuits() {
    UUID profileId = UUID.randomUUID();
    UUID linkId = UUID.randomUUID();

    when(links.findByLinkIdAndBusinessProfileId(linkId, profileId)).thenReturn(Optional.empty());

    assertThatThrownBy(() -> queryService.performance(profileId, linkId))
        .isInstanceOf(ResponseStatusException.class)
        .hasMessageContaining("Attribution link not found");

    verify(links, times(1)).findByLinkIdAndBusinessProfileId(linkId, profileId);
    verifyNoInteractions(clicks, redemptions);
  }
}
