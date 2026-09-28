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
 * The 4/8-week toggle is NOT rendered here. Per the Trend Charts card's own
 * text ("this card only owns the toggle control and rendering"), that
 * control lives inside PesTrendChart.tsx (M4-4) — this shell only owns the
 * `weeks` state and re-slices `history` when it changes, passing
 * weeks/onWeeksChange down to the trend-chart slots per TrendSlotProps.
 */
import { useEffect, useRef, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { apiClient } from '../../../services/apiClient';
import { ApiErrorPanel } from '../../shared/ApiErrorPanel';
import PageHead from '../../../layout/PageHead';
import type { CampaignInput, CampaignHistoryEntry, ManualIngestPes, PrescriptiveReport } from '@/types';
import { computeMetrics, computePes } from './campaignMetrics';
import type { Metrics } from './campaignTypes';
import IngestionForm from './IngestionForm';
import type { SubmissionContext } from './IngestionForm';
import { formatPeriod } from './dateRange';
import KpiCard from './KpiCard';
import FlaggedMetricBanner from './FlaggedMetricBanner';
import PesGauge from './PesGauge';
import CustomerJourneyFunnel from './CustomerJourneyFunnel';
import PesTrendChart from './PesTrendChart';
import EfficiencyTrendChart from './EfficiencyTrendChart';
import CostTrendChart from './CostTrendChart';
import AiActionPlan from './AiActionPlan';
import PreviouslyPublished from './PreviouslyPublished';
import AttributionEvidenceSection from './AttributionEvidenceSection';

/**
 * Per pseudocode/module-4/kpi-cards.ts: KpiCard takes {label, value} per
 * metric, not the KpiSlotProps bundle — the shell mounts 5 instances, one
 * per metric, deriving each one's props from `metrics` here.
 *
 * Ordered by weight in the Performance Score (ARCHITECTURE_SPEC.md §4.2, the
 * same weights PesGauge's contribution breakdown shows) so the row reads
 * "what moved the score most" first. Each carries its spelled-out name and
 * unit: a bare "CAC 344.29" meant nothing to an operator who doesn't speak
 * ad-industry acronyms.
 */
const KPI_CARD_SPECS: {
  label: string;
  key: keyof Metrics;
  name: string;
  weightPct: number;
  unit: 'currency' | '%' | '×';
  hint: (currency: string) => string;
}[] = [
  { label: 'ROAS', key: 'roas', name: 'Return on ad spend', weightPct: 35, unit: '×',
    hint: (c) => `Revenue earned for every ${c}1 spent on ads.` },
  { label: 'CR', key: 'convRate', name: 'Conversion rate', weightPct: 30, unit: '%',
    hint: () => 'Bookings per 100 ad clicks.' },
  { label: 'CAC', key: 'cac', name: 'Customer acquisition cost', weightPct: 15, unit: 'currency',
    hint: () => 'Ad spend per new customer — lower is better.' },
  { label: 'CTR', key: 'ctr', name: 'Click-through rate', weightPct: 15, unit: '%',
    hint: () => 'Clicks per 100 people who saw the ad.' },
  { label: 'CPC', key: 'cpc', name: 'Cost per click', weightPct: 5, unit: 'currency',
    hint: () => 'What each ad click cost — lower is better.' },
];

/** Windows the shared trend-window toggle offers; governs all three charts. */
const WEEK_OPTIONS: (4 | 8)[] = [4, 8];

/** In-page destinations for the section nav, in page order. */
const SECTIONS = [
  { id: 'perf-score', label: 'Score' },
  { id: 'perf-plan', label: 'Action plan' },
  { id: 'perf-attribution', label: 'Attribution' },
  { id: 'perf-funnel', label: 'Funnel' },
  { id: 'perf-trends', label: 'Trends' },
  { id: 'perf-posts', label: 'Published posts' },
] as const;

/** The form tracks a display symbol ("₱") until a sync reports an ISO code ("PHP", "USD"). */
function currencyPrefix(currency: string | undefined): string {
  if (!currency || currency === 'PHP') return '₱';
  return currency.length === 3 ? `${currency} ` : currency;
}

/**
 * The report endpoint can answer 200 with an empty object: FastAPI's
 * /internal/report/generate returns {} on success, so Spring's FR4.26
 * fallback never fires. A 200 cannot trigger ApiErrorPanel, so the screen has
 * to recognise the empty case itself rather than rendering a blank panel.
 */
function isReportPopulated(r: PrescriptiveReport | null): boolean {
  return !!r && typeof r.executiveSummary === 'string' && r.executiveSummary.trim().length > 0;
}

/**
 * Sticky "on this page" nav. The results screen is five bands long; without
 * it the action plan — the part an operator actually acts on — was a long
 * scroll away with no signpost. Highlights whichever section is in view.
 */
function SectionNav() {
  const [active, setActive] = useState<string>(SECTIONS[0].id);
  // A nav click owns the highlight until its smooth scroll settles — otherwise
  // a band too short to reach the nav (Trends, at the page bottom) would be
  // overridden mid-scroll by the at-bottom rule below.
  const clickLockUntil = useRef(0);

  useEffect(() => {
    // Current = the last band whose top has scrolled up under the pinned nav.
    // (An IntersectionObserver picked whichever band *changed* visibility
    // last, so jumping to Funnel lit up Trends as it slid into view.)
    const NAV_CLEARANCE = 160;
    let frame = 0;
    const update = () => {
      frame = 0;
      if (performance.now() < clickLockUntil.current) return;
      let current: string = SECTIONS[0].id;
      for (const { id } of SECTIONS) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= NAV_CLEARANCE) current = id;
      }
      // The last band is often too short to reach the nav; at the page
      // bottom, it is the one being read.
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      setActive(atBottom ? SECTIONS[SECTIONS.length - 1].id : current);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <nav className="perf-nav" aria-label="Results sections">
      {SECTIONS.map(({ id, label }) => (
        <a
          key={id}
          href={`#${id}`}
          aria-current={active === id ? 'true' : undefined}
          onClick={(e) => {
            e.preventDefault();
            setActive(id);
            clickLockUntil.current = performance.now() + 1000;
            document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }}
        >
          {label}
        </a>
      ))}
    </nav>
  );
}

export default function CampaignAnalyticsView() {
  const [campaign, setCampaign] = useState<CampaignInput | null>(null);
  // Task 17: the server's PES from the ingest response, if the submit
  // returned one — the gauge's authoritative headline. null (fixture runs,
  // or a response with no `pes`) falls back to the client computation below.
  const [serverPes, setServerPes] = useState<ManualIngestPes | null>(null);
  const [context, setContext] = useState<SubmissionContext | null>(null);
  const [weeks, setWeeks] = useState<4 | 8>(4);
  const [history, setHistory] = useState<CampaignHistoryEntry[] | null>(null);
  const [report, setReport] = useState<PrescriptiveReport | null>(null);
  const [error, setError] = useState<unknown | null>(null);

  useEffect(() => {
    if (!campaign) return;
    let cancelled = false;
    setError(null);

    // Two independent calls sharing one error surface: history is a plain DB
    // read, the report round-trips to FastAPI. One failing must not discard
    // the other.
    apiClient.campaign
      .history()
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
    window.scrollTo?.({ top: 0 });
  }

  function handleCampaignSubmit(input: CampaignInput, pes?: ManualIngestPes, ctx?: SubmissionContext) {
    setServerPes(pes ?? null);
    setContext(ctx ?? null);
    setCampaign(input);
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
  // Task 17: prefer the server-computed PES (from the ingest response) as the
  // authoritative score/label; fall back to the client computation when
  // there isn't one (fixture runs, or a response with no `pes`). Verified
  // against ARCHITECTURE_SPEC.md §4.2's formula for a real submission: the
  // two agree to within display rounding, so this is not a formula change,
  // just a source-of-truth swap.
  const clientPes = computePes(metrics);
  const score = serverPes?.overallScore ?? clientPes.score;
  const label = serverPes?.label ?? clientPes.label;
  const windowSlice = (history ?? []).slice(-weeks);
  const money = currencyPrefix(context?.currency);

  return (
    // A dashboard, not a form: fills the shell's content width (capped at
    // --content-max) and reads in labelled bands — score, action plan,
    // funnel, trends, posts — that the sticky section nav jumps between.
    <div className="perf-screen perf-screen--results flex flex-col gap-8">
      <PageHead
        eyebrow={context ? `Results · ${formatPeriod(context.period)}` : 'Results'}
        title="Campaign performance"
        subtitle={
          <>
            Scored <strong className="num" style={{ color: 'var(--color-text-heading)' }}>{score.toFixed(2)}</strong>{' '}
            — {label}. Start with the action plan, then dig into what drove the score.
          </>
        }
        actions={
          <button type="button" onClick={handleNewSubmission} className="btn-outline flex items-center gap-2">
            <RotateCcw size={14} aria-hidden="true" /> New submission
          </button>
        }
      />
      {/* A direct child of the screen, not wrapped with PageHead: sticky only
          holds within its parent, so a wrapper would carry it off-screen. */}
      <SectionNav />

      <FlaggedMetricBanner flagged={flagged} />

      {/* Score beside its drivers: the gauge says how good, the KPI grid
          says why. The heaviest-weighted metric (ROAS) spans the grid's full
          width as the lead; the other four follow in weight order. */}
      <section id="perf-score" className="perf-section grid items-stretch gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]" aria-label="Score">
        <PesGauge score={score} label={label} metrics={metrics} />
        <div className="perf-kpi-grid">
          {KPI_CARD_SPECS.map((spec, i) => (
            <div key={spec.label} className={i === 0 ? 'sm:col-span-2' : undefined}>
              <KpiCard
                label={spec.label}
                value={metrics[spec.key]}
                name={spec.name}
                hint={spec.hint(money)}
                weightPct={spec.weightPct}
                prefix={spec.unit === 'currency' ? money.trim() : undefined}
                suffix={spec.unit === 'currency' ? undefined : spec.unit}
                featured={i === 0}
              />
            </div>
          ))}
        </div>
      </section>

      {/* Second, not last: the action plan is what the operator does next,
          and it used to sit below every chart. Full width — the summary card
          and the diagnostics row carry their own responsive column counts
          (see AiActionPlan.tsx) that assume the full content width. */}
      <section id="perf-plan" className="perf-section flex flex-col gap-4" aria-label="Action plan">
        {error != null && <ApiErrorPanel error={error} label="Campaign Analytics" />}
        {isReportPopulated(report) ? (
          <AiActionPlan report={report as PrescriptiveReport} />
        ) : report === null && error == null ? (
          <div className="card body-sm" aria-busy="true">
            Drafting your AI action plan…
          </div>
        ) : report !== null ? (
          <div className="rounded-[var(--radius-md)] border border-[var(--color-gray-light)] bg-[var(--color-off-white)] p-6">
            <p className="text-sm text-[var(--color-text-body)]">
              The report service returned no content.{' '}
              <span className="font-mono text-xs text-[var(--color-text-muted)]">
                POST /api/analytics/report
              </span>{' '}
              responded 200 with an empty body.
            </p>
          </div>
        ) : null}
      </section>

      {/* After the action plan, not before it: evidence of which ad worked
          informs the plan but must not push it down the page. */}
      <section id="perf-attribution" className="perf-section" aria-label="Attribution evidence">
        <AttributionEvidenceSection />
      </section>

      {/* Full width: the flow needs horizontal room to read left-to-right,
          and its own responsive breakpoints assume the viewport's width, not
          a halved grid column's. */}
      <section id="perf-funnel" className="perf-section" aria-label="Customer journey funnel">
        <CustomerJourneyFunnel input={campaign} />
      </section>

      {/* One shared window control governs all three charts below. */}
      <section id="perf-trends" className="perf-section flex flex-col gap-4" aria-labelledby="perf-trends-head">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="perf-trends-head" className="heading-md">Trends over time</h2>
            <p className="body-xs mt-1">This period against your earlier ones.</p>
          </div>
          <div role="group" aria-label="Trend window" className="inline-flex gap-1 rounded-pill bg-mint-pale p-1">
            {WEEK_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={weeks === option}
                onClick={() => setWeeks(option)}
                className={`rounded-pill px-4 py-1.5 text-sm font-semibold transition-colors ${
                  weeks === option ? 'bg-mint-primary text-navy-dark' : 'text-navy-primary hover:text-cyan-deep'
                }`}
              >
                {option}WK
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <PesTrendChart window={windowSlice} />
          <EfficiencyTrendChart window={windowSlice} />
          <CostTrendChart window={windowSlice} />
        </div>
      </section>

      {/* Last: recent posts are context for the campaign, not a result of
          this submission — they used to sit beside the score as if they were. */}
      <section id="perf-posts" className="perf-section" aria-label="Published posts">
        <PreviouslyPublished />
      </section>
    </div>
  );
}
