package com.ceview.module4.adconnections;

import com.ceview.common.crypto.TokenCipher;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Wiring for the ad-connection feature.
 *
 * <p>The {@link TokenCipher} bean is always registered, but a blank key produces
 * a cipher that throws on first use rather than at startup — the same
 * degrade-gracefully posture as {@code FirebaseConfig}: an environment with no
 * ad credentials must still boot, and the endpoints report 503 instead.
 */
@Configuration
public class AdConnectionsConfig {

    @Bean
    public TokenCipher tokenCipher(
            @Value("${ceview.security.token-encryption-key:}") String base64Key) {
        if (base64Key == null || base64Key.isBlank()) {
            return new UnconfiguredTokenCipher();
        }
        return new TokenCipher(base64Key);
    }

    /**
     * Stands in when no encryption key is configured. Every operation fails
     * loudly; nothing silently stores a token in the clear.
     */
    static class UnconfiguredTokenCipher extends TokenCipher {
        // A syntactically valid throwaway key so the super constructor succeeds.
        private static final String PLACEHOLDER =
                "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";

        UnconfiguredTokenCipher() {
            super(PLACEHOLDER);
        }

        @Override
        public String encrypt(String plaintext) {
            throw new IllegalStateException(
                    "TOKEN_ENCRYPTION_KEY is not configured; refusing to store an ad-platform token");
        }

        @Override
        public String decrypt(String encrypted) {
            throw new IllegalStateException(
                    "TOKEN_ENCRYPTION_KEY is not configured; cannot read a stored ad-platform token");
        }
    }
}
