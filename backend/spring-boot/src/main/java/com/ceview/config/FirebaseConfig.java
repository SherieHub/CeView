package com.ceview.config;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.auth.FirebaseAuth;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Conditional;
import org.springframework.context.annotation.Configuration;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;

/**
 * Initializes the Firebase Admin SDK for verifying Google Sign-In ID tokens
 * (see AuthController#google). Firebase is used purely as the OAuth identity/token
 * verification layer here — Postgres/tbl_msme_operator remains the system of record,
 * no Firestore or Firebase-side user data is involved.
 *
 * <p>Both beans are conditional on {@code ceview.firebase.credentials-json} being set,
 * so environments that don't need Google sign-in (local dev without it configured, CI,
 * the existing test suite) still start up cleanly with no Firebase beans present.
 * {@code AuthController} takes {@code Optional<FirebaseAuth>} accordingly and returns
 * 503 if Google sign-in is attempted while unconfigured.
 */
@Configuration
public class FirebaseConfig {

    @Bean
    @Conditional(FirebaseConfiguredCondition.class)
    public FirebaseApp firebaseApp(@Value("${ceview.firebase.credentials-json}") String credentialsJson) throws IOException {
        GoogleCredentials credentials = GoogleCredentials.fromStream(
            new ByteArrayInputStream(credentialsJson.getBytes(StandardCharsets.UTF_8)));
        FirebaseOptions options = FirebaseOptions.builder()
            .setCredentials(credentials)
            .build();
        return FirebaseApp.getApps().isEmpty() ? FirebaseApp.initializeApp(options) : FirebaseApp.getInstance();
    }

    @Bean
    @Conditional(FirebaseConfiguredCondition.class)
    public FirebaseAuth firebaseAuth(FirebaseApp firebaseApp) {
        return FirebaseAuth.getInstance(firebaseApp);
    }
}
