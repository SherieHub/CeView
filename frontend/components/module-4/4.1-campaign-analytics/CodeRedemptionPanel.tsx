import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Plus, Ticket, Trash2 } from 'lucide-react';
import { apiClient } from '../../../services/apiClient';
import { ApiErrorPanel } from '../../shared/ApiErrorPanel';
import type { AttributionCodeSummary, AttributionRedemption, CaptureKind } from '../../../types';
import LogBookingAction from './LogBookingAction';
import { marketName } from './marketName';

/** Ordered most to least trustworthy, matching the backend's CaptureKind. */
const KIND_LABEL: Record<CaptureKind, string> = {
  ENQUIRY: 'Enquiry form',
  BOOKING_PLATFORM: 'Booking platform',
  CLICK_MATCHED: 'Ad click',
  CODE_LOGGED: 'Staff-logged',
};

/** Chip phrasing, read after the count: "5 via ad click", "1 logged by staff". */
const KIND_PHRASE: Record<CaptureKind, string> = {
  ENQUIRY: 'via enquiry form',
  BOOKING_PLATFORM: 'via booking platform',
  CLICK_MATCHED: 'via ad click',
  CODE_LOGGED: 'logged by staff',
};

/** Automatic captures get the success tone; operator-entered ones stay neutral. */
const KIND_CHIP: Record<CaptureKind, string> = {
  ENQUIRY: 'chip chip--success',
  BOOKING_PLATFORM: 'chip chip--success',
  CLICK_MATCHED: 'chip',
  CODE_LOGGED: 'chip chip--muted',
};

const STATUS: Record<AttributionCodeSummary['status'], { label: string; chip: string }> = {
  ACTIVE: { label: 'Live', chip: 'chip chip--success' },
  UPCOMING: { label: 'Upcoming', chip: 'chip' },
  ENDED: { label: 'Ended', chip: 'chip chip--muted' },
};

const peso = (n: number) => `₱${Number(n).toLocaleString('en-PH', { maximumFractionDigits: 0 })}`;
const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'Asia/Manila' });
const shortDateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Manila',
  });
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * Code-redemption evidence for the Performance screen (CVW-42).
 *
 * One card: each surge window's quotable code with its bookings split by how
 * they were captured — automatic, matched to an ad click, or logged by staff —
 * so anyone reading it can see how much of a total is measured rather than
 * recalled. Hosts the "Log a booking" quick entry and an undo list.
 */
export default function CodeRedemptionPanel() {
  const [codes, setCodes] = useState<AttributionCodeSummary[] | null>(null);
  const [recent, setRecent] = useState<AttributionRedemption[]>([]);
  const [error, setError] = useState<unknown | null>(null);
  const [logging, setLogging] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<unknown | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [codeData, recentData] = await Promise.all([
        apiClient.attribution.codes(),
        apiClient.attribution.recentRedemptions(),
      ]);
      setCodes(codeData ?? []);
      setRecent(recentData ?? []);
    } catch (err) {
      setError(err);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const undo = async (redemption: AttributionRedemption) => {
    setActionError(null);
    try {
      await apiClient.attribution.deleteRedemption(redemption.redemptionId);
      setNotice(`Removed ${plural(redemption.bookings, 'booking')} from ${redemption.code ?? 'the code'}.`);
      await load();
    } catch (err) {
      setActionError(err);
    }
  };

  // Vouchers are redeemed through their own card (it applies the discount and enforces the cap).
  const loggable = (codes ?? []).filter((c) => c.status !== 'ENDED' && !c.voucher);
  const totalBookings = (codes ?? []).reduce((sum, c) => sum + c.totalBookings, 0);
  const totalRevenue = (codes ?? []).reduce((sum, c) => sum + c.totalRevenue, 0);

  return (
    <div className="card flex h-full flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <span className="perf-ev-icon" aria-hidden="true"><Ticket size={18} /></span>
        <div className="min-w-0 flex-1 basis-56">
          <h3 className="heading-sm">Code-redemption evidence</h3>
          <p className="body-sm mt-1">Bookings where the customer quoted a campaign code.</p>
        </div>
        {codes && codes.length > 0 && !logging && (
          <button
            type="button"
            className="btn-primary btn-primary--sm inline-flex shrink-0 items-center gap-1.5"
            onClick={() => {
              setNotice(null);
              setLogging(true);
            }}
            disabled={loggable.length === 0}
            title={loggable.length === 0 ? 'Every code has ended' : undefined}
          >
            <Plus size={16} aria-hidden="true" />
            Log a booking
          </button>
        )}
      </div>

      {error ? (
        <ApiErrorPanel error={error} onRetry={load} label="Code-redemption evidence" />
      ) : !codes ? (
        <p className="body-sm">Loading codes...</p>
      ) : codes.length === 0 ? (
        <div className="empty">
          <p className="mx-auto">
            No campaign codes yet. A code is created with each surge alert and added to every caption
            generated for that market, so customers can quote it when they book.
          </p>
        </div>
      ) : (
        <>
          {notice && (
            <div
              role="status"
              className="rounded-[var(--radius-sm)] bg-[var(--color-mint-pale-alt)] px-4 py-2.5 text-sm text-[var(--color-navy-dark)]"
            >
              {notice}
            </div>
          )}
          {actionError ? <ApiErrorPanel error={actionError} label="Remove booking" /> : null}

          {logging && (
            <LogBookingAction
              codes={loggable}
              onCancel={() => setLogging(false)}
              onLogged={(saved) => {
                setLogging(false);
                setNotice(`Logged ${plural(saved.bookings, 'booking')} for ${saved.code ?? 'the code'}.`);
                load();
              }}
            />
          )}

          <div className="overflow-x-auto">
            <table className="num w-full border-collapse text-left text-sm">
              <caption className="sr">Campaign codes with bookings and revenue, newest window first</caption>
              <thead>
                <tr className="border-b border-gray-light">
                  <th className="py-3 pr-3 font-semibold text-navy-dark">Code</th>
                  <th className="py-3 px-3 whitespace-nowrap text-right font-semibold text-navy-dark">Bookings</th>
                  <th className="py-3 pl-3 whitespace-nowrap text-right font-semibold text-navy-dark">Revenue</th>
                </tr>
              </thead>
              <tbody aria-label="Campaign codes">
                {codes.map((code) => (
                  <tr key={code.attributionCodeId} className="border-b border-gray-light align-top">
                    <td className="py-3 pr-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono font-semibold text-navy-dark">{code.code}</span>
                        <span className={STATUS[code.status].chip}>{STATUS[code.status].label}</span>
                      </div>
                      <p className="body-xs mt-1 text-[var(--color-text-muted)]">
                        {code.category} • {marketName(code.targetMarket)} • {shortDate(code.windowStart)} – {shortDate(code.windowEnd)}
                      </p>
                      {code.trackedExceedsReported && (
                        <p className="body-xs mt-2 flex items-start gap-1.5 text-[var(--color-critical-text)]">
                          <AlertTriangle size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
                          <span>
                            More bookings tracked than the {code.reportedBookings} you reported for these weeks.
                            Your weekly total may be too low.
                          </span>
                        </p>
                      )}
                      {code.totalBookings > 0 && (
                        <ul className="mt-2 flex flex-wrap gap-1.5" aria-label={`How ${code.code} bookings were captured`}>
                          {code.byKind
                            .filter((k) => k.bookings > 0)
                            .map((k) => (
                              <li key={k.kind} className={KIND_CHIP[k.kind]}>
                                {k.bookings} {KIND_PHRASE[k.kind]}
                              </li>
                            ))}
                        </ul>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right">{code.totalBookings}</td>
                    <td className="py-3 pl-3 whitespace-nowrap text-right">{peso(code.totalRevenue)}</td>
                  </tr>
                ))}
              </tbody>
              {codes.length > 1 && (
                <tfoot>
                  <tr className="font-semibold text-navy-dark">
                    <td className="pt-3 pr-3">Total</td>
                    <td className="pt-3 px-3 text-right">{totalBookings}</td>
                    <td className="pt-3 pl-3 whitespace-nowrap text-right">{peso(totalRevenue)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {recent.length > 0 && (
            <details className="group border-t border-gray-light pt-3">
              <summary className="body-sm cursor-pointer font-semibold text-navy-dark">
                Recent bookings ({recent.length})
              </summary>
              <div className="mt-2 max-h-72 overflow-auto">
                <table className="num w-full border-collapse text-left text-xs">
                  <caption className="sr">Most recent bookings across all codes</caption>
                  <thead>
                    <tr className="border-b border-gray-light text-[var(--color-text-muted)]">
                      <th className="py-2 pr-2 font-semibold">When</th>
                      <th className="py-2 px-2 font-semibold">Code</th>
                      <th className="py-2 px-2 font-semibold">How</th>
                      <th className="py-2 px-2 text-right font-semibold">Qty</th>
                      <th className="py-2 px-2 text-right font-semibold">Revenue</th>
                      <th className="py-2 pl-2"><span className="sr">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody aria-label="Recent bookings">
                    {recent.map((r) => (
                      <tr key={r.redemptionId} className="border-b border-gray-light last:border-b-0">
                        <td className="py-2 pr-2 whitespace-nowrap">{r.eventAt ? shortDateTime(r.eventAt) : '—'}</td>
                        <td className="py-2 px-2 whitespace-nowrap font-mono">{r.code ?? '—'}</td>
                        <td className="py-2 px-2 whitespace-nowrap">{KIND_LABEL[r.kind]}</td>
                        <td className="py-2 px-2 text-right">{r.bookings}</td>
                        <td className="py-2 px-2 whitespace-nowrap text-right">{peso(r.revenue)}</td>
                        <td className="py-1 pl-2 text-right">
                          {r.deletable && (
                            <button
                              type="button"
                              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[var(--color-text-muted)] hover:bg-[var(--color-critical-bg)] hover:text-[var(--color-critical-text)]"
                              onClick={() => undo(r)}
                              aria-label={`Remove booking for ${r.code ?? 'code'}`}
                              title="Remove this booking"
                            >
                              <Trash2 size={14} aria-hidden="true" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}
        </>
      )}
    </div>
  );
}
