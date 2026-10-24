/**
 * CARD — Foundation: Performance Shell & Ingestion
 * Depends on: Foundation — Shell & Routing, Foundation — Fixture Data Layer
 * Prototype reference: renderPerformance() + submitCampaign() + computeMetrics() +
 * computePes() — ui-ux-prototype.html:3882-3910, :3796-3837, :3760-3794
 * Plan: docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/05-module-4.md (M4-F)
 *
 * The `/performance` shell: entry <-> full-view transition, submitted-campaign
 * state, and the metrics/PES computation every sibling card renders from.
 * Composes 9 slot components by fixed import path — all still stub
 * placeholders except IngestionForm (this card's own).
 *
 * Results are six real tabs (Overview, AI Action Plan, Customer Journey,
 * Trends, Attribution, Published Posts), one panel at a time; data is
 * fetched once per submission and shared across them.
 *
 * The 4/8-week toggle is NOT rendered here. Per the Trend Charts card's own
 * text ("this card only owns the toggle control and rendering"), that
 * control lives inside PesTrendChart.tsx (M4-4) — this shell only owns the
 * `weeks` state and re-slices `history` when it changes, passing
 * weeks/onWeeksChange down to the trend-chart slots per TrendSlotProps.
 */
import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { RotateCcw } from 'lucide-react';
import { apiClient } from '../../../services/apiClient';
import PageHead from '../../../layout/PageHead';
import type { CampaignInput, CampaignHistoryEntry, ManualIngestPes, PrescriptiveReport } from '@/types';
import { computeMetrics, computePes } from './campaignMetrics';
import IngestionForm from './IngestionForm';
import type { SubmissionContext } from './IngestionForm';
import { formatPeriod } from './dateRange';
import CustomerJourneyFunnel from './CustomerJourneyFunnel';
import PesTrendChart from './PesTrendChart';
import EfficiencyTrendChart from './EfficiencyTrendChart';
import CostTrendChart from './CostTrendChart';
import AiActionPlan from './AiActionPlan';
import PreviouslyPublished from './PreviouslyPublished';
import AttributionEvidenceSection from './AttributionEvidenceSection';
import PerformanceOverview, { ReportState, isReportPopulated } from './PerformanceOverview';
import type { ResultsTab } from './PerformanceOverview';
import './performance.css';

/** Windows the shared trend-window toggle offers; governs all three charts. */
const WEEK_OPTIONS: (4 | 8)[] = [4, 8];

/** The results tabs, in reading order: the answer, then what to do, then the evidence. */
const TABS: { id: ResultsTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'plan', label: 'AI Action Plan' },
  { id: 'journey', label: 'Customer Journey' },
  { id: 'trends', label: 'Trends' },
  { id: 'attribution', label: 'Attribution' },
  { id: 'posts', label: 'Published Posts' },
];

type TrendView = 'performance' | 'efficiency' | 'costs';
const TREND_VIEWS: { id: TrendView; label: string }[] = [
  { id: 'performance', label: 'Performance' },
  { id: 'efficiency', label: 'Efficiency' },
  { id: 'costs', label: 'Costs' },
];

/** The form tracks a display symbol ("₱") until a sync reports an ISO code ("PHP", "USD"). */
function currencyPrefix(currency: string | undefined): string {
  if (!currency || currency === 'PHP') return '₱';
  return currency.length === 3 ? `${currency} ` : currency;
}

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

/**
 * Real tabs, not in-page anchors: one panel at a time. Arrow keys move
 * between tabs (the ARIA tabs pattern), Home/End jump to the ends.
 */
function ResultsTabs({ active, onChange }: { active: ResultsTab; onChange: (tab: ResultsTab) => void }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = TABS.length - 1;
    const next =
      e.key === 'ArrowRight' ? (index === last ? 0 : index + 1)
        : e.key === 'ArrowLeft' ? (index === 0 ? last : index - 1)
          : e.key === 'Home' ? 0
            : e.key === 'End' ? last
              : null;
    if (next === null) return;
    e.preventDefault();
    onChange(TABS[next].id);
    refs.current[next]?.focus();
  }
  return (
    <div className="perf-tabs" role="tablist" aria-label="Results sections">
      {TABS.map((tab, i) => (
        <button
          key={tab.id}
          ref={(el) => { refs.current[i] = el; }}
          type="button"
          role="tab"
          id={`perf-tab-${tab.id}`}
          aria-selected={active === tab.id}
          aria-controls={`perf-panel-${tab.id}`}
          tabIndex={active === tab.id ? 0 : -1}
          onClick={() => onChange(tab.id)}
          onKeyDown={(e) => onKeyDown(e, i)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export default function CampaignAnalyticsView({ initialSubmission }: {
  /** Opens on these results — the public demo starts on a sample week. */
  initialSubmission?: { input: CampaignInput; context: SubmissionContext };
} = {}) {
  const [campaign, setCampaign] = useState<CampaignInput | null>(initialSubmission?.input ?? null);
  const [serverPes, setServerPes] = useState<ManualIngestPes | null>(null);
  const [context, setContext] = useState<SubmissionContext | null>(initialSubmission?.context ?? null);
  const [weeks, setWeeks] = useState<4 | 8>(4);
  const [history, setHistory] = useState<CampaignHistoryEntry[] | null>(null);
  const [report, setReport] = useState<PrescriptiveReport | null>(null);
  const [error, setError] = useState<unknown | null>(null);
  const [tab, setTab] = useState<ResultsTab>('overview');
  const [trendView, setTrendView] = useState<TrendView>('performance');

  useEffect(() => {
    if (!campaign) return;
    let cancelled = false;
    setError(null);

    // Fetched once per submission and held here, so switching tabs never
    // refetches or resets what another tab already loaded.
    // Eight periods, the widest window the toggle offers; 4WK slices them.
    // Without the argument the backend sent four, so 8WK could show no more.
    apiClient.campaign
      .history(8)
      .then((h) => { if (!cancelled) setHistory(h); })
      .catch((e) => { if (!cancelled) setError(e); });

    apiClient.campaign
      .report()
      .then((r) => { if (!cancelled) setReport(r); })
      .catch((e) => { if (!cancelled) setError(e); });

    return () => { cancelled = true; };
  }, [campaign]);

  function handleNewSubmission() {
    setCampaign(null);
    setServerPes(null);
    setContext(null);
    setHistory(null);
    setReport(null);
    setError(null);
    setWeeks(4);
    setTab('overview');
    setTrendView('performance');
    window.scrollTo?.({ top: 0 });
  }

  function handleCampaignSubmit(input: CampaignInput, pes?: ManualIngestPes, ctx?: SubmissionContext) {
    setServerPes(pes ?? null);
    setContext(ctx ?? null);
    setCampaign(input);
    setTab('overview');
    window.scrollTo?.({ top: 0 });
  }

  if (!campaign) {
    return (
      <div className="perf-screen perf-screen--entry flex flex-col gap-8">
        <PageHead
          title="Log campaign performance"
          subtitle="Sync what your ad platforms already know, then add the figures only you have — revenue, bookings, and new customers."
        />
        <IngestionForm onSubmit={handleCampaignSubmit} />
        {/* Link evidence is readable before any weekly submission: a tracked
            enquiry should not wait on the form. After it, so the page head
            still introduces the form it describes. */}
        <AttributionEvidenceSection />
      </div>
    );
  }

  const { metrics, flagged } = computeMetrics(campaign);
  const clientPes = computePes(metrics);
  const score = serverPes?.overallScore ?? clientPes.score;
  const label = serverPes?.label ?? clientPes.label;
  const windowSlice = (history ?? []).slice(-weeks);
  const money = currencyPrefix(context?.currency);
  const periodLabel = context ? formatPeriod(context.period) : null;

  // What the header can honestly say: the score is computed; the plan is
  // whatever state its request is actually in.
  const planStatus =
    error != null ? { tone: 'warn', text: 'AI plan unavailable' }
      : report === null ? { tone: 'busy', text: 'AI plan loading' }
        : isReportPopulated(report) ? { tone: 'ok', text: 'Analysis ready' }
          : { tone: 'warn', text: 'AI plan empty' };

  const windowCaption = windowSlice.length
    ? `${shortDate(windowSlice[0].periodStart)} – ${shortDate(windowSlice[windowSlice.length - 1].periodEnd)} · your ${windowSlice.length} most recent saved period${windowSlice.length === 1 ? '' : 's'}`
    : null;

  return (
    <div className="perf-screen perf-screen--results">
      <PageHead
        eyebrow={periodLabel ? `Results · ${periodLabel}` : 'Results'}
        title="Campaign Performance"
        subtitle="See how your marketing performed, what worked, and where to improve."
        actions={
          <>
            <span className="perf-status" data-tone={planStatus.tone} role="status">{planStatus.text}</span>
            <button type="button" onClick={handleNewSubmission} className="perf-new">
              <RotateCcw size={14} aria-hidden="true" /> New submission
            </button>
          </>
        }
      />

      <ResultsTabs active={tab} onChange={setTab} />

      <div
        className="perf-panel"
        role="tabpanel"
        id={`perf-panel-${tab}`}
        aria-labelledby={`perf-tab-${tab}`}
        tabIndex={0}
      >
        {tab === 'overview' && (
          <PerformanceOverview
            score={score}
            label={label}
            metrics={metrics}
            flagged={flagged}
            money={money}
            periodLabel={periodLabel}
            report={report}
            error={error}
            trendWindow={windowSlice}
            onOpenTab={setTab}
          />
        )}

        {tab === 'plan' && (
          isReportPopulated(report) ? (
            <AiActionPlan report={report as PrescriptiveReport} />
          ) : (
            <div className="card perf-plan-state"><ReportState report={report} error={error} /></div>
          )
        )}

        {tab === 'journey' && <CustomerJourneyFunnel input={campaign} />}

        {tab === 'trends' && (
          <section className="perf-trends" aria-labelledby="perf-trends-head">
            <div className="perf-trends-head">
              <div>
                <h2 id="perf-trends-head" className="perf-tab-title">Trends over time</h2>
                <p className="perf-tab-sub">{windowCaption ?? 'How your results change from one saved period to the next.'}</p>
              </div>
              <div className="perf-trends-controls">
                <div role="group" aria-label="Chart" className="perf-seg">
                  {TREND_VIEWS.map((v) => (
                    <button key={v.id} type="button" aria-pressed={trendView === v.id} onClick={() => setTrendView(v.id)}>
                      {v.label}
                    </button>
                  ))}
                </div>
                <div role="group" aria-label="Trend window" className="perf-seg">
                  {WEEK_OPTIONS.map((option) => (
                    <button key={option} type="button" aria-pressed={weeks === option} onClick={() => setWeeks(option)}>
                      {option}WK
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {history !== null && windowSlice.length === 0 ? (
              <div className="card perf-plan-state">
                <p className="ov-muted">No saved periods yet — trends appear once you have logged more than one.</p>
              </div>
            ) : trendView === 'performance' ? (
              <PesTrendChart window={windowSlice} />
            ) : trendView === 'efficiency' ? (
              <EfficiencyTrendChart window={windowSlice} />
            ) : (
              <CostTrendChart window={windowSlice} />
            )}
          </section>
        )}

        {tab === 'attribution' && <AttributionEvidenceSection layout="tab" period={context?.period} />}

        {tab === 'posts' && <PreviouslyPublished />}
      </div>
    </div>
  );
}
