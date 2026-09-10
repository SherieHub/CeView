package com.ceview.common.crypto;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Base64;

/**
 * Symmetric encryption for third-party OAuth tokens at rest.
 *
 * <p>AES-256-GCM. A fresh 12-byte IV is generated per call and prepended to the
 * ciphertext, so the stored value is {@code base64(iv || ciphertext || tag)} and
 * two encryptions of the same token never look alike.
 *
 * <p>GCM is authenticated: a tampered value fails to decrypt rather than
 * returning corrupted plaintext, which is why {@link #decrypt} can promise that
 * whatever it returns is what was stored.
 *
 * <p>This is deliberately not a Spring {@code @Component} — it is constructed by
 * {@code AdConnectionsConfig} only when a key is configured, so environments
 * without one start cleanly (the same shape as {@code FirebaseConfig}).
 */
public class TokenCipher {

    private static final String TRANSFORMATION = "AES/GCM/NoPadding";
    private static final int IV_LENGTH_BYTES = 12;
    private static final int TAG_LENGTH_BITS = 128;
    private static final int KEY_LENGTH_BYTES = 32;

    private final SecretKeySpec key;
    private final SecureRandom random = new SecureRandom();

    /**
     * @param base64Key a Base64-encoded 256-bit key. Generate one with:
     *                  {@code openssl rand -base64 32}
     * @throws IllegalArgumentException if the key is absent or not 32 bytes once decoded
     */
    public TokenCipher(String base64Key) {
        if (base64Key == null || base64Key.isBlank()) {
            throw new IllegalArgumentException("token encryption key is not configured");
        }
        byte[] decoded;
        try {
            decoded = Base64.getDecoder().decode(base64Key);
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("token encryption key is not valid Base64", e);
        }
        if (decoded.length != KEY_LENGTH_BYTES) {
            throw new IllegalArgumentException(
                    "token encryption key must decode to " + KEY_LENGTH_BYTES
                    + " bytes (256-bit), got " + decoded.length);
        }
        this.key = new SecretKeySpec(decoded, "AES");
    }

    public String encrypt(String plaintext) {
        try {
            byte[] iv = new byte[IV_LENGTH_BYTES];
            random.nextBytes(iv);

            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(TAG_LENGTH_BITS, iv));
            byte[] ciphertext = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));

            byte[] combined = new byte[iv.length + ciphertext.length];
            System.arraycopy(iv, 0, combined, 0, iv.length);
            System.arraycopy(ciphertext, 0, combined, iv.length, ciphertext.length);
            return Base64.getEncoder().encodeToString(combined);
        } catch (Exception e) {
            throw new IllegalStateException("failed to encrypt token", e);
        }
    }

    public String decrypt(String encrypted) {
        try {
            byte[] combined = Base64.getDecoder().decode(encrypted);
            if (combined.length <= IV_LENGTH_BYTES) {
                throw new IllegalStateException("ciphertext too short to contain an IV");
            }
            byte[] iv = new byte[IV_LENGTH_BYTES];
            byte[] ciphertext = new byte[combined.length - IV_LENGTH_BYTES];
            System.arraycopy(combined, 0, iv, 0, IV_LENGTH_BYTES);
            System.arraycopy(combined, IV_LENGTH_BYTES, ciphertext, 0, ciphertext.length);

            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(TAG_LENGTH_BITS, iv));
            return new String(cipher.doFinal(ciphertext), StandardCharsets.UTF_8);
        } catch (IllegalStateException e) {
            throw e;
        } catch (Exception e) {
            // Includes AEADBadTagException — tampering or the wrong key.
            throw new IllegalStateException("failed to decrypt token", e);
        }
    }
}
