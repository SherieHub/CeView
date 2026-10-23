import React, { useCallback, useEffect, useId, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { apiClient } from '../../../services/apiClient';
import { ApiErrorPanel } from '../../shared/ApiErrorPanel';
import type { AttributionCodeSummary, AttributionLift } from '../../../types';

const peso = (n: number) => `₱${Number(n).toLocaleString('en-PH', { maximumFractionDigits: 0 })}`;
const count = (n: number) => Number(n).toLocaleString('en-PH', { maximumFractionDigits: 1 });
const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'Asia/Manila' });

/** Why there is no percentage, in the operator's terms. */
const STATUS_NOTE: Record<Exclude<AttributionLift['status'], 'OK'>, string> = {
  UPCOMING: "This campaign's window hasn't opened yet. Lift appears once you report a week inside it.",
  NO_WINDOW_DATA: 'No week inside the campaign window has been reported yet. Submit one with the form above.',
  NO_BASELINE: 'There are no reported weeks in the four weeks before this campaign, so there is nothing to compare against.',
};

function LiftChip({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="chip chip--muted">No change measurable</span>;
  const tone = pct > 0 ? 'chip chip--success' : pct < 0 ? 'chip chip--critical' : 'chip chip--muted';
  return <span className={tone}>{pct > 0 ? '+' : ''}{pct}%</span>;
}

function Comparison({ label, before, during, pct, format }: {
  label: string;
  before: number | null;
  during: number | null;
  pct: number | null;
  format: (n: number) => string;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-[var(--radius-sm)] border border-gray-light px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <span className="body-sm font-semibold text-navy-dark">{label}</span>
        <LiftChip pct={pct} />
      </div>
      <div className="num flex items-baseline gap-3">
        <span className="flex flex-col">
          <span className="body-xs text-[var(--color-text-muted)]">Before</span>
          <span className="text-lg text-navy-dark">{before === null ? '—' : format(before)}</span>
        </span>
        <ArrowRight size={16} aria-hidden="true" className="text-[var(--color-text-muted)]" />
        <span className="flex flex-col">
          <span className="body-xs text-[var(--color-text-muted)]">During</span>
          <span className="text-lg font-semibold text-navy-dark">{during === null ? '—' : format(during)}</span>
        </span>
      </div>
    </div>
  );
}

/**
 * Statistical lift (marketing-attribution spec, phase 4): the operator's
 * reported results during a code's surge window against the four weeks before
 * it, as per-week rates.
 *
 * Labelled as a different kind of evidence from the link and code panels: it
 * needs no customer to quote anything, but it cannot separate the campaign
 * from anything else that changed that fortnight.
 */
export default function StatisticalLiftPanel() {
  const selectId = useId();
  const [codes, setCodes] = useState<AttributionCodeSummary[] | null>(null);
  const [codeId, setCodeId] = useState<string | null>(null);
  const [lift, setLift] = useState<AttributionLift | null>(null);
  const [error, setError] = useState<unknown | null>(null);

  const loadCodes = useCallback(async () => {
    setError(null);
    try {
      const data = (await apiClient.attribution.codes()) ?? [];
      setCodes(data);
      // Prefer a live campaign — that's the one being judged right now.
      const preferred = data.find((c) => c.status === 'ACTIVE') ?? data[0];
      setCodeId((current) => current ?? preferred?.attributionCodeId ?? null);
    } catch (err) {
      setError(err);
    }
  }, []);

  useEffect(() => {
    loadCodes();
  }, [loadCodes]);

  useEffect(() => {
    if (!codeId) return;
    let live = true;
    setLift(null);
    setError(null);
    apiClient.attribution
      .lift(codeId)
      .then((data) => live && setLift(data))
      .catch((err) => live && setError(err));
    return () => {
      live = false;
    };
  }, [codeId]);

  return (
    <div className="card flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 basis-64">
          <h3 className="heading-sm">Statistical lift</h3>
          <p className="body-sm mt-1">
            Your reported results during the campaign, compared with the four weeks before it.
          </p>
        </div>
        {codes && codes.length > 1 && (
          <div className="w-full sm:w-64">
            <label htmlFor={selectId} className="sr">Campaign code</label>
            <select
              id={selectId}
              className="input"
              value={codeId ?? ''}
              onChange={(e) => setCodeId(e.target.value)}
            >
              {codes.map((c) => (
                <option key={c.attributionCodeId} value={c.attributionCodeId}>
                  {c.code} • {shortDate(c.windowStart)} – {shortDate(c.windowEnd)}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {error ? (
        <ApiErrorPanel error={error} onRetry={loadCodes} label="Statistical lift" />
      ) : !codes ? (
        <p className="body-sm">Loading...</p>
      ) : codes.length === 0 ? (
        <p className="body-sm text-[var(--color-text-muted)]">
          Lift is measured per campaign code. One is created with each surge alert.
        </p>
      ) : !lift ? (
        <p className="body-sm">Loading lift...</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <Comparison
              label="Bookings per week"
              before={lift.baselineBookingsPerWeek}
              during={lift.windowBookingsPerWeek}
              pct={lift.bookingsLiftPct}
              format={count}
            />
            <Comparison
              label="Revenue per week"
              before={lift.baselineRevenuePerWeek}
              during={lift.windowRevenuePerWeek}
              pct={lift.revenueLiftPct}
              format={peso}
            />
          </div>
          <p className="body-xs text-[var(--color-text-muted)]">
            {lift.status === 'OK' ? (
              <>
                {lift.code}: {lift.windowPeriods} reported period{lift.windowPeriods === 1 ? '' : 's'} in the
                window ({shortDate(lift.windowStart)} – {shortDate(lift.windowEnd)}) against{' '}
                {lift.baselineWeeks} week{lift.baselineWeeks === 1 ? '' : 's'} before it.
                {lift.shortBaseline && ' Fewer than four weeks of history, so treat this as a rough guide.'}
                {' '}Lift shows the campaign coincided with a change; it can't rule out other causes.
              </>
            ) : (
              STATUS_NOTE[lift.status]
            )}
          </p>
        </>
      )}
    </div>
  );
}
