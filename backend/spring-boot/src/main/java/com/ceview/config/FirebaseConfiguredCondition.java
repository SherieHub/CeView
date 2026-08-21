package com.ceview.config;

import org.springframework.context.annotation.Condition;
import org.springframework.context.annotation.ConditionContext;
import org.springframework.core.type.AnnotatedTypeMetadata;
import org.springframework.lang.NonNull;

/**
 * Matches only when {@code ceview.firebase.credentials-json} is actually set to something.
 *
 * <p>{@code @ConditionalOnProperty} alone isn't enough here: {@code application.yml} gives the
 * property an empty-string default (${FIREBASE_CREDENTIALS_JSON:}) so environments without
 * Google sign-in configured don't fail placeholder resolution at startup — but that means the
 * property always exists in the Environment, just blank, which {@code @ConditionalOnProperty}'s
 * "is it present" check treats as satisfied. This condition checks the value itself instead, so
 * the Firebase beans (see {@link FirebaseConfig}) are only registered when a real credential is
 * present, and every environment without one (local dev, CI, tests) starts up cleanly with no
 * Firebase beans and {@code AuthController}'s {@code Optional<FirebaseAuth>} empty.
 */
public class FirebaseConfiguredCondition implements Condition {

    @Override
    public boolean matches(@NonNull ConditionContext context, @NonNull AnnotatedTypeMetadata metadata) {
        String value = context.getEnvironment().getProperty("ceview.firebase.credentials-json", "");
        return value != null && !value.isBlank();
    }
}
