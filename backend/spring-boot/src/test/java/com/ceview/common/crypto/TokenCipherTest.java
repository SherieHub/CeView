package com.ceview.common.crypto;

import org.junit.jupiter.api.Test;

import java.util.Base64;

import static org.junit.jupiter.api.Assertions.*;

class TokenCipherTest {

    /** A fixed 256-bit key so the test is deterministic. */
    private static final String KEY = Base64.getEncoder()
            .encodeToString("0123456789abcdef0123456789abcdef".getBytes());

    private final TokenCipher cipher = new TokenCipher(KEY);

    @Test
    void roundTripsAValue() {
        String plaintext = "EAAJj9ZBv-a-long-looking-access-token";
        assertEquals(plaintext, cipher.decrypt(cipher.encrypt(plaintext)));
    }

    @Test
    void producesDifferentCiphertextForTheSamePlaintext() {
        // A random IV per call means an attacker with DB access cannot tell that
        // two operators connected the same account.
        assertNotEquals(cipher.encrypt("same"), cipher.encrypt("same"));
    }

    @Test
    void rejectsTamperedCiphertext() {
        String encrypted = cipher.encrypt("secret");
        byte[] raw = Base64.getDecoder().decode(encrypted);
        raw[raw.length - 1] ^= 0x01;                       // flip one bit of the tag
        String tampered = Base64.getEncoder().encodeToString(raw);

        assertThrows(IllegalStateException.class, () -> cipher.decrypt(tampered));
    }

    @Test
    void rejectsAKeyOfTheWrongLength() {
        String shortKey = Base64.getEncoder().encodeToString("too-short".getBytes());
        assertThrows(IllegalArgumentException.class, () -> new TokenCipher(shortKey));
    }

    @Test
    void rejectsNonBase64Ciphertext() {
        // Malformed Base64 must fall into the same wrapped failure as tampering/wrong-key,
        // not leak a raw IllegalArgumentException from the decoder.
        assertThrows(IllegalStateException.class, () -> cipher.decrypt("not-valid-base64!!!"));
    }

    @Test
    void roundTripsAnEmptyString() {
        assertEquals("", cipher.decrypt(cipher.encrypt("")));
    }
}
