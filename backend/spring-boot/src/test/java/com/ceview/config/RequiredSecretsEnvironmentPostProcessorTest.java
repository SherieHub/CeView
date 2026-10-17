package com.ceview.config;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;
import org.springframework.boot.SpringApplication;
import org.springframework.mock.env.MockEnvironment;

/**
 * Issue #51 — outside the local h2 profile, the app must refuse to start with a missing, blank or
 * publicly-known JWT secret or attribution IP-hash salt.
 */
class RequiredSecretsEnvironmentPostProcessorTest {

  private static final String JWT_KEY = "ceview.jwt.secret";
  private static final String SALT_KEY = "ceview.attribution.ip-hash-salt";
  private static final String VALID_JWT = "a-real-jwt-secret-that-is-at-least-32-characters";
  private static final String VALID_SALT = "a-real-attribution-salt";

  private final RequiredSecretsEnvironmentPostProcessor processor =
      new RequiredSecretsEnvironmentPostProcessor();

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
    MockEnvironment env =
        postgres(
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
    assertThatThrownBy(
            () -> run(postgres(RequiredSecretsEnvironmentPostProcessor.DEV_JWT_SECRET, VALID_SALT)))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("JWT_SECRET");
  }

  @Test
  void devDefaultSaltIsRejected() {
    assertThatThrownBy(
            () ->
                run(postgres(VALID_JWT, RequiredSecretsEnvironmentPostProcessor.DEV_IP_HASH_SALT)))
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

  @Test
  void errorMessageNeverContainsTheRejectedValue() {
    assertThatThrownBy(
            () ->
                run(
                    postgres(
                        RequiredSecretsEnvironmentPostProcessor.DEV_JWT_SECRET,
                        RequiredSecretsEnvironmentPostProcessor.DEV_IP_HASH_SALT)))
        .isInstanceOf(IllegalStateException.class)
        .satisfies(
            e ->
                org.assertj.core.api.Assertions.assertThat(e.getMessage())
                    .doesNotContain(RequiredSecretsEnvironmentPostProcessor.DEV_JWT_SECRET)
                    .doesNotContain(RequiredSecretsEnvironmentPostProcessor.DEV_IP_HASH_SALT));
  }
}
