/**
 * Turns the backend's auth failures (stable `code` values from AuthFlowException,
 * see backend/CONTRACT.md) into the sentence shown to the user. The backend's own
 * `error` text is not used: copy lives here so it can be changed without a deploy
 * of the API.
 */
import { ApiError } from '../../services/apiError';

function bodyNumber(err: ApiError, key: string): number | undefined {
  const body = err.body;
  if (typeof body !== 'object' || body === null) return undefined;
  const value = (body as Record<string, unknown>)[key];
  return typeof value === 'number' ? value : undefined;
}

/** Seconds the server asked the client to wait (RESEND_COOLDOWN, SEND_LIMIT, RATE_LIMITED). */
export function retryAfterSeconds(err: unknown): number | null {
  return err instanceof ApiError ? bodyNumber(err, 'retryAfterSeconds') ?? null : null;
}

function waitPhrase(seconds: number | null): string {
  if (seconds === null) return 'a little while';
  if (seconds < 90) return `${seconds} second${seconds === 1 ? '' : 's'}`;
  return `${Math.ceil(seconds / 60)} minutes`;
}

export function describeAuthError(err: unknown, fallback: string): string {
  if (!(err instanceof ApiError)) return fallback;
  switch (err.code) {
    case 'WEAK_PASSWORD':
      return 'Your password needs at least 8 characters, with a letter and a number.';
    case 'EMAIL_TAKEN':
      return 'That email is already in use. Try signing in, or use “Forgot password”.';
    case 'INVALID_CODE': {
      const left = bodyNumber(err, 'attemptsRemaining');
      return left === undefined
        ? 'That code is not correct.'
        : `That code is not correct. ${left} ${left === 1 ? 'attempt' : 'attempts'} left.`;
    }
    case 'CODE_EXPIRED':
      return 'That code has expired. Request a new one.';
    case 'CODE_LOCKED':
      return 'Too many wrong attempts. Request a new code.';
    case 'NO_ACTIVE_CODE':
      return 'There is no active code. Request a new one.';
    case 'RESEND_COOLDOWN':
      return `Please wait ${waitPhrase(retryAfterSeconds(err))} before requesting another code.`;
    case 'SEND_LIMIT':
      return `Too many codes requested. Try again in ${waitPhrase(retryAfterSeconds(err))}.`;
    case 'RATE_LIMITED':
      return `Too many requests. Try again in ${waitPhrase(retryAfterSeconds(err))}.`;
    case 'EMAIL_SEND_FAILED':
      return 'We could not send the email right now. Please try again shortly.';
    case 'ACCOUNT_NOT_FOUND':
      return 'No account found with that email.';
    case 'GOOGLE_ACCOUNT':
      return 'This account uses Google sign-in. Use “Continue with Google” instead.';
    case 'SAME_EMAIL':
      return 'That is already your email address.';
    default:
      return fallback;
  }
}
