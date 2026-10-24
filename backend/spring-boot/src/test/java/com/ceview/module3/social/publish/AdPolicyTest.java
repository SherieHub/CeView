package com.ceview.module3.social.publish;

import com.ceview.common.crypto.TokenCipher;
import com.ceview.module3.social.publish.PublishingDtos.AdInterest;
import com.ceview.module3.social.publish.PublishingDtos.AdOptions;
import com.ceview.module4.adconnections.AdPlatformConnection;
import com.ceview.module4.adconnections.AdSpendLimit;
import com.ceview.module4.adconnections.AdSpendLimitRepository;
import com.ceview.module4.adconnections.client.AdPlatformException;
import com.ceview.module4.adconnections.client.MetaTargetingClient;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AdPolicyTest {
    final UUID profile = UUID.randomUUID();
    final AdSpendLimitRepository limits = mock(AdSpendLimitRepository.class);
    final SocialPostRepository posts = mock(SocialPostRepository.class);
    final MetaTargetingClient meta = mock(MetaTargetingClient.class);
    final TokenCipher cipher = mock(TokenCipher.class);
    AdPolicy policy;
    AdPlatformConnection connection;

    @BeforeEach void setup() {
        policy = new AdPolicy(limits, posts, meta, cipher, new ObjectMapper());
        connection = new AdPlatformConnection();
        connection.setExternalAccountId("act_123"); connection.setCurrency("PHP"); connection.setAccessTokenEncrypted("enc");
        when(cipher.decrypt("enc")).thenReturn("tok");
        AdSpendLimit limit = new AdSpendLimit();
        limit.setBusinessProfileId(profile); limit.setCurrency("PHP"); limit.setMaxDailyMinor(50_000); limit.setMaxTotalMinor(1_000_000);
        when(limits.findById(profile)).thenReturn(Optional.of(limit));
        when(posts.findActiveAds(eq(profile), any())).thenReturn(List.of());
        when(meta.minimumDailyBudget(eq("tok"), eq("act_123"), anyString())).thenReturn(Optional.of(new MetaTargetingClient.MinimumBudget("PHP", 6332)));
        when(meta.invalidInterestIds(eq("tok"), anyList())).thenReturn(Set.of());
        when(meta.localeKey("tok", "Korean")).thenReturn(Optional.of("26"));
    }

    AdOptions ad(long daily, int days, List<AdInterest> interests) {
        return new AdOptions("OUTCOME_TRAFFIC", daily, OffsetDateTime.now().plusHours(2), days, interests, false, UUID.randomUUID(), false);
    }
    AdOptions ad() { return ad(10_000, 14, List.of(new AdInterest("6003020834693", "Scuba diving"))); }
    ResponseStatusException rejected(AdOptions ad, String market) {
        return (ResponseStatusException) catchThrowable(() -> policy.plan(profile, connection, ad, market));
    }
    static Throwable catchThrowable(Runnable run) {
        try { run.run(); } catch (Throwable t) { return t; }
        return null;
    }
    void expect(AdOptions ad, String market, int status, String text) {
        ResponseStatusException e = rejected(ad, market);
        assertThat(e).as("expected a %d containing '%s'", status, text).isNotNull();
        assertThat(e.getStatusCode().value()).isEqualTo(status);
        assertThat(e.getReason()).contains(text);
    }

    @Test void derivesCountryLanguageInterestsAndEndFromTheForecastMarket() {
        AdOptions ad = ad();

        AdPolicy.AdPlan plan = policy.plan(profile, connection, ad, "Korea");

        assertThat(plan.countries()).isEqualTo("KR");
        assertThat(plan.locales()).isEqualTo("26");
        assertThat(plan.interestsJson()).isEqualTo("[{\"id\":\"6003020834693\",\"name\":\"Scuba diving\"}]");
        assertThat(plan.endTime()).isEqualTo(ad.startTime().plusDays(14));
    }

    @Test void theUsaMarketHasNoLanguageLimitAndNeverLooksOneUp() {
        AdPolicy.AdPlan plan = policy.plan(profile, connection, ad(), "usa");

        assertThat(plan.countries()).isEqualTo("US");
        assertThat(plan.locales()).isNull();
        verify(meta, never()).localeKey(anyString(), anyString());
    }

    @Test void noInterestsGivesNullInterestsAndSkipsMetasInterestCheck() {
        AdPolicy.AdPlan plan = policy.plan(profile, connection, ad(10_000, 14, List.of()), "korea");

        assertThat(plan.interestsJson()).isNull();
        verify(meta, never()).invalidInterestIds(anyString(), anyList());
    }

    @Test void rejectsAnObjectiveOutsideTheOfferedThree() {
        AdOptions bad = new AdOptions("OUTCOME_SALES", 10_000, OffsetDateTime.now().plusHours(2), 14, List.of(), false, UUID.randomUUID(), false);
        expect(bad, "korea", 400, "objective");
    }

    @Test void rejectsAMarketCeViewHasNoForecastFor() {
        expect(ad(), "philippines", 400, "market");
        expect(ad(), null, 400, "market");
    }

    @Test void rejectsAStartThatIsNotInTheFuture() {
        AdOptions past = new AdOptions("OUTCOME_TRAFFIC", 10_000, OffsetDateTime.now().minusMinutes(1), 14, List.of(), false, UUID.randomUUID(), false);
        expect(past, "korea", 400, "start");
    }

    @Test void rejectsLessThanOneDay() {
        expect(ad(10_000, 0, List.of()), "korea", 400, "days");
    }

    @Test void rejectsMoreThanTenInterestsDuplicatesAndNonNumericIds() {
        List<AdInterest> eleven = java.util.stream.IntStream.range(0, 11).mapToObj(i -> new AdInterest("60030" + i, "Interest " + i)).toList();
        expect(ad(10_000, 14, eleven), "korea", 400, "10 interests");
        expect(ad(10_000, 14, List.of(new AdInterest("1", "A"), new AdInterest("1", "B"))), "korea", 400, "once");
        expect(ad(10_000, 14, List.of(new AdInterest("abc", "A"))), "korea", 400, "interest");
    }

    @Test void blocksPaidAdsUntilSpendLimitsAreSaved() {
        when(limits.findById(profile)).thenReturn(Optional.empty());
        expect(ad(), "korea", 409, "spending limits");
    }

    @Test void limitsSavedInAnotherCurrencyCountAsNotSet() {
        connection.setCurrency("USD");
        expect(ad(), "korea", 409, "spending limits");
    }

    @Test void rejectsADailyBudgetAboveTheDailyLimit() {
        expect(ad(50_001, 1, List.of()), "korea", 400, "daily limit");
        assertThat(policy.plan(profile, connection, ad(50_000, 1, List.of()), "korea")).isNotNull();
    }

    @Test void rejectsATotalAboveTheTotalLimit() {
        // 20,000 a day for 51 days = 1,020,000 > 1,000,000
        expect(ad(20_000, 51, List.of()), "korea", 400, "total limit");
        assertThat(policy.plan(profile, connection, ad(20_000, 50, List.of()), "korea")).isNotNull();
    }

    @Test void totalLimitCountsAdsAlreadyRunningOrScheduled() {
        SocialPost running = new SocialPost();
        running.setAdDailyBudgetMinor(10_000L);
        running.setAdStartTime(OffsetDateTime.now().minusDays(1)); running.setAdEndTime(OffsetDateTime.now().plusDays(9));
        when(posts.findActiveAds(eq(profile), any())).thenReturn(List.of(running)); // 10 days * 10,000 = 100,000 committed

        // 900,000 remains: 18,000 x 50 days = 900,000 fits, one more day does not.
        assertThat(policy.plan(profile, connection, ad(18_000, 50, List.of()), "korea")).isNotNull();
        expect(ad(18_000, 51, List.of()), "korea", 400, "total limit");
    }

    @Test void aHugeDurationIsRefusedByTheTotalLimitNotAnArithmeticOverflow() {
        expect(ad(10_000, Integer.MAX_VALUE, List.of()), "korea", 400, "total limit");
    }

    @Test void rejectsABudgetAtOrBelowMetasMinimum() {
        expect(ad(6332, 14, List.of()), "korea", 400, "minimum");
        assertThat(policy.plan(profile, connection, ad(6333, 14, List.of()), "korea")).isNotNull();
    }

    @Test void awarenessAsksMetaForTheAwarenessMinimum() {
        AdOptions awareness = new AdOptions("OUTCOME_AWARENESS", 10_000, OffsetDateTime.now().plusHours(2), 14, List.of(), false, UUID.randomUUID(), false);
        policy.plan(profile, connection, awareness, "korea");
        verify(meta).minimumDailyBudget("tok", "act_123", "OUTCOME_AWARENESS");
    }

    @Test void aMinimumLookupFailureDoesNotBlockPublishing() {
        when(meta.minimumDailyBudget(anyString(), anyString(), anyString())).thenThrow(new AdPlatformException("Meta API call failed"));
        assertThat(policy.plan(profile, connection, ad(100, 14, List.of()), "korea")).isNotNull();
    }

    @Test void aMinimumInAnotherCurrencyIsIgnored() {
        when(meta.minimumDailyBudget(anyString(), anyString(), anyString())).thenReturn(Optional.of(new MetaTargetingClient.MinimumBudget("USD", 99_999)));
        assertThat(policy.plan(profile, connection, ad(10_000, 14, List.of()), "korea")).isNotNull();
    }

    @Test void rejectsAnInterestMetaSaysIsNoLongerValid() {
        when(meta.invalidInterestIds(eq("tok"), anyList())).thenReturn(Set.of("6003020834693"));
        expect(ad(), "korea", 400, "Scuba diving");
    }

    @Test void aLanguageLookupFailureStopsAnAdThatWouldSilentlyLoseItsLanguage() {
        when(meta.localeKey("tok", "Korean")).thenThrow(new AdPlatformException("Meta API call failed"));
        expect(ad(), "korea", 502, "language");
        org.mockito.Mockito.doReturn(Optional.empty()).when(meta).localeKey("tok", "Korean");
        expect(ad(), "korea", 502, "language");
    }

    @Test void remembersALocaleKeyInsteadOfAskingMetaEveryTime() {
        policy.plan(profile, connection, ad(), "korea");
        policy.plan(profile, connection, ad(), "korea");
        verify(meta, org.mockito.Mockito.times(1)).localeKey("tok", "Korean");
    }
}
