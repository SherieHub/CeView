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
import { BarChart3, Gauge, Loader2, RefreshCw, Sparkles, TrendingUp, Workflow } from 'lucide-react';
import { apiClient } from '../../../services/apiClient';
import { useAdConnections } from '../../../services/useAdConnections';
import { ApiErrorPanel } from '../../shared/ApiErrorPanel';
import DateRangePicker from './DateRangePicker';
import { formatPeriod, lastCompleteWeek, weekToDate } from './dateRange';
import type { Period } from './dateRange';
import type { AdCampaignOption, AdInsightSummary, AdProvider, CampaignInput, ManualIngestPes } from '@/types';

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

/** True when every ad-platform total is zero — the platform had nothing to report. */
function hasNoDelivery(summary: AdInsightSummary): boolean {
  return [summary.impressions, summary.clicks, summary.spend, summary.conversions].every(
    (v) => Number(v ?? 0) === 0,
  );
}

/** What the submitted record covered — lets the results view say which dates and currency it shows. */
export interface SubmissionContext {
  period: Period;
  currency: string;
}

/**
 * One numbered step of the form. The numbers give the form a visible order
 * (dates → what the ad platforms know → what only the operator knows) before
 * any label is read, which the flat single-card layout didn't.
 */
function StepHead({ n, id, title, description }: { n: number; id: string; title: string; description: string }) {
  return (
    <>
      <span className="perf-step-num" aria-hidden="true">{n}</span>
      <div className="perf-step-head">
        <h2 id={id} className="heading-sm">{title}</h2>
        <p className="body-xs mt-1">{description}</p>
      </div>
    </>
  );
}

/** What a submission produces — shown beside the form so the effort has a visible payoff. */
const OUTCOMES = [
  { icon: Gauge, title: 'Performance score', text: 'One 0–1 score weighted across five KPIs.' },
  { icon: Workflow, title: 'Customer journey', text: 'Where people drop off between impression and booking.' },
  { icon: TrendingUp, title: 'Trends', text: 'This period plotted against your earlier ones.' },
  { icon: Sparkles, title: 'AI action plan', text: 'The fixes most likely to move your weakest stage.' },
];

export default function IngestionForm({
  onSubmit,
}: {
  onSubmit: (input: CampaignInput, serverPes?: ManualIngestPes, context?: SubmissionContext) => void;
}) {
  const [values, setValues] = useState<Record<keyof CampaignInput, string>>(initialValues);
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<unknown | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY);
  const fields = useMemo(() => fieldsFor(currency), [currency]);

  /**
   * The reporting period this record covers. Defaults to the last complete
   * week; the operator can pick any past range on the calendar. The sync and
   * the submitted record both read it, so the synced figures and the persisted
   * campaign record always describe the same dates.
   */
  const [period, setPeriod] = useState<Period>(() => lastCompleteWeek());

  const { connections, refresh: refreshConnections } = useAdConnections();
  const activeConnections = useMemo(
    () => (connections ?? []).filter((c) => c.status === 'ACTIVE'),
    [connections],
  );
  const hasActive = activeConnections.length > 0;

  const [syncing, setSyncing] = useState(false);
  const [syncNote, setSyncNote] = useState<string | null>(null);
  const [syncedKeys, setSyncedKeys] = useState<string[]>([]);

  // "Live this week" — a read-only, separate preview of the still-open
  // week. Never written into `values`/`setSyncedKeys`; see syncLiveTotals().
  const [liveSummary, setLiveSummary] = useState<AdInsightSummary | null>(null);
  const [liveSyncing, setLiveSyncing] = useState(false);
  const [liveNote, setLiveNote] = useState<string | null>(null);

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

  // Computed once per render rather than inside the JSX so the live panel's
  // header label and syncLiveTotals()'s actual fetch always agree on "today."
  const livePeriodLabel = useMemo(() => `${formatPeriod(weekToDate())} so far`, []);

  /** Figures synced for one period don't describe another — drop the badges and say so. */
  function changePeriod(next: Period) {
    setPeriod(next);
    if (syncedKeys.length > 0) {
      setSyncedKeys([]);
      setSyncNote('Reporting period changed — sync again to pull figures for the new dates.');
    }
  }

  /**
   * Pulls the selected reporting period — the same one the form submits. Any
   * scope the operator changed is persisted first (it becomes the default for
   * next time), then the sync reads the now-current scope.
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

      const { periodStart, periodEnd } = period;
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

      const names = summary.sources.map((s) =>
        s.campaignName
          ? `${PROVIDER_LABELS[s.provider]} (${s.campaignName})`
          : PROVIDER_LABELS[s.provider],
      );

      // A platform answers a window with no delivery with no rows at all,
      // which the backend reports as zeros. Filling those in as "synced" read
      // like a broken sync — say what actually happened and leave the fields.
      if (hasNoDelivery(summary)) {
        setSyncedKeys([]);
        const noDelivery =
          `No ad delivery for ${names.length > 0 ? names.join(' and ') : 'your ad accounts'} ` +
          `on ${formatPeriod(period)}. Pick dates when the campaign was running, or enter the ` +
          'figures yourself.';
        setSyncNote([...summary.warnings, noDelivery].join(' '));
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
        setSyncNote(`Filled from ${names.join(' and ')}`);
      }
    } catch (err) {
      console.error('Ad account sync failed', err);
      setSyncNote('Could not sync from your ad accounts. Enter the figures manually.');
    } finally {
      setSyncing(false);
    }
  }

  /**
   * Pulls the current, still-open week's metrics — read-only. Shares
   * `included`/`scope` with the weekly sync (same accounts, different
   * window), but its result only ever lands in `liveSummary`, never in
   * `values` — a partial week must never become the submitted record.
   *
   * Note: the backend caches every insights() call as one `ad_insights` row
   * keyed by (profile, provider, periodStart, periodEnd). Since periodEnd
   * here is "today", repeated live refreshes across a week accumulate a
   * handful of extra cache rows — harmless, since nothing else in the
   * codebase reads that table today.
   */
  async function syncLiveTotals() {
    setLiveSyncing(true);
    setLiveNote(null);
    try {
      if (included.length === 0) {
        setLiveNote('Choose at least one ad account to sync from.');
        return;
      }

      const { periodStart, periodEnd } = weekToDate();
      const providerFilter =
        included.length === activeConnections.length
          ? undefined
          : included.map((c) => c.provider);
      const summary = await apiClient.adConnections.insights(
        periodStart,
        periodEnd,
        providerFilter,
      );

      setLiveSummary(summary);
      if (summary.warnings.length > 0) {
        setLiveNote(summary.warnings.join(' '));
      }
    } catch (err) {
      console.error('Live ad account sync failed', err);
      setLiveNote('Could not fetch live totals. Try again.');
    } finally {
      setLiveSyncing(false);
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
      const response = await apiClient.campaign.ingest({ ...parsed, ...period });
      onSubmit(parsed, response.pes, { period, currency });
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

  const multipleAccounts = activeConnections.length > 1;

  return (
    <div className="perf-entry">
      <div className="card perf-form-card">
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
          <section className="perf-step" aria-labelledby="perf-step-period">
            <StepHead
              n={1}
              id="perf-step-period"
              title="Reporting period"
              description="The dates this record covers. Syncing pulls figures for exactly these dates."
            />
            <div className="perf-step-body" style={{ maxWidth: 360 }}>
              <DateRangePicker value={period} onChange={changePeriod} disabled={syncing || submitting} />
            </div>
          </section>

          <section className="perf-step" aria-labelledby="perf-step-ads">
            <StepHead
              n={2}
              id="perf-step-ads"
              title="Ad platform figures"
              description={
                hasActive
                  ? `Sync ${formatPeriod(period)} from your connected ${multipleAccounts ? 'ad accounts' : 'ad account'}, or type the figures in.`
                  : 'Type these in from your ads dashboard — or connect a Meta or TikTok Ads account in Settings → Platforms to fill them automatically.'
              }
            />
            <div className="perf-step-body flex flex-col gap-5">
              {hasActive && (
                <div
                  className="flex flex-col gap-3 rounded-[var(--radius-md)] p-4"
                  style={{ background: 'var(--color-mint-pale)' }}
                >
                  <div className="flex flex-wrap items-end gap-3">
                    {activeConnections.map((c) => (
                      <label key={c.provider} className="block min-w-[200px] flex-1">
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
                    <button
                      type="button"
                      className="btn-outline perf-sync-btn shrink-0"
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

                  {syncNote && (
                    <p
                      role="status"
                      className="body-xs rounded-md px-3 py-2"
                      style={{ background: 'var(--color-white)', color: 'var(--color-navy-primary)' }}
                    >
                      {syncNote}
                    </p>
                  )}
                </div>
              )}

              <div className="perf-field-grid perf-field-grid--4">{syncableFields.map(renderField)}</div>
            </div>
          </section>

          <section className="perf-step" aria-labelledby="perf-step-business">
            <StepHead
              n={3}
              id="perf-step-business"
              title="Your business results"
              description="Only you know these — ad platforms can't see revenue, bookings, or new customers."
            />
            <div className="perf-step-body">
              <div className="perf-field-grid perf-field-grid--3">{manualFields.map(renderField)}</div>
            </div>
          </section>

          <div className="perf-submit">
            <p className="body-xs">
              Scores this period and drafts an AI action plan — usually takes a few seconds.
            </p>
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary flex items-center justify-center gap-2"
            >
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
          </div>
        </form>
      </div>

      <aside className="perf-aside" aria-label="About this form">
        {hasActive && (
          <section className="card flex flex-col gap-4" aria-labelledby="perf-live-head">
            <div>
              <p className="eyebrow">In progress</p>
              <h2 id="perf-live-head" className="heading-sm mt-1">This week so far</h2>
              <p className="body-xs">{livePeriodLabel}</p>
            </div>

            {liveNote && (
              <p
                className="body-xs rounded-md px-3 py-2"
                style={{ background: 'var(--color-mint-pale-alt)', color: 'var(--color-navy-primary)' }}
              >
                {liveNote}
              </p>
            )}

            {liveSummary && liveSummary.impressions != null && hasNoDelivery(liveSummary) && (
              <p className="body-sm">No ad delivery yet this week.</p>
            )}

            {liveSummary && liveSummary.impressions != null && !hasNoDelivery(liveSummary) && (
              <div className="grid grid-cols-2 gap-2">
                {([
                  { label: 'Impressions', value: liveSummary.impressions },
                  { label: 'Clicks', value: liveSummary.clicks },
                  { label: `Ad spend (${liveSummary.currency ?? currency})`, value: liveSummary.spend },
                  { label: 'Conversions', value: liveSummary.conversions },
                ] as const).map(({ label, value }) => (
                  <div
                    key={label}
                    className="rounded-[var(--radius-sm)] px-3 py-2"
                    style={{ background: 'var(--color-mint-pale-alt)' }}
                  >
                    <div className="body-xs">{label}</div>
                    <div className="num body-sm" style={{ fontWeight: 600, color: 'var(--color-text-heading)' }}>
                      {value}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <button
              type="button"
              className="btn-outline btn-outline--sm self-start"
              onClick={syncLiveTotals}
              disabled={liveSyncing || included.length === 0}
            >
              <RefreshCw
                className={liveSyncing ? 'animate-spin' : ''}
                size={14}
                aria-hidden="true"
              />
              {liveSyncing ? 'Refreshing…' : 'Refresh live totals'}
            </button>

            <p className="body-xs">A preview only — this week joins a report once it ends.</p>
          </section>
        )}

        <section className="card flex flex-col gap-4" aria-labelledby="perf-outcomes-head">
          <h2 id="perf-outcomes-head" className="heading-sm">What you&rsquo;ll get</h2>
          <ul className="flex flex-col gap-4">
            {OUTCOMES.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex items-start gap-3">
                <span className="perf-outcome-icon" aria-hidden="true">
                  <Icon size={16} />
                </span>
                <span>
                  <span className="block body-xs" style={{ fontWeight: 600, color: 'var(--color-text-heading)' }}>
                    {title}
                  </span>
                  <span className="block body-xs">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      </aside>
    </div>
  );
}
