/**
 * The password rule enforced by the backend on register and reset
 * (backend/spring-boot .../auth/PasswordPolicy.java): at least 8 characters
 * with a letter and a digit, at most 72 bytes (BCrypt ignores the rest).
 * Mirrored here only to give feedback before a round trip — the server is the
 * authority.
 */
export const PASSWORD_HINT = 'At least 8 characters, with a letter and a number.';

export function isValidPassword(password: string): boolean {
  return (
    password.length >= 8 &&
    /\p{L}/u.test(password) &&
    /\d/.test(password) &&
    new TextEncoder().encode(password).length <= 72
  );
}
