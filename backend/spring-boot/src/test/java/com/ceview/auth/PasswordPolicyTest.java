package com.ceview.auth;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PasswordPolicyTest {

    @Test
    void acceptsEightOrMoreCharactersWithALetterAndADigit() {
        assertTrue(PasswordPolicy.isValid("Passw0rd"));
        assertTrue(PasswordPolicy.isValid("abcdefg1"));
        assertTrue(PasswordPolicy.isValid("1234567a"));
        assertTrue(PasswordPolicy.isValid("correct horse battery 9 staple"));
    }

    @Test
    void rejectsShortPasswords() {
        assertFalse(PasswordPolicy.isValid("Pass0rd"));
    }

    @Test
    void rejectsPasswordsMissingALetterOrADigit() {
        assertFalse(PasswordPolicy.isValid("12345678"));
        assertFalse(PasswordPolicy.isValid("abcdefgh"));
        assertFalse(PasswordPolicy.isValid("!!!!!!!!!"));
    }

    @Test
    void rejectsNullAndBlank() {
        assertFalse(PasswordPolicy.isValid(null));
        assertFalse(PasswordPolicy.isValid(""));
        assertFalse(PasswordPolicy.isValid("        "));
    }

    @Test
    void enforcesBcryptsSeventyTwoByteLimit() {
        assertTrue(PasswordPolicy.isValid("a1" + "x".repeat(70)), "exactly 72 bytes");
        assertFalse(PasswordPolicy.isValid("a1" + "x".repeat(71)), "73 bytes");
    }

    @Test
    void countsBytesNotCharacters() {
        // U+00E9 is 2 bytes in UTF-8: 1 digit + 36 two-byte letters = 73 bytes, only 37 characters.
        assertFalse(PasswordPolicy.isValid("1" + "é".repeat(36)));
    }

    @Test
    void requireThrowsAWeakPasswordFlowException() {
        AuthFlowException e = assertThrows(AuthFlowException.class, () -> PasswordPolicy.require("weak"));

        assertEquals(400, e.status());
        assertEquals("WEAK_PASSWORD", e.code());
        assertEquals(PasswordPolicy.MESSAGE, e.getMessage());
        assertDoesNotThrow(() -> PasswordPolicy.require("Passw0rd"));
    }
}
