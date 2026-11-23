// frontend/services/retryAdvice.ts
/**
 * Whether a failed model call is worth retrying now, or only after a wait.
 *
 * Quota failures do not always carry a quota code: the BiLSTM forecaster reports a
 * ZeroGPU limit as MOD22_BILSTM_UNAVAILABLE with the quota wording only in `cause`.
 * So the text is checked as well as the status and code.
 */
import { ApiError } from './apiError';

export type RetryAdvice = 'wait' | 'retry';

const WAIT_CODE = /QUOTA|RATE_LIMIT/i;
const WAIT_TEXT = /quota|rate.?limit|runs limit|exceeded your|too many requests/i;

export function retryAdvice(error: unknown): RetryAdvice {
  if (!(error instanceof ApiError)) return 'retry';
  if (error.status === 429) return 'wait';
  if (error.code && WAIT_CODE.test(error.code)) return 'wait';
  if (WAIT_TEXT.test(`${error.cause ?? ''} ${error.message}`)) return 'wait';
  return 'retry';
}
