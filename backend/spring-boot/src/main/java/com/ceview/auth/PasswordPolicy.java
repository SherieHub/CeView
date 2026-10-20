package com.ceview.auth;

import java.nio.charset.StandardCharsets;
import java.util.regex.Pattern;

/**
 * The password rule for register and reset: at least 8 characters, containing at least one letter
 * and one digit, and at most 72 bytes (BCrypt silently ignores anything beyond that, so a longer
 * password would be weaker than it looks). Mirrored in the frontend's password hint.
 */
public final class PasswordPolicy {

    public static final String MESSAGE =
        "Password must be 8-72 characters and include at least one letter and one number.";

    private static final Pattern RULE = Pattern.compile("^(?=.*\\p{L})(?=.*\\d).{8,}$");
    private static final int MAX_BYTES = 72;

    private PasswordPolicy() {}

    public static boolean isValid(String password) {
        return password != null
            && RULE.matcher(password).matches()
            && password.getBytes(StandardCharsets.UTF_8).length <= MAX_BYTES;
    }

    /** @throws AuthFlowException 400 {@code WEAK_PASSWORD} when the rule is not met. */
    public static void require(String password) {
        if (!isValid(password)) {
            throw new AuthFlowException(400, "WEAK_PASSWORD", MESSAGE);
        }
    }
}
