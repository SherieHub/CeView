/**
 * CARD — Foundation: Performance Shell & Ingestion
 * Depends on: Foundation — Shell & Routing, Foundation — Fixture Data Layer
 * Prototype reference: submitCampaign() / renderPerformance() entry state —
 * ui-ux-prototype.html:3918-3959, :4004-4038
 * Plan: docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/05-module-4.md (M4-F)
 * Task 16: submits to POST /api/analytics/manual instead of a fake local
 * delay — see docs/superpowers/plans/2026-08-29-frontend-backend-connection/.
 *
 * The 7-field campaign-input form. Field labels/hints/defaults are ported
 * verbatim from the prototype for behavioral parity (`DEFAULT_CAMPAIGN_INPUT`
 * seeds the form's *initial* values only — a legitimate starting form state,
 * not fake data displayed as real); visual treatment follows the
 * tourism-app-branding skill (.field/.input/.card, mint .btn-primary — this
 * is an ordinary form action, not a booking/money action or a wizard's
 * forward step, so coral .btn-cta doesn't apply here).
 *
 * Deliberately no `min={0}` on the inputs (the prototype's markup has it):
 * native browser constraint validation would block the form submit event
 * from ever firing for a negative value, which pre-empts the custom
 * "All fields must be non-negative numbers." message below and makes it
 * effectively dead code. The custom check is the actual validation UX here.
 *
 * Task 17: `onSubmit` now takes an optional second argument carrying the
 * server's PES object from the ingest response (`ManualIngestResponse['pes']`)
 * — CampaignAnalyticsView uses it as the gauge's authoritative headline score
 * instead of the client-recomputed one, falling back to the client
 * computation when it's absent (fixture runs, or a response with no `pes`).
 * KPI cards and the funnel still recompute client-side from the same input
 * via campaignMetrics.ts — only the PES headline is server-sourced now.
 */
import { useState } from 'react';
import type { FormEvent } from 'react';
import { BarChart3, Loader2 } from 'lucide-react';
import { DEFAULT_CAMPAIGN_INPUT } from '../../../services/fixtures/campaign';
import { apiClient } from '../../../services/apiClient';
import { ApiErrorPanel } from '../../shared/ApiErrorPanel';
import type { CampaignInput, ManualIngestPes } from '@/types';

const FIELDS: { key: keyof CampaignInput; label: string; hint: string }[] = [
  { key: 'impressions', label: 'Impressions', hint: 'Total ad impressions served' },
  { key: 'clicks', label: 'Clicks', hint: 'Total clicks on ads' },
  { key: 'adSpend', label: 'Ad spend (₱)', hint: 'Total spend in Philippine Pesos' },
  { key: 'revenue', label: 'Revenue (₱)', hint: 'Revenue attributed to the campaign' },
  { key: 'conversions', label: 'Conversions (leads)', hint: 'Enquiry form submissions' },
  { key: 'bookings', label: 'Bookings (sales)', hint: 'Confirmed bookings closed' },
  { key: 'newCustomers', label: 'New customers', hint: 'Net-new customers acquired' },
];

function initialValues(): Record<keyof CampaignInput, string> {
  const values = {} as Record<keyof CampaignInput, string>;
  FIELDS.forEach(({ key }) => {
    values[key] = String(DEFAULT_CAMPAIGN_INPUT[key]);
  });
  return values;
}

/**
 * The most recent complete Monday–Sunday week, as `YYYY-MM-DD` strings.
 *
 * Matches the cadence the seeded campaign records use (e.g. 2026-06-08 →
 * 2026-06-14), so manually-ingested rows sort and plot alongside them on the
 * history trend charts. A *complete* week is used rather than the current
 * partial one because each record represents a finished reporting period.
 */
function lastCompleteWeek(): { periodStart: string; periodEnd: string } {
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const today = new Date();
  // getDay(): 0=Sun … 6=Sat. Step back to the most recent Sunday; when today
  // IS Sunday, step back a further week so the period is genuinely complete.
  const daysSinceSunday = today.getDay();
  const end = new Date(today);
  end.setDate(today.getDate() - daysSinceSunday - (daysSinceSunday === 0 ? 7 : 0));
  const start = new Date(end);
  start.setDate(end.getDate() - 6);
  return { periodStart: iso(start), periodEnd: iso(end) };
}

export default function IngestionForm({
  onSubmit,
}: {
  onSubmit: (input: CampaignInput, serverPes?: ManualIngestPes) => void;
}) {
  const [values, setValues] = useState<Record<keyof CampaignInput, string>>(initialValues);
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<unknown | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const parsed = {} as CampaignInput;
    let bad = false;
    FIELDS.forEach(({ key }) => {
      const v = Number(values[key]);
      if (!(v >= 0) || Number.isNaN(v)) bad = true;
      parsed[key] = v;
    });

    if (bad) {
      setError('All fields must be non-negative numbers.');
      return;
    }

    setError(null);
    setSubmitError(null);
    setSubmitting(true);
    try {
      // Persists parsed (numeric) input + server-computed KPIs/PES to
      // tbl_campaign_records. The `pes` field is forwarded to onSubmit — see
      // the file-header note.
      //
      // periodStart/periodEnd matter: ManualIngestRequest accepts them, but the
      // form was omitting them, so every manually-ingested row persisted with
      // NULL dates and the history trend charts had nothing to plot against
      // (they rendered a degenerate "Jan 1–Jan 1" x-axis).
      const response = await apiClient.campaign.ingest({ ...parsed, ...lastCompleteWeek() });
      onSubmit(parsed, response.pes);
    } catch (err) {
      setSubmitError(err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="card" style={{ maxWidth: 760 }}>
      <div className="empty" style={{ padding: '0 0 var(--space-md)' }}>
        <h3>No campaign data found</h3>
        <p>Enter your campaign parameters below to generate analytics.</p>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-6 rounded-md border border-critical bg-critical-bg px-4 py-3 text-sm text-critical"
        >
          {error}
        </div>
      )}

      {submitError != null && (
        <div className="mb-6">
          <ApiErrorPanel error={submitError} label="Data ingestion" />
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))' }}
        >
          {FIELDS.map(({ key, label, hint }) => (
            <label key={key} className="field" style={{ marginBottom: 0 }}>
              <span className="field-label">{label}</span>
              <input
                className="input"
                type="number"
                step="any"
                required
                value={values[key]}
                onChange={(e) => setValues({ ...values, [key]: e.target.value })}
              />
              <span className="field-hint">{hint}</span>
            </label>
          ))}
        </div>

        <button type="submit" disabled={submitting} className="btn-primary mt-10 flex w-full items-center justify-center gap-2">
          {submitting ? (
            <>
              <Loader2 size={16} className="animate-spin" /> Computing analytics…
            </>
          ) : (
            <>
              <BarChart3 size={16} /> Generate campaign analytics
            </>
          )}
        </button>
      </form>
    </div>
  );
}
