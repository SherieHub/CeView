package com.ceview.module4.attribution.link;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.ceview.auth.JwtService;
import com.ceview.module1.businessinput.BusinessProfile;
import com.ceview.module1.businessinput.BusinessProfileRepository;
import com.ceview.testsupport.TestOperators;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class LinkPerformanceControllerTest {
  @Autowired MockMvc mvc;
  @Autowired JwtService jwtService;
  @Autowired TestOperators operators;
  @Autowired BusinessProfileRepository profiles;
  @Autowired AttributionLinkRepository links;
  @Autowired AttributionClickRepository clicks;

  private String token;
  private UUID ownLinkId;
  private UUID foreignLinkId;

  @BeforeEach
  void setUp() {
    UUID operatorId = operators.create(UUID.randomUUID());
    token = jwtService.issue(operatorId, "performance@example.com");
    BusinessProfile profile = new BusinessProfile();
    profile.setUserId(operatorId);
    profile.setBusinessName("Performance test business");
    UUID profileId = profiles.save(profile).getBusinessProfileId();
    ownLinkId = link(profileId).getLinkId();
    foreignLinkId = link(UUID.randomUUID()).getLinkId();
    AttributionClick click = new AttributionClick();
    click.setBusinessProfileId(profileId);
    click.setLinkId(ownLinkId);
    click.setExternalAdId("ad-A");
    clicks.save(click);
  }

  @Test
  void authenticatedOwnerReceivesWireShapeFromRealQueryService() throws Exception {
    mvc.perform(get(path(ownLinkId)).header("Authorization", "Bearer " + token))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.linkId").value(ownLinkId.toString()))
        .andExpect(jsonPath("$.slug").isString())
        .andExpect(jsonPath("$.totalClicks").value(1))
        .andExpect(jsonPath("$.totalConversions").value(0))
        .andExpect(jsonPath("$.totalRevenue").value(0))
        .andExpect(jsonPath("$.creatives[0].externalAdId").value("ad-A"))
        .andExpect(jsonPath("$.creatives[0].adLabel").value("Ad ad-A"))
        .andExpect(jsonPath("$.creatives[0].untagged").value(false))
        .andExpect(jsonPath("$.creatives[0].clicks").value(1))
        .andExpect(jsonPath("$.creatives[0].conversions").value(0))
        .andExpect(jsonPath("$.creatives[0].revenue").value(0));
  }

  @Test
  void foreignLinkIsNotFound() throws Exception {
    mvc.perform(get(path(foreignLinkId)).header("Authorization", "Bearer " + token))
        .andExpect(status().isNotFound());
  }

  @Test
  void missingLinkIsNotFound() throws Exception {
    mvc.perform(get(path(UUID.randomUUID())).header("Authorization", "Bearer " + token))
        .andExpect(status().isNotFound());
  }

  @Test
  void anonymousRequestIsUnauthorized() throws Exception {
    mvc.perform(get(path(ownLinkId))).andExpect(status().isUnauthorized());
  }

  @Test
  void malformedLinkIdIsBadRequest() throws Exception {
    mvc.perform(
            get("/api/attribution/links/not-a-uuid/creatives")
                .header("Authorization", "Bearer " + token))
        .andExpect(status().isBadRequest());
  }

  private AttributionLink link(UUID profileId) {
    AttributionLink link = new AttributionLink();
    link.setBusinessProfileId(profileId);
    link.setCategory("Diving");
    link.setTargetMarket("Korea");
    link.setSlug(UUID.randomUUID().toString().replace("-", ""));
    link.setWindowStart(OffsetDateTime.now());
    link.setWindowEnd(OffsetDateTime.now().plusDays(7));
    return links.save(link);
  }

  private String path(UUID linkId) {
    return "/api/attribution/links/" + linkId + "/creatives";
  }
}
