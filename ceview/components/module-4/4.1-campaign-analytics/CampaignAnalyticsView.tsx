import React, { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import DataIngestionForm from './components/DataIngestionForm';
import EngagementMetricsBoard from './components/EngagementMetricsBoard';
import CustomerJourneyFunnel from './components/CustomerJourneyFunnel';
import PESComputationBoard from './components/PESComputationBoard';
import AIActionPlanReport from './components/AIActionPlanReport';
import type { MetricsResponse } from '../../../types';

/**
 * Module 4 — Campaign Analytics & Reporting.
 *
 * Data flow:
 *   1. DataIngestionForm  → user submits raw values → api.analyticsManual()
 *   2. MetricsResponse    → stored in state, passed to EngagementMetricsBoard + CustomerJourneyFunnel
 *   3. 4W / 8W toggle     → weeks state lifted here; forwarded to PESComputationBoard + AIActionPlanReport
 *                           (engagement metrics remain the operator-submitted values)
 *   4. PESComputationBoard  → independently calls api.analyticsPes(weeks)
 *   5. AIActionPlanReport   → calls api.prescriptiveReport(weeks) on-demand when user clicks Generate
 */
const CampaignAnalyticsView: React.FC = () => {
  /** Whether the user has submitted form data and entered the dashboard. */
  const [dashboardActive, setDashboardActive] = useState(false);

  /** Operator-submitted campaign data — set once after DataIngestionForm submit. */
  const [metricsData, setMetricsData] = useState<MetricsResponse | null>(null);

  /**
   * Analysis window for PES and AI report.
   * Engagement metrics always reflect the submitted data; only PES + AI report
   * are re-scoped when this toggle changes.
   */
  const [weeks, setWeeks] = useState<4 | 8>(4);

  const handleDataReady = (data: MetricsResponse) => {
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

      {/* ── PES score — refetches when weeks changes ────────────────────── */}
      <PESComputationBoard weeks={weeks} />

      {/* ── AI prescriptive report — on-demand with weeks context ─────── */}
      <AIActionPlanReport weeks={weeks} />
    </div>
  );
};

export default CampaignAnalyticsView;
