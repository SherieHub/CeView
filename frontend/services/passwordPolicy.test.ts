import { describe, it, expect } from 'vitest';
import { isValidPassword } from './passwordPolicy';

describe('isValidPassword (mirrors the backend PasswordPolicy)', () => {
  it('accepts 8+ characters with a letter and a digit', () => {
    expect(isValidPassword('Passw0rd')).toBe(true);
    expect(isValidPassword('1234567a')).toBe(true);
    expect(isValidPassword('a long passphrase with 1 number')).toBe(true);
  });

  it('rejects short passwords and ones missing a letter or a digit', () => {
    expect(isValidPassword('Pass0rd')).toBe(false);
    expect(isValidPassword('12345678')).toBe(false);
    expect(isValidPassword('abcdefgh')).toBe(false);
    expect(isValidPassword('')).toBe(false);
  });

  it('counts accented letters as letters', () => {
    expect(isValidPassword('cafécafé1')).toBe(true);
  });

  it('caps at 72 bytes, as BCrypt ignores anything beyond', () => {
    expect(isValidPassword('a1' + 'x'.repeat(70))).toBe(true);
    expect(isValidPassword('a1' + 'x'.repeat(71))).toBe(false);
    expect(isValidPassword('1' + 'é'.repeat(36))).toBe(false);
  });
});
