package com.ceview.module4.adconnections;

import com.ceview.auth.JwtService;
import com.ceview.module1.businessinput.BusinessProfile;
import com.ceview.module1.businessinput.BusinessProfileRepository;
import com.ceview.module4.adconnections.AdConnectionDtos.InsightsResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
class AdInsightsEndpointTest {

    @Autowired private MockMvc mvc;
    @Autowired private JwtService jwtService;
    @Autowired private BusinessProfileRepository profileRepo;
    @Autowired private com.ceview.testsupport.TestOperators testOperators;

    @MockBean private AdInsightSyncService syncService;

    private String token;
    private UUID profileId;

    @BeforeEach
    void setUp() {
        profileRepo.deleteAll();
        UUID operatorId = UUID.randomUUID();
        testOperators.create(operatorId);
        token = jwtService.issue(operatorId, "operator@example.com");

        BusinessProfile profile = new BusinessProfile();
        profile.setUserId(operatorId);
        profile.setBusinessName("Cebu Dive Co.");
        profileId = profileRepo.save(profile).getBusinessProfileId();
    }

    @Test
    void returnsTheSyncResultForTheRequestedPeriod() throws Exception {
        when(syncService.sync(eq(profileId),
                eq(LocalDate.of(2026, 8, 31)), eq(LocalDate.of(2026, 9, 6)), any()))
            .thenReturn(new InsightsResponse("2026-08-31", "2026-09-06",
                    48210L, 1327L, new BigDecimal("4820.55"), 45L, "PHP",
                    List.of(), List.of()));

        mvc.perform(get("/api/ad-connections/insights")
                        .param("periodStart", "2026-08-31")
                        .param("periodEnd", "2026-09-06")
                        .header("Authorization", "Bearer " + token))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.impressions").value(48210))
           .andExpect(jsonPath("$.clicks").value(1327))
           .andExpect(jsonPath("$.currency").value("PHP"));
    }

    @Test
    void scopesTheSyncToTheAuthenticatedOperator() throws Exception {
        when(syncService.sync(eq(profileId), any(), any(), any()))
            .thenReturn(new InsightsResponse("2026-08-31", "2026-09-06",
                    null, null, null, null, null, List.of(), List.of()));

        mvc.perform(get("/api/ad-connections/insights")
                        .param("periodStart", "2026-08-31")
                        .param("periodEnd", "2026-09-06")
                        .header("Authorization", "Bearer " + token))
           .andExpect(status().isOk());

        // No providers param -> the filter is null (sync everything).
        verify(syncService).sync(eq(profileId),
                eq(LocalDate.of(2026, 8, 31)), eq(LocalDate.of(2026, 9, 6)), isNull());
    }

    @Test
    void passesAProviderFilterThroughWhenGiven() throws Exception {
        when(syncService.sync(eq(profileId), any(), any(), any()))
            .thenReturn(new InsightsResponse("2026-08-31", "2026-09-06",
                    null, null, null, null, null, List.of(), List.of()));

        mvc.perform(get("/api/ad-connections/insights")
                        .param("periodStart", "2026-08-31")
                        .param("periodEnd", "2026-09-06")
                        .param("providers", "tiktok")
                        .header("Authorization", "Bearer " + token))
           .andExpect(status().isOk());

        verify(syncService).sync(eq(profileId), any(), any(),
                eq(java.util.Set.of(AdProvider.TIKTOK)));
    }

    @Test
    void rejectsAnUnknownProviderInTheFilter() throws Exception {
        mvc.perform(get("/api/ad-connections/insights")
                        .param("periodStart", "2026-08-31")
                        .param("periodEnd", "2026-09-06")
                        .param("providers", "naver")
                        .header("Authorization", "Bearer " + token))
           .andExpect(status().isBadRequest());
    }

    @Test
    void rejectsAnInvertedDateRange() throws Exception {
        mvc.perform(get("/api/ad-connections/insights")
                        .param("periodStart", "2026-09-06")
                        .param("periodEnd", "2026-08-31")
                        .header("Authorization", "Bearer " + token))
           .andExpect(status().isBadRequest());
    }

    @Test
    void rejectsARangeOverThreeHundredSixtySixDays() throws Exception {
        mvc.perform(get("/api/ad-connections/insights")
                        .param("periodStart", "2020-01-01")
                        .param("periodEnd", "2026-09-06")
                        .header("Authorization", "Bearer " + token))
           .andExpect(status().isBadRequest());
    }

    @Test
    void acceptsASingleDayRange() throws Exception {
        when(syncService.sync(eq(profileId), eq(LocalDate.of(2026, 9, 6)),
                eq(LocalDate.of(2026, 9, 6)), any()))
            .thenReturn(new InsightsResponse("2026-09-06", "2026-09-06",
                    null, null, null, null, null, List.of(), List.of()));

        mvc.perform(get("/api/ad-connections/insights")
                        .param("periodStart", "2026-09-06")
                        .param("periodEnd", "2026-09-06")
                        .header("Authorization", "Bearer " + token))
           .andExpect(status().isOk());
    }

    @Test
    void requiresAuthentication() throws Exception {
        mvc.perform(get("/api/ad-connections/insights")
                        .param("periodStart", "2026-08-31")
                        .param("periodEnd", "2026-09-06"))
           .andExpect(status().isUnauthorized());
    }
}
