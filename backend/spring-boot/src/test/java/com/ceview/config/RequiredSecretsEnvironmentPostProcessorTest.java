package com.ceview.config;

import org.junit.jupiter.api.Test;
import org.springframework.boot.SpringApplication;
import org.springframework.mock.env.MockEnvironment;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Issue #51 — outside the local h2 profile, the app must refuse to start with a
 * missing, blank or publicly-known JWT secret or attribution IP-hash salt.
 */
class RequiredSecretsEnvironmentPostProcessorTest {

    private static final String JWT_KEY = "ceview.jwt.secret";
    private static final String SALT_KEY = "ceview.attribution.ip-hash-salt";
    private static final String VALID_JWT = "a-real-jwt-secret-that-is-at-least-32-characters";
    private static final String VALID_SALT = "a-real-attribution-salt";

    private final RequiredSecretsEnvironmentPostProcessor processor = new RequiredSecretsEnvironmentPostProcessor();

    private void run(MockEnvironment env) {
        processor.postProcessEnvironment(env, new SpringApplication());
    }

    private static MockEnvironment postgres(String jwt, String salt) {
        MockEnvironment env = new MockEnvironment();
        if (jwt != null) env.setProperty(JWT_KEY, jwt);
        if (salt != null) env.setProperty(SALT_KEY, salt);
        return env;
    }

    @Test
    void h2ProfileNeedsNoSecrets() {
        MockEnvironment env = new MockEnvironment();
        env.setActiveProfiles("h2");
        assertThatCode(() -> run(env)).doesNotThrowAnyException();
    }

    @Test
    void h2ProfileAcceptsTheDevDefaults() {
        MockEnvironment env = postgres(
                RequiredSecretsEnvironmentPostProcessor.DEV_JWT_SECRET,
                RequiredSecretsEnvironmentPostProcessor.DEV_IP_HASH_SALT);
        env.setActiveProfiles("h2");
        assertThatCode(() -> run(env)).doesNotThrowAnyException();
    }

    @Test
    void missingJwtSecretIsRejected() {
        assertThatThrownBy(() -> run(postgres(null, VALID_SALT)))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("JWT_SECRET");
    }

    @Test
    void missingSaltIsRejected() {
        assertThatThrownBy(() -> run(postgres(VALID_JWT, null)))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("CEVIEW_ATTRIBUTION_IP_HASH_SALT");
    }

    @Test
    void devDefaultJwtSecretIsRejected() {
        assertThatThrownBy(() -> run(postgres(RequiredSecretsEnvironmentPostProcessor.DEV_JWT_SECRET, VALID_SALT)))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("JWT_SECRET");
    }

    @Test
    void devDefaultSaltIsRejected() {
        assertThatThrownBy(() -> run(postgres(VALID_JWT, RequiredSecretsEnvironmentPostProcessor.DEV_IP_HASH_SALT)))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("CEVIEW_ATTRIBUTION_IP_HASH_SALT");
    }

    @Test
    void blankJwtSecretIsRejected() {
        assertThatThrownBy(() -> run(postgres("   ", VALID_SALT)))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("JWT_SECRET");
    }

    @Test
    void blankSaltIsRejected() {
        assertThatThrownBy(() -> run(postgres(VALID_JWT, "")))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("CEVIEW_ATTRIBUTION_IP_HASH_SALT");
    }

    @Test
    void bothInvalidAreReportedTogether() {
        assertThatThrownBy(() -> run(postgres(null, null)))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("JWT_SECRET")
                .hasMessageContaining("CEVIEW_ATTRIBUTION_IP_HASH_SALT");
    }

    @Test
    void validNonDefaultValuesAreAccepted() {
        assertThatCode(() -> run(postgres(VALID_JWT, VALID_SALT))).doesNotThrowAnyException();
    }

    // ---- email provider consistency (checked in every profile, h2 included) ----

    private static MockEnvironment withEmail(String provider, String apiKey, String from, String testSupport) {
        MockEnvironment env = postgres(VALID_JWT, VALID_SALT);
        if (provider != null) env.setProperty("ceview.email.provider", provider);
        if (apiKey != null) env.setProperty("ceview.email.resend.api-key", apiKey);
        if (from != null) env.setProperty("ceview.email.from", from);
        if (testSupport != null) env.setProperty("ceview.test-support.enabled", testSupport);
        return env;
    }

    @Test
    void logProviderNeedsNoEmailCredentials() {
        assertThatCode(() -> run(withEmail("log", null, null, null))).doesNotThrowAnyException();
        assertThatCode(() -> run(withEmail(null, null, null, null))).doesNotThrowAnyException();
    }

    @Test
    void resendProviderRequiresTheApiKey() {
        assertThatThrownBy(() -> run(withEmail("resend", "", "CeView <no-reply@example.com>", null)))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("RESEND_API_KEY");
    }

    @Test
    void resendProviderRequiresTheSenderAddress() {
        assertThatThrownBy(() -> run(withEmail("resend", "re_key", null, null)))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("EMAIL_FROM");
    }

    @Test
    void resendProviderWithCredentialsIsAccepted() {
        assertThatCode(() -> run(withEmail("resend", "re_key", "CeView <no-reply@example.com>", "false")))
                .doesNotThrowAnyException();
    }

    @Test
    void theCodeReadingHookCanNeverRunAgainstARealEmailProvider() {
        assertThatThrownBy(() -> run(withEmail("resend", "re_key", "CeView <no-reply@example.com>", "true")))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("CEVIEW_TEST_SUPPORT_ENABLED");
    }

    @Test
    void theCodeReadingHookIsFineWithTheLogProvider() {
        assertThatCode(() -> run(withEmail("log", null, null, "true"))).doesNotThrowAnyException();
    }

    @Test
    void emailGuardAlsoAppliesToTheH2Profile() {
        MockEnvironment env = withEmail("resend", "re_key", "CeView <no-reply@example.com>", "true");
        env.setActiveProfiles("h2");

        assertThatThrownBy(() -> run(env)).isInstanceOf(IllegalStateException.class);
    }

    @Test
    void emailErrorMessageNeverContainsTheApiKey() {
        assertThatThrownBy(() -> run(withEmail("resend", "re_super_secret_key", null, null)))
                .isInstanceOf(IllegalStateException.class)
                .satisfies(e -> org.assertj.core.api.Assertions.assertThat(e.getMessage())
                        .doesNotContain("re_super_secret_key"));
    }

    @Test
    void errorMessageNeverContainsTheRejectedValue() {
        assertThatThrownBy(() -> run(postgres(RequiredSecretsEnvironmentPostProcessor.DEV_JWT_SECRET,
                                              RequiredSecretsEnvironmentPostProcessor.DEV_IP_HASH_SALT)))
                .isInstanceOf(IllegalStateException.class)
                .satisfies(e -> org.assertj.core.api.Assertions.assertThat(e.getMessage())
                        .doesNotContain(RequiredSecretsEnvironmentPostProcessor.DEV_JWT_SECRET)
                        .doesNotContain(RequiredSecretsEnvironmentPostProcessor.DEV_IP_HASH_SALT));
    }
}
