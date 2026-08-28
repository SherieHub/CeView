/**
 * CARD — Foundation: Performance Shell & Ingestion
 * Depends on: Foundation — Shell & Routing, Foundation — Fixture Data Layer
 * Prototype reference: submitCampaign() / renderPerformance() entry state —
 * ui-ux-prototype.html:3918-3959, :4004-4038
 * Plan: docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/05-module-4.md (M4-F)
 *
 * The 7-field campaign-input form. Field labels/hints/defaults and the
 * 1200ms "Computing analytics…" delay are ported verbatim from the
 * prototype for behavioral parity; visual treatment follows the
 * tourism-app-branding skill (.field/.input/.card, mint .btn-primary — this
 * is an ordinary form action, not a booking/money action or a wizard's
 * forward step, so coral .btn-cta doesn't apply here).
 *
 * Deliberately no `min={0}` on the inputs (the prototype's markup has it):
 * native browser constraint validation would block the form submit event
 * from ever firing for a negative value, which pre-empts the custom
 * "All fields must be non-negative numbers." message below and makes it
 * effectively dead code. The custom check is the actual validation UX here.
 */
import { useState } from 'react';
import type { FormEvent } from 'react';
import { BarChart3, Loader2 } from 'lucide-react';
import { DEFAULT_CAMPAIGN_INPUT } from '../../../services/fixtures/campaign';
import type { CampaignInput } from '../../../services/fixtures/campaign';

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

export default function IngestionForm({ onSubmit }: { onSubmit: (input: CampaignInput) => void }) {
  const [values, setValues] = useState<Record<keyof CampaignInput, string>>(initialValues);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function handleSubmit(e: FormEvent) {
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
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      onSubmit(parsed);
    }, 1200);
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
