package com.ceview.testsupport;

import com.ceview.auth.EmailCode;
import com.ceview.auth.EmailCodeRepository;
import com.ceview.auth.MsmeOperator;
import com.ceview.auth.MsmeOperatorRepository;
import com.ceview.module1.businessinput.BusinessProfile;
import com.ceview.module1.businessinput.BusinessProfileRepository;
import com.ceview.module2.submodule21.MarketSignalRecordRepository;
import com.ceview.module2.submodule22.DemandAlert;
import com.ceview.module2.submodule22.DemandAlertRepository;
import com.ceview.module2.submodule22.ForecastResult;
import com.ceview.module2.submodule22.ForecastResultRepository;
import com.ceview.module2.submodule22.MarketScore;
import com.ceview.module2.submodule22.MarketScoreRepository;
import com.ceview.module3.social.publish.SocialPost;
import com.ceview.module3.social.publish.SocialPostRepository;
import com.ceview.module4.attribution.AttributionCode;
import com.ceview.module4.attribution.AttributionCodeService;
import com.ceview.module4.attribution.link.AttributionLink;
import com.ceview.module4.attribution.link.AttributionLinkService;
import com.ceview.module4.postmetrics.PostMetric;
import com.ceview.module4.postmetrics.PostMetricRepository;
import com.ceview.testsupport.TestSupportSeedService.DemandWindowRequest;
import com.ceview.testsupport.TestSupportSeedService.PostMetricsRequest;
import com.ceview.testsupport.TestSupportSeedService.SeedException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class TestSupportSeedServiceTest {

    private final MsmeOperatorRepository operators = mock(MsmeOperatorRepository.class);
    private final BusinessProfileRepository profiles = mock(BusinessProfileRepository.class);
    private final ForecastResultRepository forecasts = mock(ForecastResultRepository.class);
    private final MarketScoreRepository scores = mock(MarketScoreRepository.class);
    private final MarketSignalRecordRepository signals = mock(MarketSignalRecordRepository.class);
    private final DemandAlertRepository alerts = mock(DemandAlertRepository.class);
    private final AttributionCodeService codes = mock(AttributionCodeService.class);
    private final AttributionLinkService links = mock(AttributionLinkService.class);
    private final SocialPostRepository posts = mock(SocialPostRepository.class);
    private final PostMetricRepository metrics = mock(PostMetricRepository.class);
    private final EmailCodeRepository emailCodes = mock(EmailCodeRepository.class);

    private final TestSupportSeedService service = new TestSupportSeedService(operators, profiles, forecasts,
            scores, signals, alerts, codes, links, posts, metrics, emailCodes, new ObjectMapper());

    private final UUID operatorId = UUID.randomUUID();
    private final UUID profileId = UUID.randomUUID();
    private final List<MarketScore> savedScores = new ArrayList<>();

    @BeforeEach
    void setUp() {
        MsmeOperator op = new MsmeOperator();
        op.setOperatorId(operatorId);
        op.setEmail("e2e@ceview.local");
        when(operators.findByEmail("e2e@ceview.local")).thenReturn(Optional.of(op));

        BusinessProfile profile = mock(BusinessProfile.class);
        when(profile.getBusinessProfileId()).thenReturn(profileId);
        when(profile.categoriesList()).thenReturn(List.of("Coastal & Island"));
        when(profiles.findFirstByUserId(operatorId)).thenReturn(Optional.of(profile));

        when(signals.findByBusinessProfileIdAndCategoryAndTargetMarketAndIsoYearAndIsoWeek(
                any(), anyString(), anyString(), any(), any())).thenReturn(Optional.empty());
        when(forecasts.save(any())).thenAnswer(inv -> {
            ForecastResult fr = inv.getArgument(0);
            fr.setForecastResultId(UUID.randomUUID());
            return fr;
        });
        when(scores.save(any())).thenAnswer(inv -> {
            MarketScore ms = inv.getArgument(0);
            ms.setMarketScoreId(UUID.randomUUID());
            savedScores.add(ms);
            return ms;
        });
        when(alerts.save(any())).thenAnswer(inv -> {
            DemandAlert a = inv.getArgument(0);
            a.setDemandAlertId(UUID.randomUUID());
            return a;
        });

        AttributionCode code = new AttributionCode();
        code.setAttributionCodeId(UUID.randomUUID());
        code.setCode("CV-KR-TEST");
        when(codes.mintForWindow(any(), any(), any(), any(), any())).thenReturn(code);
        AttributionLink link = new AttributionLink();
        link.setLinkId(UUID.randomUUID());
        link.setSlug("abc123");
        when(links.mintForWindow(any(), any(), any(), any(), any())).thenReturn(link);
    }

    @Test
    void seedsEveryMarketRanksTheAlertMarketFirstAndMintsItsCodeAndLink() {
        OffsetDateTime start = OffsetDateTime.of(2026, 11, 2, 0, 0, 0, 0, ZoneOffset.UTC);

        var result = service.seedDemandWindow(new DemandWindowRequest(
                "e2e@ceview.local", "Coastal & Island", "korea", "CRITICAL", 42.0, start, null, 1.2));

        assertEquals(3, savedScores.size());
        MarketScore top = savedScores.stream().filter(s -> s.getMarketRank() == 1).findFirst().orElseThrow();
        assertEquals(result.marketScoreId(), top.getMarketScoreId());
        assertTrue(savedScores.stream().allMatch(s -> s == top || s.getMarketScore() < top.getMarketScore()));

        ArgumentCaptor<DemandAlert> alert = ArgumentCaptor.forClass(DemandAlert.class);
        verify(alerts).save(alert.capture());
        assertEquals("CRITICAL", alert.getValue().getAlertLevel());
        assertEquals(42.0, alert.getValue().getUpliftPct());
        assertEquals(start, alert.getValue().getWindowOpenDate());
        assertEquals(profileId, alert.getValue().getBusinessProfileId());

        verify(codes).mintForWindow(eq(profileId), eq("Coastal & Island"), eq("korea"), eq(start), any());
        verify(links).mintForWindow(eq(profileId), eq("Coastal & Island"), eq("korea"), eq(start), any());
        assertEquals("CV-KR-TEST", result.code());
        assertEquals("abc123", result.slug());
        verify(signals, atLeastOnce()).save(any());
    }

    @Test
    void staleDaysAgesOnlyTheNewestSignalAndLeavesTheForecastFresh() {
        service.seedDemandWindow(new DemandWindowRequest(
                "e2e@ceview.local", "Coastal & Island", "japan", null, null, null, 10, null));

        ArgumentCaptor<ForecastResult> fr = ArgumentCaptor.forClass(ForecastResult.class);
        verify(forecasts, atLeastOnce()).save(fr.capture());
        assertTrue(fr.getAllValues().stream().allMatch(
                f -> f.getGeneratedAt().isAfter(OffsetDateTime.now(ZoneOffset.UTC).minusMinutes(5))));

        ArgumentCaptor<com.ceview.module2.submodule21.MarketSignalRecord> sig =
                ArgumentCaptor.forClass(com.ceview.module2.submodule21.MarketSignalRecord.class);
        verify(signals, atLeastOnce()).save(sig.capture());
        OffsetDateTime newest = sig.getAllValues().stream()
                .map(com.ceview.module2.submodule21.MarketSignalRecord::getAggregatedAt)
                .max(OffsetDateTime::compareTo).orElseThrow();
        assertTrue(newest.isBefore(OffsetDateTime.now(ZoneOffset.UTC).minusDays(9)));
    }

    @Test
    void withoutStaleDaysTheNewestSignalIsFresh() {
        service.seedDemandWindow(new DemandWindowRequest(
                "e2e@ceview.local", "Coastal & Island", "japan", null, null, null, null, null));

        ArgumentCaptor<com.ceview.module2.submodule21.MarketSignalRecord> sig =
                ArgumentCaptor.forClass(com.ceview.module2.submodule21.MarketSignalRecord.class);
        verify(signals, atLeastOnce()).save(sig.capture());
        OffsetDateTime newest = sig.getAllValues().stream()
                .map(com.ceview.module2.submodule21.MarketSignalRecord::getAggregatedAt)
                .max(OffsetDateTime::compareTo).orElseThrow();
        assertTrue(newest.isAfter(OffsetDateTime.now(ZoneOffset.UTC).minusHours(1)));
    }

    @Test
    void rejectsACategoryTheProfileDoesNotHave() {
        SeedException e = assertThrows(SeedException.class, () -> service.seedDemandWindow(
                new DemandWindowRequest("e2e@ceview.local", "Urban & City", "korea", null, null, null, null, null)));
        assertEquals(400, e.status);
    }

    @Test
    void rejectsAnUnknownMarketAndLevel() {
        assertEquals(400, assertThrows(SeedException.class, () -> service.seedDemandWindow(
                new DemandWindowRequest("e2e@ceview.local", "Coastal & Island", "mars", null, null, null, null, null)))
                .status);
        assertEquals(400, assertThrows(SeedException.class, () -> service.seedDemandWindow(
                new DemandWindowRequest("e2e@ceview.local", "Coastal & Island", "korea", "LOW", null, null, null, null)))
                .status);
    }

    @Test
    void unknownEmailIs404() {
        assertEquals(404, assertThrows(SeedException.class, () -> service.seedDemandWindow(
                new DemandWindowRequest("nobody@ceview.local", "Coastal & Island", "korea", null, null, null, null, null)))
                .status);
    }

    @Test
    void seedsABusinessProfileForTheOperatorWithoutAnyAiCall() {
        when(profiles.findFirstByUserId(operatorId)).thenReturn(Optional.empty());
        when(profiles.save(any())).thenAnswer(inv -> inv.getArgument(0));

        BusinessProfile saved = service.seedBusinessProfile(new TestSupportSeedService.BusinessProfileRequest(
                "e2e@ceview.local", "Reef Co", List.of("Coastal & Island"), List.of("Dives"),
                "desc", "uvp", null, 0.62f));

        assertEquals(operatorId, saved.getUserId());
        assertEquals("Reef Co", saved.getBusinessName());
        assertEquals(List.of("Coastal & Island"), saved.categoriesList());
        assertEquals(List.of("Dives"), saved.coreServicesList());
        assertEquals(0.62f, saved.getUniquenessScore());
    }

    @Test
    void seedingAProfileTwiceUpdatesTheSameRow() {
        BusinessProfile existing = new BusinessProfile();
        existing.setBusinessProfileId(profileId);
        when(profiles.findFirstByUserId(operatorId)).thenReturn(Optional.of(existing));
        when(profiles.save(any())).thenAnswer(inv -> inv.getArgument(0));

        BusinessProfile saved = service.seedBusinessProfile(new TestSupportSeedService.BusinessProfileRequest(
                "e2e@ceview.local", "Renamed", List.of(), null, null, null, null, null));

        assertEquals(profileId, saved.getBusinessProfileId());
        assertEquals("Renamed", saved.getBusinessName());
    }

    @Test
    void postMetricsUseTheSyncJobsEngagementFormula() {
        UUID postId = UUID.randomUUID();
        SocialPost post = new SocialPost();
        post.setId(postId);
        post.setBusinessProfileId(profileId);
        when(posts.findById(postId)).thenReturn(Optional.of(post));
        when(metrics.findByPostIdAndBusinessProfileId(postId, profileId)).thenReturn(Optional.empty());
        when(metrics.save(any())).thenAnswer(inv -> inv.getArgument(0));

        PostMetric row = service.seedPostMetrics(new PostMetricsRequest(postId, 1000L, 50L, 30L, 20L,
                List.of(100L, 300L, 1000L)));

        assertEquals(10.0, row.getEngagementRate());
        assertEquals("[100,300,1000]", row.getReachSeriesJson());
        assertEquals(profileId, row.getBusinessProfileId());
    }

    @Test
    void postMetricsForAnUnknownPostIs404() {
        when(posts.findById(any())).thenReturn(Optional.empty());
        assertEquals(404, assertThrows(SeedException.class, () -> service.seedPostMetrics(
                new PostMetricsRequest(UUID.randomUUID(), 1L, 1L, 1L, 1L, null))).status);
    }

    @Test
    void expireMovesOpenCodesIntoThePast() {
        EmailCode code = new EmailCode();
        code.setExpiresAt(OffsetDateTime.now(ZoneOffset.UTC).plusMinutes(10));
        when(emailCodes.findByOperatorIdAndConsumedAtIsNull(operatorId)).thenReturn(List.of(code));

        assertEquals(1, service.expireEmailCodes("e2e@ceview.local"));
        assertTrue(code.getExpiresAt().isBefore(OffsetDateTime.now(ZoneOffset.UTC)));
    }
}
