package com.ceview.module4.attribution.link;

import com.ceview.auth.CurrentBusinessProfile;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/attribution/links")
public class LinkPerformanceController {
  private final CurrentBusinessProfile currentProfile;
  private final LinkAttributionQueryService queries;

  public LinkPerformanceController(
      CurrentBusinessProfile currentProfile, LinkAttributionQueryService queries) {
    this.currentProfile = currentProfile;
    this.queries = queries;
  }

  @GetMapping("/{linkId}/creatives")
  public AttributionLinkDtos.LinkPerformanceResponse performance(@PathVariable UUID linkId) {
    return queries.performance(currentProfile.resolveProfileId(), linkId);
  }
}
