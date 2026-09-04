/**
 * The single error surface for every backend-wired screen.
 * Plan: docs/superpowers/plans/2026-08-29-frontend-backend-connection/01-foundation.md Task 3
 *
 * Three cases, visually distinct because a developer needs to tell them apart
 * without opening the console:
 *   missing dependency -> names the exact setup step (navy, informational)
 *   profile not ready  -> guidance, not a failure (navy, informational)
 *   genuine failure    -> status, method, path, backend code, message (critical/red)
 *
 * Tone deviates from the plan's draft, which put --color-coral-cta on the
 * heading text for both the missing-dependency and genuine-failure cases:
 * styles/index.css documents coral-cta as a fill tone at 2.28:1 on white,
 * under the AA floor for text. This uses --color-critical-text (6.21:1,
 * already used for FlaggedMetricBanner/IngestionForm's error banners) for the
 * genuine-failure case, and --color-navy-primary for both non-failure cases,
 * distinguished from each other by icon (Settings vs UserPlus) rather than colour.
 */
import { AlertTriangle, Settings, UserPlus } from 'lucide-react';
import { ApiError, isMissingDependency, isProfileNotReady } from '../../services/apiError';

interface Props {
  error: unknown;
  /** Omitted for cases a retry cannot fix (missing dependency, profile not ready). */
  onRetry?: () => void;
  /** Optional context, e.g. "Market Radar". */
  label?: string;
}

export function ApiErrorPanel({ error, onRetry, label }: Props) {
  const api = error instanceof ApiError ? error : null;
  const missing = isMissingDependency(error);
  const notReady = isProfileNotReady(error);

  const Icon = missing ? Settings : notReady ? UserPlus : AlertTriangle;
  const tone = missing || notReady ? 'text-[var(--color-navy-primary)]' : 'text-[var(--color-critical-text)]';

  // isMissingDependency() requires a non-empty `dependency` string (apiError.ts),
  // so whenever missing is true, api is a non-null ApiError with a truthy
  // api.dependency — there is no "missing dependency, but no name" case to
  // fall back from. (An earlier version of this line had a 'Setup required'
  // fallback here; it was dead code that could never render.)
  const heading = missing
    ? `${api!.dependency} is unavailable`
    : notReady
      ? 'Complete onboarding first'
      : 'Something went wrong';

  return (
    <div
      role="alert"
      className="rounded-[var(--radius-md)] border border-[var(--color-gray-light)] bg-[var(--color-off-white)] p-6"
    >
      <div className={`flex items-center gap-2 ${tone}`}>
        <Icon size={18} aria-hidden="true" />
        <h3 className="font-semibold">{heading}</h3>
      </div>

      {label && <p className="mt-1 text-sm text-[var(--color-text-muted)]">{label}</p>}

      <p className="mt-2 text-sm text-[var(--color-text-body)]">
        {missing
          ? 'This screen needs a dependency that is not answering. Nothing below is simulated — the data is simply not available.'
          : notReady
            ? 'This screen needs a saved business profile before it can load data.'
            : 'The request to the backend did not succeed.'}
      </p>

      {api && (
        <dl className="mt-4 space-y-1 font-mono text-xs text-[var(--color-text-muted)]">
          <div>
            <dt className="sr-only">Request</dt>
            <dd>{api.method} {api.path}</dd>
          </div>
          <div>
            <dt className="sr-only">Status</dt>
            <dd>{api.status}{api.code ? ` · ${api.code}` : ''}</dd>
          </div>
          <div>
            <dt className="sr-only">Message</dt>
            <dd className="whitespace-pre-wrap break-words">{api.message}</dd>
          </div>
          {/* Cause and Stage use a visible <dt>, unlike Request/Status/Message above,
              which use sr-only labels. Those three are self-explanatory from content
              alone (a method+path, an HTTP status, a message). Cause is an arbitrary
              backend-authored string and Stage is a multi-segment chain like
              "fastapi-sbert/caption_agent -> spring/content/generate" — without a
              visible label neither reads as anything in particular, even to a sighted
              developer. Don't "fix" this to match the other three rows. */}
          {api.cause && (
            <div>
              <dt className="mt-2 not-italic text-[var(--color-text-muted)]">Cause</dt>
              <dd data-testid="api-error-cause" className="whitespace-pre-wrap break-words">
                {api.cause}
              </dd>
            </div>
          )}
          {api.stage && (
            <div>
              <dt className="mt-2 not-italic text-[var(--color-text-muted)]">Stage</dt>
              <dd data-testid="api-error-stage">{api.stage}</dd>
            </div>
          )}
        </dl>
      )}

      {onRetry && !missing && !notReady && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 rounded-[var(--radius-pill)] bg-[var(--color-coral-cta)] px-4 py-2 text-sm font-semibold text-[var(--color-text-inverse)] hover:bg-[var(--color-coral-cta-hover)]"
        >
          Retry
        </button>
      )}
    </div>
  );
}
