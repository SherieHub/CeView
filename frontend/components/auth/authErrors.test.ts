import { describe, it, expect } from 'vitest';
import { ApiError } from '../../services/apiError';
import { describeAuthError, retryAfterSeconds } from './authErrors';

function apiError(status: number, body: unknown) {
  return new ApiError({ status, method: 'POST', path: '/api/auth/x', body });
}

describe('describeAuthError', () => {
  it('uses the fallback for anything that is not an ApiError', () => {
    expect(describeAuthError(new Error('boom'), 'fallback')).toBe('fallback');
    expect(describeAuthError(undefined, 'fallback')).toBe('fallback');
  });

  it('uses the fallback for an unknown code', () => {
    expect(describeAuthError(apiError(500, { code: 'SOMETHING_NEW' }), 'fallback')).toBe('fallback');
  });

  it('counts the attempts left, singular and plural', () => {
    expect(describeAuthError(apiError(400, { code: 'INVALID_CODE', attemptsRemaining: 4 }), 'f'))
      .toBe('That code is not correct. 4 attempts left.');
    expect(describeAuthError(apiError(400, { code: 'INVALID_CODE', attemptsRemaining: 1 }), 'f'))
      .toBe('That code is not correct. 1 attempt left.');
    expect(describeAuthError(apiError(400, { code: 'INVALID_CODE', attemptsRemaining: 0 }), 'f'))
      .toBe('That code is not correct. 0 attempts left.');
  });

  it('copes with INVALID_CODE that carries no attempt count', () => {
    expect(describeAuthError(apiError(400, { code: 'INVALID_CODE' }), 'f')).toBe('That code is not correct.');
  });

  it('names the wait for cooldown and rate limits, in seconds then minutes', () => {
    expect(describeAuthError(apiError(429, { code: 'RESEND_COOLDOWN', retryAfterSeconds: 30 }), 'f'))
      .toContain('30 seconds');
    expect(describeAuthError(apiError(429, { code: 'RESEND_COOLDOWN', retryAfterSeconds: 1 }), 'f'))
      .toContain('1 second ');
    expect(describeAuthError(apiError(429, { code: 'SEND_LIMIT', retryAfterSeconds: 600 }), 'f'))
      .toContain('10 minutes');
    expect(describeAuthError(apiError(429, { code: 'RATE_LIMITED', retryAfterSeconds: 840 }), 'f'))
      .toContain('14 minutes');
  });

  it('still reads sensibly when the wait is unknown', () => {
    expect(describeAuthError(apiError(429, { code: 'RATE_LIMITED' }), 'f')).toContain('a little while');
  });

  it.each([
    ['WEAK_PASSWORD', /8 characters/i],
    ['EMAIL_TAKEN', /already in use/i],
    ['CODE_EXPIRED', /expired/i],
    ['CODE_LOCKED', /new code/i],
    ['NO_ACTIVE_CODE', /no active code/i],
    ['EMAIL_SEND_FAILED', /could not send/i],
    ['ACCOUNT_NOT_FOUND', /no account/i],
    ['GOOGLE_ACCOUNT', /google/i],
    ['SAME_EMAIL', /already your email/i],
  ])('maps %s to a readable sentence', (code, pattern) => {
    expect(describeAuthError(apiError(400, { code }), 'f')).toMatch(pattern);
  });
});

describe('retryAfterSeconds', () => {
  it('reads the server-provided wait', () => {
    expect(retryAfterSeconds(apiError(429, { code: 'RESEND_COOLDOWN', retryAfterSeconds: 42 }))).toBe(42);
  });

  it('is null when absent or not an ApiError', () => {
    expect(retryAfterSeconds(apiError(429, { code: 'RESEND_COOLDOWN' }))).toBeNull();
    expect(retryAfterSeconds(new Error('x'))).toBeNull();
  });
});
