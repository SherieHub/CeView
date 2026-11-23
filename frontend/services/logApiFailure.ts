// frontend/services/logApiFailure.ts
/**
 * The developer-facing half of a failed call. The screen shows plain language only
 * (RetryNotice); this puts the request, status, backend code and cause in DevTools.
 * Call it from the catch handler, never from render, so each failure logs once.
 */
import { ApiError } from './apiError';
import { retryAdvice } from './retryAdvice';

export function logApiFailure(context: string, error: unknown): void {
  const advice = retryAdvice(error);
  const label = `[CeView] ${context} failed`;
  if (error instanceof ApiError) {
    console.error(label, {
      status: error.status,
      method: error.method,
      path: error.path,
      code: error.code,
      dependency: error.dependency,
      cause: error.cause,
      stage: error.stage,
      advice,
    });
    return;
  }
  console.error(label, { message: error instanceof Error ? error.message : String(error), advice });
}
