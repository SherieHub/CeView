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
import { useEffect, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { apiClient } from '../../../services/apiClient';
import { ApiErrorPanel } from '../../shared/ApiErrorPanel';
import type { CampaignInput, CampaignHistoryEntry, ManualIngestPes, PrescriptiveReport } from '@/types';
import { computeMetrics, computePes } from './campaignMetrics';
import type { Metrics } from './campaignTypes';
import IngestionForm from './IngestionForm';
import KpiCard from './KpiCard';
import FlaggedMetricBanner from './FlaggedMetricBanner';
import PesGauge from './PesGauge';
import CustomerJourneyFunnel from './CustomerJourneyFunnel';
import PesTrendChart from './PesTrendChart';
import EfficiencyTrendChart from './EfficiencyTrendChart';
import CostTrendChart from './CostTrendChart';
import AiActionPlan from './AiActionPlan';
import PreviouslyPublished from './PreviouslyPublished';

/**
 * Per pseudocode/module-4/kpi-cards.ts: KpiCard takes {label, value,
 * inverseGood} per metric, not the KpiSlotProps bundle — the shell mounts 5
 * instances, one per metric, deriving each one's props from `metrics` here.
 */
const KPI_CARD_SPECS: { label: string; key: keyof Metrics; inverseGood?: boolean }[] = [
  { label: 'CTR', key: 'ctr' },
  { label: 'CPC', key: 'cpc', inverseGood: true },
  { label: 'ROAS', key: 'roas' },
  { label: 'CR', key: 'convRate' },
  { label: 'CAC', key: 'cac', inverseGood: true },
];

/** Windows the shared trend-window toggle offers; governs all three charts. */
const WEEK_OPTIONS: (4 | 8)[] = [4, 8];

/**
 * The report endpoint can answer 200 with an empty object: FastAPI's
 * /internal/report/generate returns {} on success, so Spring's FR4.26
 * fallback never fires. A 200 cannot trigger ApiErrorPanel, so the screen has
 * to recognise the empty case itself rather than rendering a blank panel.
 */
function isReportPopulated(r: PrescriptiveReport | null): boolean {
  return !!r && typeof r.executiveSummary === 'string' && r.executiveSummary.trim().length > 0;
}

export default function CampaignAnalyticsView() {
  const [campaign, setCampaign] = useState<CampaignInput | null>(null);
  // Task 17: the server's PES from the ingest response, if the submit
  // returned one — the gauge's authoritative headline. null (fixture runs,
  // or a response with no `pes`) falls back to the client computation below.
  const [serverPes, setServerPes] = useState<ManualIngestPes | null>(null);
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
    setHistory(null);
    setReport(null);
    setError(null);
    setWeeks(4);
  }

  function handleCampaignSubmit(input: CampaignInput, pes?: ManualIngestPes) {
    setServerPes(pes ?? null);
    setCampaign(input);
  }

  if (!campaign) {
    return (
      <div className="mx-auto max-w-[880px]">
        <IngestionForm onSubmit={handleCampaignSubmit} />
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

  return (
    // A dashboard, not a form: fills the shell's content width (capped at
    // --content-max) instead of the 880px prose measure, and lays the cards
    // out in a grid so the screen reads in ~4 bands rather than an 11-card
    // vertical scroll.
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="heading-lg">Performance</h2>
          <p className="body-sm">
            Campaign scored {score.toFixed(2)} — {label}.
          </p>
        </div>
        <button type="button" onClick={handleNewSubmission} className="btn-outline flex items-center gap-2">
          <RotateCcw size={14} /> New submission
        </button>
      </div>

      <FlaggedMetricBanner flagged={flagged} />
      {/* KPI strip: one row on desktop, wrapping 3→2 on smaller widths, rather
          than five full-width cards stacked down the page. */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {KPI_CARD_SPECS.map((spec) => (
          <KpiCard key={spec.label} label={spec.label} value={metrics[spec.key]} inverseGood={spec.inverseGood} />
        ))}
      </div>

      {/* Score and recent-post performance are both "how are we doing"
          overview content. Both cards are pinned to the exact same fixed
          height (660px — see PesGauge.tsx / PreviouslyPublished.tsx) rather
          than sized by content, so the row never has dead space under a
          shorter card and never grows just because a business has a long
          post history — the post list scrolls internally instead. */}
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <PesGauge score={score} label={label} metrics={metrics} />
        <PreviouslyPublished />
      </div>

      {/* Full width: the flow needs horizontal room to read left-to-right,
          and its own responsive breakpoints assume the viewport's width, not
          a halved grid column's. */}
      <CustomerJourneyFunnel input={campaign} />

      {/* One shared window control governs all three charts below — it used to
          live inside PesTrendChart's header, where it read as a PES-only
          toggle. */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="heading-md">Trends over time</h3>
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
      </div>

      {error != null && <ApiErrorPanel error={error} label="Campaign Analytics" />}

      {/* Full width: the summary card and the diagnostics row both carry
          their own responsive column counts (see AiActionPlan.tsx), which
          assume the full content width — halving it would over-pack them. */}
      {isReportPopulated(report) ? (
        <AiActionPlan report={report as PrescriptiveReport} />
      ) : report === null && error == null ? (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-gray-light)] bg-[var(--color-off-white)] p-6 text-sm text-[var(--color-text-muted)]">
          Loading report…
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
    </div>
  );
}
