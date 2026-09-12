/**
 * CARD — Foundation: Performance Shell & Ingestion
 * Depends on: Foundation — Shell & Routing, Foundation — Fixture Data Layer
 * Prototype reference: submitCampaign() / renderPerformance() entry state —
 * ui-ux-prototype.html:3918-3959, :4004-4038
 * Plan: docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/05-module-4.md (M4-F)
 * Task 16: submits to POST /api/analytics/manual instead of a fake local
 * delay — see docs/superpowers/plans/2026-08-29-frontend-backend-connection/.
 *
 * The 7-field campaign-input form. Field labels/hints are ported verbatim
 * from the prototype; visual treatment follows the tourism-app-branding
 * skill (.field/.input/.card, mint .btn-primary — this is an ordinary form
 * action, not a booking/money action or a wizard's forward step, so coral
 * .btn-cta doesn't apply here).
 *
 * Every field starts BLANK, not seeded from `DEFAULT_CAMPAIGN_INPUT`
 * (services/fixtures/campaign.ts). An earlier version of this file did seed
 * from it, on the reasoning that it was "a legitimate starting form state,
 * not fake data displayed as real" — but a real operator with a real
 * connected ad account has no way to distinguish "the form pre-filled a
 * plausible-looking revenue/bookings figure" from "I entered this," and can
 * submit it as their own real business data without ever having typed
 * anything. `DEFAULT_CAMPAIGN_INPUT` is fixture/test data (see
 * IngestionForm.adSync.test.tsx and CampaignAnalyticsView.test.tsx, which
 * fill fields with it explicitly) — it has no business seeding the live form.
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
import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { BarChart3, Loader2, RefreshCw } from 'lucide-react';
import { apiClient } from '../../../services/apiClient';
import { useAdConnections } from '../../../services/useAdConnections';
import { ApiErrorPanel } from '../../shared/ApiErrorPanel';
import type { AdCampaignOption, AdProvider, CampaignInput, ManualIngestPes } from '@/types';

/**
 * Which of the seven fields the ad platforms can actually fill.
 *
 * Revenue, bookings, and new customers are business facts no ad API knows —
 * they stay the operator's to enter. Prefilling them with zero would make ROAS
 * and CAC meaningless while looking authoritative.
 *
 * The two field lists below are grouped by this same split (syncable, then
 * manual) rather than the prototype's original interleaved order — grouping
 * has to be visible before any label is read, per the brand system's form
 * guidance, and it's what keeps an operator from mistaking a manual field for
 * one the sync button could have filled (see IngestionForm.tsx's header note
 * on the prior hardcoded-defaults bug this exact confusion came from).
 */
const SYNCABLE_FIELDS = ['impressions', 'clicks', 'adSpend', 'conversions'] as const;

function fieldsFor(currency: string): { key: keyof CampaignInput; label: string; hint: string }[] {
  return [
    { key: 'impressions', label: 'Impressions', hint: 'Total ad impressions served' },
    { key: 'clicks', label: 'Clicks', hint: 'Total clicks on ads' },
    { key: 'adSpend', label: `Ad spend (${currency})`, hint: `Total spend in ${currency}` },
    { key: 'conversions', label: 'Conversions (leads)', hint: 'Enquiry form submissions' },
    { key: 'revenue', label: `Revenue (${currency})`, hint: 'Revenue attributed to the campaign' },
    { key: 'bookings', label: 'Bookings (sales)', hint: 'Confirmed bookings closed' },
    { key: 'newCustomers', label: 'New customers', hint: 'Net-new customers acquired' },
  ];
}

/** Peso unless a connected ad account reports in something else. */
const DEFAULT_CURRENCY = '₱';

const PROVIDER_LABELS: Record<AdProvider, string> = { meta: 'Meta', tiktok: 'TikTok' };

/** Scope-select value meaning "leave this ad account out of this analysis". */
const EXCLUDE = '__none__';

function initialValues(): Record<keyof CampaignInput, string> {
  const values = {} as Record<keyof CampaignInput, string>;
  fieldsFor(DEFAULT_CURRENCY).forEach(({ key }) => {
    values[key] = '';
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
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY);
  const fields = useMemo(() => fieldsFor(currency), [currency]);

  const { connections, refresh: refreshConnections } = useAdConnections();
  const activeConnections = useMemo(
    () => (connections ?? []).filter((c) => c.status === 'ACTIVE'),
    [connections],
  );
  const hasActive = activeConnections.length > 0;

  const [syncing, setSyncing] = useState(false);
  const [syncNote, setSyncNote] = useState<string | null>(null);
  const [syncedKeys, setSyncedKeys] = useState<string[]>([]);

  /** Loaded campaign lists per provider (for the scope selects). */
  const [campaignOptions, setCampaignOptions] = useState<
    Partial<Record<AdProvider, AdCampaignOption[]>>
  >({});
  /** The scope select's value per provider: a campaign id, or '' for whole account. */
  const [scope, setScope] = useState<Partial<Record<AdProvider, string>>>({});

  // Seed each select from the connection's saved campaign, and fetch that
  // account's campaigns so the operator can change it. Keyed on the active
  // providers so it re-runs when a connection flips to ACTIVE.
  const activeKey = activeConnections.map((c) => c.provider).join(',');
  useEffect(() => {
    let cancelled = false;
    setScope((current) => {
      const next = { ...current };
      for (const c of activeConnections) {
        if (next[c.provider] === undefined) next[c.provider] = c.campaignId ?? '';
      }
      return next;
    });
    for (const c of activeConnections) {
      if (campaignOptions[c.provider] !== undefined) continue;
      apiClient.adConnections
        .campaigns(c.provider)
        .then((list) => { if (!cancelled) setCampaignOptions((o) => ({ ...o, [c.provider]: list })); })
        .catch(() => { if (!cancelled) setCampaignOptions((o) => ({ ...o, [c.provider]: [] })); });
    }
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey]);

  /**
   * Pulls the same period the form submits, so the synced figures and the
   * persisted campaign record describe the same week. Any scope the operator
   * changed is persisted first (it becomes the default for next time), then the
   * sync reads the now-current scope.
   */
  const included = useMemo(
    () => activeConnections.filter((c) => (scope[c.provider] ?? '') !== EXCLUDE),
    [activeConnections, scope],
  );

  async function syncFromAdAccounts() {
    setSyncing(true);
    setSyncNote(null);
    try {
      if (included.length === 0) {
        setSyncNote('Choose at least one ad account to sync from.');
        return;
      }

      const scopeChanges = included.filter(
        (c) => (scope[c.provider] ?? '') !== (c.campaignId ?? ''),
      );
      if (scopeChanges.length > 0) {
        await Promise.all(
          scopeChanges.map((c) =>
            apiClient.adConnections.selectCampaign(c.provider, scope[c.provider] || null),
          ),
        );
        await refreshConnections();
      }

      const { periodStart, periodEnd } = lastCompleteWeek();
      const providerFilter =
        included.length === activeConnections.length
          ? undefined
          : included.map((c) => c.provider);
      const summary = await apiClient.adConnections.insights(
        periodStart,
        periodEnd,
        providerFilter,
      );

      if (summary.warnings.length > 0) {
        setSyncNote(summary.warnings.join(' '));
      }

      // Totals are withheld on a currency mismatch — prefilling from a partial
      // response would be worse than not prefilling at all.
      if (summary.impressions == null) {
        return;
      }

      setValues((current) => ({
        ...current,
        impressions: String(summary.impressions ?? current.impressions),
        clicks: String(summary.clicks ?? current.clicks),
        adSpend: String(summary.spend ?? current.adSpend),
        conversions: String(summary.conversions ?? current.conversions),
      }));
      setSyncedKeys([...SYNCABLE_FIELDS]);
      if (summary.currency) setCurrency(summary.currency);
      if (summary.warnings.length === 0) {
        const names = summary.sources.map((s) =>
          s.campaignName
            ? `${PROVIDER_LABELS[s.provider]} (${s.campaignName})`
            : PROVIDER_LABELS[s.provider],
        );
        setSyncNote(`Filled from ${names.join(' and ')}`);
      }
    } catch (err) {
      console.error('Ad account sync failed', err);
      setSyncNote('Could not sync from your ad accounts. Enter the figures manually.');
    } finally {
      setSyncing(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const parsed = {} as CampaignInput;
    let bad = false;
    fields.forEach(({ key }) => {
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

  const syncableFields = fields.filter(({ key }) => (SYNCABLE_FIELDS as readonly string[]).includes(key));
  const manualFields = fields.filter(({ key }) => !(SYNCABLE_FIELDS as readonly string[]).includes(key));

  function renderField({ key, label, hint }: { key: keyof CampaignInput; label: string; hint: string }) {
    return (
      <label key={key} className="field" style={{ marginBottom: 0 }}>
        <span className="field-label">
          {label}
          {syncedKeys.includes(key) && <span className="badge badge--teal">synced</span>}
        </span>
        <input
          className="input"
          type="number"
          step="any"
          required
          value={values[key]}
          onChange={(e) => {
            setValues({ ...values, [key]: e.target.value });
            setSyncedKeys((keys) => keys.filter((k) => k !== key));
          }}
        />
        <span className="field-hint">{hint}</span>
      </label>
    );
  }

  return (
    <div className="card" style={{ maxWidth: 760 }}>
      <div className="mb-10">
        <h3 className="heading-sm">Log this week's campaign performance</h3>
        <p className="body-sm mt-3">
          Sync what your ad platforms already know, then add the figures only you have —
          revenue, bookings, and new customers.
        </p>
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
        <div className="mb-10">
          <h4 className="body-sm mb-3" style={{ fontWeight: 600, color: 'var(--color-text-heading)' }}>
            From your ad accounts
          </h4>

          {hasActive ? (
            <div
              className="mb-4 flex flex-col gap-4 rounded-[var(--radius-md)] p-4"
              style={{ background: 'var(--color-mint-pale)' }}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="body-xs text-[var(--color-text-body)]">
                  Pull last week&rsquo;s impressions, clicks, spend, and conversions from your
                  connected {activeConnections.length > 1 ? 'ad accounts' : 'ad account'}.
                </p>
                <button
                  type="button"
                  className="btn-outline btn-outline--sm shrink-0"
                  onClick={syncFromAdAccounts}
                  disabled={syncing || included.length === 0}
                >
                  <RefreshCw
                    className={syncing ? 'animate-spin' : ''}
                    size={14}
                    aria-hidden="true"
                  />
                  {syncing ? 'Syncing…' : 'Sync from ad accounts'}
                </button>
              </div>

              <div
                className="grid gap-3"
                style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}
              >
                {activeConnections.map((c) => (
                  <label key={c.provider} className="block">
                    <span className="field-label">{PROVIDER_LABELS[c.provider]} campaign</span>
                    <select
                      className="input"
                      aria-label={`${PROVIDER_LABELS[c.provider]} campaign`}
                      value={scope[c.provider] ?? ''}
                      disabled={syncing}
                      onChange={(e) =>
                        setScope((s) => ({ ...s, [c.provider]: e.target.value }))
                      }
                    >
                      <option value={EXCLUDE}>Don&rsquo;t include</option>
                      <option value="">Whole account</option>
                      {(campaignOptions[c.provider] ?? []).map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.name ?? opt.id}
                          {opt.status && opt.status !== 'ACTIVE' && opt.status !== 'ENABLE'
                            ? ` (${opt.status.toLowerCase()})`
                            : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>

              {syncNote && (
                <p
                  className="body-xs rounded-md px-3 py-2"
                  style={{ background: 'var(--color-white)', color: 'var(--color-navy-primary)' }}
                >
                  {syncNote}
                </p>
              )}
            </div>
          ) : (
            <p className="body-xs text-[var(--color-text-muted)] mb-4">
              Connect a Meta or TikTok Ads account in Settings → Platforms to fill these
              automatically, or enter them yourself below.
            </p>
          )}

          <div
            className="grid gap-3"
            style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))' }}
          >
            {syncableFields.map(renderField)}
          </div>
        </div>

        <div>
          <h4
            className="body-sm mb-3"
            style={{ fontWeight: 600, color: 'var(--color-text-heading)' }}
          >
            You provide these
          </h4>
          <div
            className="grid gap-3"
            style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))' }}
          >
            {manualFields.map(renderField)}
          </div>
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
