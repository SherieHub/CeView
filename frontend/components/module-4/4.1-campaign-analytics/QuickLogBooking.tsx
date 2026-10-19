import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { apiClient } from '../../../services/apiClient';
import type { AttributionCodeSummary } from '../../../types';
import LogBookingAction from './LogBookingAction';

/**
 * The dashboard's entry point to "Log a booking" (CVW-42).
 *
 * Bookings are worth most when logged the moment the customer quotes the
 * code, and the dashboard is where staff land — so the quick entry lives here
 * as well as on the Performance screen. Renders nothing when there is no live
 * or upcoming code, or when codes cannot be loaded: it is a shortcut, not a
 * place to surface errors the Performance screen already shows.
 */
export default function QuickLogBooking() {
  const [codes, setCodes] = useState<AttributionCodeSummary[]>([]);
  const [logging, setLogging] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    apiClient.attribution
      .codes()
      .then((data) => live && setCodes((data ?? []).filter((c) => c.status !== 'ENDED')))
      .catch(() => live && setCodes([]));
    return () => {
      live = false;
    };
  }, []);

  if (codes.length === 0) return null;

  return (
    <section className="card mb-6 flex flex-col gap-4" aria-label="Log a booking">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1 basis-64">
          <h2 className="heading-sm">Took a booking?</h2>
          <p className="body-sm mt-1">
            Log it as soon as a customer quotes{' '}
            {codes.map((c, i) => (
              <React.Fragment key={c.attributionCodeId}>
                {i > 0 && (i === codes.length - 1 ? ' or ' : ', ')}
                <span className="font-mono font-semibold text-navy-dark">{c.code}</span>
              </React.Fragment>
            ))}
            .
          </p>
        </div>
        {!logging && (
          <button
            type="button"
            className="btn-primary btn-primary--sm inline-flex shrink-0 items-center gap-1.5"
            onClick={() => {
              setNotice(null);
              setLogging(true);
            }}
          >
            <Plus size={16} aria-hidden="true" />
            Log a booking
          </button>
        )}
      </div>

      {notice && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-sm)] bg-[var(--color-mint-pale-alt)] px-4 py-2.5 text-sm text-[var(--color-navy-dark)]"
        >
          <span>{notice}</span>
          <Link to="/performance" className="font-semibold underline-offset-2 hover:underline">
            See campaign evidence
          </Link>
        </div>
      )}

      {logging && (
        <LogBookingAction
          codes={codes}
          onCancel={() => setLogging(false)}
          onLogged={(saved) => {
            setLogging(false);
            setNotice(`Logged ${saved.bookings} booking${saved.bookings === 1 ? '' : 's'} for ${saved.code ?? 'the code'}.`);
          }}
        />
      )}
    </section>
  );
}
