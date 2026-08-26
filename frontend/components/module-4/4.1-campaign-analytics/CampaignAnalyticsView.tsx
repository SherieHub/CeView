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
import type { CampaignInput, CampaignHistoryEntry, PrescriptiveReport } from '../../../services/fixtures/campaign';
import { computeMetrics, computePes } from './campaignMetrics';
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

export default function CampaignAnalyticsView() {
  const [campaign, setCampaign] = useState<CampaignInput | null>(null);
  const [weeks, setWeeks] = useState<4 | 8>(4);
  const [history, setHistory] = useState<CampaignHistoryEntry[] | null>(null);
  const [report, setReport] = useState<PrescriptiveReport | null>(null);

  useEffect(() => {
    if (!campaign) return;
    // apiClient.campaign.history()/.report() type as Promise<unknown> — the
    // real (non-fixture) branch calls request() with no explicit type
    // argument, which widens the ternary's inferred return type. That's an
    // existing apiClient.ts looseness, not something this card's file list
    // covers; cast locally rather than touching a shared file out of scope.
    apiClient.campaign.history().then((h) => setHistory(h as CampaignHistoryEntry[]));
    apiClient.campaign.report().then((r) => setReport(r as PrescriptiveReport));
  }, [campaign]);

  function handleNewSubmission() {
    setCampaign(null);
    setHistory(null);
    setReport(null);
    setWeeks(4);
  }

  if (!campaign) {
    return (
      <div className="mx-auto max-w-[880px]">
        <IngestionForm onSubmit={setCampaign} />
      </div>
    );
  }

  const { metrics, flagged } = computeMetrics(campaign);
  const { score, label } = computePes(metrics);
  const windowSlice = (history ?? []).slice(-weeks);

  return (
    <div className="mx-auto flex max-w-[880px] flex-col gap-6">
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
      <KpiCard metrics={metrics} flagged={flagged} />
      <PesGauge score={score} label={label} metrics={metrics} />
      <CustomerJourneyFunnel input={campaign} />
      <PesTrendChart window={windowSlice} weeks={weeks} onWeeksChange={setWeeks} />
      <EfficiencyTrendChart window={windowSlice} weeks={weeks} onWeeksChange={setWeeks} />
      <CostTrendChart window={windowSlice} weeks={weeks} onWeeksChange={setWeeks} />
      {report && <AiActionPlan report={report} />}
      <PreviouslyPublished />
    </div>
  );
}
