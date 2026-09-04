/**
 * "These numbers are real, just old."
 *
 * Deliberately distinct from ApiErrorPanel. That panel means the request failed
 * and nothing below it is trustworthy; this one means the data below is genuine
 * measurement that simply has not refreshed. Styling them alike would train
 * people to dismiss both — see the spec's Section 4.
 *
 * `now` is injected rather than read from the clock so the age is testable.
 */
import { Clock } from 'lucide-react';

interface Props {
  dataAsOf: string | null;
  now: Date;
  /** Why the latest refresh failed, from the backend's unavailability contract. */
  cause?: string;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function StaleDataBanner({ dataAsOf, now, cause }: Props) {
  if (!dataAsOf) return null;

  const asOf = new Date(dataAsOf);
  const days = Math.floor((now.getTime() - asOf.getTime()) / MS_PER_DAY);

  return (
    <div
      role="status"
      className="rounded-[var(--radius-md)] border border-[var(--color-gray-light)] bg-[var(--color-off-white)] p-4"
    >
      <div className="flex items-center gap-2 text-[var(--color-navy-primary)]">
        <Clock size={16} aria-hidden="true" />
        <b>Data is {days} {days === 1 ? 'day' : 'days'} old.</b>
      </div>
      <p className="mt-1 text-sm text-[var(--color-text-body)]">
        Last successful fetch: {asOf.toISOString().slice(0, 10)}. The numbers below are
        real measurements — they have simply not refreshed.
      </p>
      {cause && (
        <p data-testid="stale-cause" className="mt-2 font-mono text-xs text-[var(--color-text-muted)]">
          Latest attempt failed — {cause}
        </p>
      )}
    </div>
  );
}
