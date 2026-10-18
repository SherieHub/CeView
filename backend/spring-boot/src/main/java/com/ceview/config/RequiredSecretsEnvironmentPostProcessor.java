package com.ceview.config;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.env.EnvironmentPostProcessor;
import org.springframework.core.Ordered;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.Profiles;

import java.util.ArrayList;
import java.util.List;

/**
 * Refuses to start the app outside the local {@code h2} profile when the JWT
 * signing secret or the attribution IP-hash salt is missing, blank, or still
 * the development value published in this repository (issue #51).
 *
 * <p>The dev values live only in {@code application-h2.yml}, so local H2 runs
 * need no setup. Every other configuration — the Postgres default, Docker
 * Compose, Render — must supply its own values; without this check a missing
 * variable would silently fall back to a key anyone can read in the repo.
 *
 * <p>An {@link EnvironmentPostProcessor} rather than a bean so it fails before
 * any bean is created: a blank secret would otherwise surface as an unhelpful
 * key-length error from {@code JwtService}. Runs last so the config files and
 * active profiles are already resolved. Messages name the variable only, never
 * its value. Registered in {@code META-INF/spring.factories}.
 */
public class RequiredSecretsEnvironmentPostProcessor implements EnvironmentPostProcessor, Ordered {

    static final String DEV_JWT_SECRET = "dev-secret-change-me-please-32chars-min";
    static final String DEV_IP_HASH_SALT = "dev-attribution-ip-hash-salt";

    private static final String LOCAL_PROFILE = "h2";

    @Override
    public void postProcessEnvironment(ConfigurableEnvironment environment, SpringApplication application) {
        List<String> emailProblems = emailProblems(
                environment.getProperty("ceview.email.provider"),
                environment.getProperty("ceview.email.resend.api-key"),
                environment.getProperty("ceview.email.from"),
                environment.getProperty("ceview.test-support.enabled", Boolean.class, false));
        if (!emailProblems.isEmpty()) {
            throw new IllegalStateException("Refusing to start: " + String.join(" ", emailProblems));
        }
        if (environment.acceptsProfiles(Profiles.of(LOCAL_PROFILE))) {
            return;
        }
        List<String> problems = new ArrayList<>();
        check(environment.getProperty("ceview.jwt.secret"), DEV_JWT_SECRET, "JWT_SECRET", problems);
        check(environment.getProperty("ceview.attribution.ip-hash-salt"), DEV_IP_HASH_SALT,
                "CEVIEW_ATTRIBUTION_IP_HASH_SALT", problems);
        if (!problems.isEmpty()) {
            throw new IllegalStateException(
                    "Refusing to start: " + String.join(" ", problems)
                    + " Development defaults are only allowed with the '" + LOCAL_PROFILE + "' profile.");
        }
    }

    /**
     * Email-provider consistency, checked in every profile (including h2): choosing the real
     * provider requires its credentials, and the e2e code-reading hook must never be enabled
     * alongside it. Messages name the variable only, never its value.
     */
    static List<String> emailProblems(String provider, String apiKey, String from, boolean testSupport) {
        List<String> problems = new ArrayList<>();
        if ("resend".equalsIgnoreCase(provider == null ? "" : provider.trim())) {
            if (apiKey == null || apiKey.isBlank()) {
                problems.add("RESEND_API_KEY must be set when EMAIL_PROVIDER=resend.");
            }
            if (from == null || from.isBlank()) {
                problems.add("EMAIL_FROM must be set when EMAIL_PROVIDER=resend.");
            }
            if (testSupport) {
                problems.add("CEVIEW_TEST_SUPPORT_ENABLED must not be true when EMAIL_PROVIDER=resend.");
            }
        }
        return problems;
    }

    private static void check(String value, String devDefault, String variable, List<String> problems) {
        if (value == null || value.isBlank() || value.trim().equals(devDefault)) {
            problems.add(variable + " must be set to a non-default value.");
        }
    }

    @Override
    public int getOrder() {
        return Ordered.LOWEST_PRECEDENCE;
    }
}
