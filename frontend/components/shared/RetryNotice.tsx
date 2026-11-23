// frontend/components/shared/RetryNotice.tsx
/**
 * The operator-facing surface for a model call that failed: one plain sentence and
 * a Try again button. Unlike ApiErrorPanel it never shows the request, status or
 * cause; logApiFailure() puts those in the console. `error` is only read to choose
 * between "try again now" and "wait a while" (retryAdvice).
 * Spec: docs/superpowers/specs/2026-11-23-analysis-step-retry-design.md
 */
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { retryAdvice } from '../../services/retryAdvice';

export const RETRY_COPY = {
  retry: "Our model didn't respond. This usually clears up in a few seconds — try again.",
  wait: 'Our model has reached its usage limit for now. Please wait a while before trying again — it resets on its own.',
} as const;

interface Props {
  error: unknown;
  /** Bold lead sentence, e.g. "The analysis didn't finish." */
  title: string;
  onRetry: () => void;
  /** The retried call is running: disable the button and say so. */
  busy?: boolean;
  className?: string;
}

export function RetryNotice({ error, title, onRetry, busy = false, className }: Props) {
  const advice = retryAdvice(error);
  return (
    <div
      role="alert"
      data-advice={advice}
      className={`banner banner--warn${className ? ` ${className}` : ''}`}
    >
      <AlertTriangle aria-hidden="true" />
      <div className="min-w-0 [overflow-wrap:anywhere]">
        <p>
          <b>{title}</b> {RETRY_COPY[advice]}
        </p>
        <button
          type="button"
          className="btn-outline btn-outline--sm mt-3"
          onClick={onRetry}
          disabled={busy}
        >
          {busy ? (
            <>
              <span className="spinner" aria-hidden="true" /> Trying again…
            </>
          ) : (
            <>
              <RotateCcw size={14} aria-hidden="true" /> Try again
            </>
          )}
        </button>
      </div>
    </div>
  );
}
