import React, { useEffect, useId, useMemo, useState } from 'react';
import { apiClient } from '../../../services/apiClient';
import { ApiErrorPanel } from '../../shared/ApiErrorPanel';
import type { AttributionCodeSummary, AttributionLink, AttributionRedemption } from '../../../types';
import { ClickMatchStep } from './ClickMatchStep';

export interface LogBookingActionProps {
  /** Codes the booking can be logged against; ended codes are filtered out by the caller. */
  codes: AttributionCodeSummary[];
  onLogged(redemption: AttributionRedemption): void;
  onCancel(): void;
}

/** How far back the click picker looks from the booking time. Backend caps ranges at 31 days. */
const CLICK_LOOKBACK_DAYS = 14;

/** `YYYY-MM-DDTHH:mm` in the browser's local time, for a datetime-local input. */
function toLocalInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Quick entry for one booking, at the moment staff take it (CVW-42).
 *
 * Captured per event rather than recalled in a weekly batch — the recall
 * error is exactly what the experts flagged. When the code's campaign has a
 * tracked link, the operator can attach the booking to a recorded ad click
 * (ClickMatchStep), which names the creative that produced it.
 */
export default function LogBookingAction({ codes, onLogged, onCancel }: LogBookingActionProps) {
  const ids = useId();
  const [codeId, setCodeId] = useState(codes[0]?.attributionCodeId ?? '');
  const [bookings, setBookings] = useState('1');
  const [revenue, setRevenue] = useState('');
  const [when, setWhen] = useState(() => toLocalInput(new Date()));
  const [clickId, setClickId] = useState<string | null>(null);
  const [links, setLinks] = useState<AttributionLink[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<unknown | null>(null);
  const [validation, setValidation] = useState<string | null>(null);

  // Links are optional context: without one the booking is still loggable
  // against the code, so a failed fetch just hides the click step.
  useEffect(() => {
    let live = true;
    apiClient.attributionLinks
      .list()
      .then((data) => live && setLinks(data ?? []))
      .catch(() => live && setLinks([]));
    return () => {
      live = false;
    };
  }, []);

  const code = codes.find((c) => c.attributionCodeId === codeId);
  // A code and its link are minted for the same surge window.
  const link = code
    ? links.find(
        (l) =>
          l.category === code.category &&
          l.targetMarket === code.targetMarket &&
          new Date(l.windowStart).getTime() === new Date(code.windowStart).getTime(),
      )
    : undefined;

  const eventAt = useMemo(() => {
    const parsed = new Date(when);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }, [when]);

  const clickRange = useMemo(() => {
    if (!eventAt) return null;
    const from = new Date(eventAt.getTime() - CLICK_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
    return { from: from.toISOString(), to: eventAt.toISOString() };
  }, [eventAt]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidation(null);
    const count = Number(bookings);
    const amount = revenue.trim() === '' ? undefined : Number(revenue);
    if (!code) return setValidation('Pick the code the customer quoted.');
    if (!Number.isInteger(count) || count < 1 || count > 500) {
      return setValidation('Bookings must be a whole number from 1 to 500.');
    }
    if (amount !== undefined && (Number.isNaN(amount) || amount < 0)) {
      return setValidation('Revenue must be zero or more.');
    }
    if (!eventAt) return setValidation('Enter when the booking was made.');
    if (eventAt.getTime() > Date.now() + 5 * 60 * 1000) {
      return setValidation('The booking time cannot be in the future.');
    }

    setSubmitting(true);
    setError(null);
    try {
      const saved = await apiClient.attribution.logBooking({
        attributionCodeId: code.attributionCodeId,
        clickId: clickId ?? undefined,
        bookings: count,
        revenue: amount,
        eventAt: eventAt.toISOString(),
      });
      onLogged(saved);
    } catch (err) {
      setError(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    // noValidate: submit() validates with messages that say what to fix, rather
    // than the browser silently refusing to submit.
    <form
      className="flex flex-col gap-4 rounded-[var(--radius-md)] border border-[var(--color-mint-pale)] bg-[var(--color-mint-pale-alt)] p-4 sm:p-5"
      onSubmit={submit}
      aria-label="Log a booking"
      noValidate
    >
      <div>
        <h4 className="heading-sm">Log a booking</h4>
        <p className="body-xs mt-1 text-[var(--color-text-muted)]">
          Record it now, while the customer is in front of you.
        </p>
      </div>

      <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor={`${ids}-code`} className="field-label">Code the customer quoted</label>
          <select
            id={`${ids}-code`}
            className="input"
            value={codeId}
            onChange={(e) => {
              setCodeId(e.target.value);
              setClickId(null);
            }}
          >
            {codes.map((c) => (
              <option key={c.attributionCodeId} value={c.attributionCodeId}>
                {c.code} • {c.category} • {c.targetMarket}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`${ids}-bookings`} className="field-label">Bookings</label>
          <input
            id={`${ids}-bookings`}
            className="input"
            type="number"
            min={1}
            max={500}
            step={1}
            value={bookings}
            onChange={(e) => setBookings(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor={`${ids}-revenue`} className="field-label">Revenue (₱)</label>
          <input
            id={`${ids}-revenue`}
            className="input"
            type="number"
            min={0}
            step="0.01"
            placeholder="Optional"
            value={revenue}
            onChange={(e) => setRevenue(e.target.value)}
          />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor={`${ids}-when`} className="field-label">When</label>
          <input
            id={`${ids}-when`}
            className="input"
            type="datetime-local"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
          />
        </div>
      </div>

      {link && clickRange && (
        <ClickMatchStep
          linkId={link.linkId}
          from={clickRange.from}
          to={clickRange.to}
          value={clickId}
          onChange={setClickId}
        />
      )}

      {validation && (
        <p role="alert" className="body-sm text-[var(--color-critical-text)]">{validation}</p>
      )}
      {error ? <ApiErrorPanel error={error} label="Log a booking" /> : null}

      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" className="btn-outline btn-outline--sm" onClick={onCancel} disabled={submitting}>
          Cancel
        </button>
        <button type="submit" className="btn-primary btn-primary--sm" disabled={submitting}>
          {submitting ? 'Saving…' : 'Save booking'}
        </button>
      </div>
    </form>
  );
}
