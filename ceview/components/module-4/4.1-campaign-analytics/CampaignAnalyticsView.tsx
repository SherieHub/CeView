import React, { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import DataIngestionForm from './components/DataIngestionForm';
import EngagementMetricsBoard from './components/EngagementMetricsBoard';
import CustomerJourneyFunnel from './components/CustomerJourneyFunnel';
import PESComputationBoard from './components/PESComputationBoard';
import AIActionPlanReport from './components/AIActionPlanReport';
import type { ManualIngestResponse, PesResponse } from '../../../types';

/**
 * Module 4 — Campaign Analytics & Reporting.
 *
 * Data flow:
 *   1. DataIngestionForm  → user submits raw values → api.analyticsManual()
 *   2. ManualIngestResponse → metrics + funnel stored in state; pes passed to PESComputationBoard
 *   3. 4W / 8W toggle     → weeks state lifted here; forwarded to AIActionPlanReport
 *                           (engagement metrics and PES reflect the operator-submitted values)
 *   4. PESComputationBoard  → receives pesData prop from form submission (no extra round-trip)
 *   5. AIActionPlanReport   → calls api.prescriptiveReport(weeks) on-demand when user clicks Generate
 */
const CampaignAnalyticsView: React.FC = () => {
  const [dashboardActive, setDashboardActive] = useState(false);
  const [metricsData, setMetricsData] = useState<ManualIngestResponse | null>(null);
  const [weeks, setWeeks] = useState<4 | 8>(4);

  const handleDataReady = (data: ManualIngestResponse) => {
    setMetricsData(data);
    setDashboardActive(true);
  };

  const handleBack = () => {
    setDashboardActive(false);
    setMetricsData(null);
    setWeeks(4);
  };

  // ── Form (entry) view ─────────────────────────────────────────────────────
  if (!dashboardActive) {
    return <DataIngestionForm onDataReady={handleDataReady} />;
  }

  // ── Dashboard view ────────────────────────────────────────────────────────
  return (
    <div className="animate-fade-in pb-12 max-w-6xl mx-auto">
      <button
        onClick={handleBack}
        className="flex items-center text-slate-500 hover:text-slate-800 mb-6 font-medium transition-colors"
      >
        <ArrowLeft size={18} className="mr-2" /> Back to Data Ingestion
      </button>

      {/* ── KPI metrics + funnel (operator-submitted data) ─────────────── */}
      {metricsData && (
        <>
          <EngagementMetricsBoard
            metrics={metricsData.metrics}
            weeks={weeks}
            onWeeksChange={setWeeks}
            isRefreshing={false}
          />
          <CustomerJourneyFunnel funnelData={metricsData.funnel} />
        </>
      )}

      {/* ── PES score — uses submitted data, no extra round-trip ────────── */}
      <PESComputationBoard weeks={weeks} pesData={metricsData?.pes ?? null} />

      {/* ── AI prescriptive report — on-demand with weeks context ─────── */}
      <AIActionPlanReport weeks={weeks} />
    </div>
  );
};

export default CampaignAnalyticsView;
