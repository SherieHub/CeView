import React, { useState, useEffect } from 'react';
import { Sparkles, FileText, BarChart2, Loader2, AlertTriangle, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import PriorityFixCard from './PriorityFixCard';
import { COLORS } from '../../../../constants';
import { api, ApiError } from '../../../../services/apiClient';
import ServerErrorBanner from '../../../shared/ServerErrorBanner';
import type { PesAnalysisReport, Metrics } from '../../../../types';

interface AIActionPlanReportProps {
  weeks: 4 | 8;
  /** The operator's just-submitted KPIs — pinned as the current (index 0) point. */
  current: Metrics | null;
}

/** Unified weekly KPI point used to build the agent's metrics_data arrays. */
type KpiPoint = { ctr: number; cpc: number; roas: number; convRate: number; cac: number };

// Rank → urgency label/colour for the Stage-by-Stage recommendation list.
const rankUrgency = (rank: number): { label: string; bg: string; text: string; border: string } => {
  if (rank === 1) return { label: 'Most Urgent', bg: '#FEE2E2', text: '#991B1B', border: '#FECACA' };
  if (rank === 2) return { label: 'Urgent', bg: '#FEF3C7', text: '#92400E', border: '#FDE68A' };
  return { label: 'Not Very Urgent', bg: '#DCFCE7', text: '#166534', border: '#BBF7D0' };
};

// Format a metric peak/low value with the metric-appropriate unit.
const fmtValue = (metric: string, v: number): string => {
  const m = metric.toUpperCase();
  if (m === 'CPC' || m === 'CAC') return `₱${v}`;
  if (m === 'CTR' || m === 'CR') return `${v}%`;
  return `${v}`;
};

const TrendIcon: React.FC<{ trend: string }> = ({ trend }) => {
  if (trend === 'up') return <TrendingUp size={14} style={{ color: '#DC2626' }} />;
  if (trend === 'down') return <TrendingDown size={14} style={{ color: '#16A34A' }} />;
  return <Minus size={14} style={{ color: COLORS.TEXT_MUTED }} />;
};

const AIActionPlanReport: React.FC<AIActionPlanReportProps> = ({ weeks, current }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [reportData, setReportData]     = useState<PesAnalysisReport | null>(null);
  const [serverError, setServerError]   = useState<string | null>(null);

  useEffect(() => {
    const fetchReport = async () => {
      setIsGenerating(true);
      setServerError(null);
      try {
        // Build the per-KPI series from the operator's real campaign inputs:
        // the current input + the prior rows of tbl_campaign_records. The agent
        // reads index 0 as the most-recent week, so the current submission is
        // pinned at index 0 (sourced in-memory, not via a DB round-trip) and the
        // prior inputs follow newest→oldest. /history returns oldest-first, so we
        // reverse it; its newest row is the just-persisted current input, which
        // we drop to avoid duplicating index 0. Rows missing a KPI are skipped so
        // a partially-saved record can't inject a 0 that skews peak/low/trend.
        const { snapshots } = await api.analyticsHistory(weeks);
        const priors: KpiPoint[] = snapshots
          .filter(s => s.ctr != null && s.cpc != null && s.roas != null && s.convRate != null && s.cac != null)
          .map(s => ({ ctr: s.ctr!, cpc: s.cpc!, roas: s.roas!, convRate: s.convRate!, cac: s.cac! }))
          .reverse()        // newest → oldest
          .slice(1);        // drop newest (== current input, pinned below)

        const points: KpiPoint[] = current
          ? [
              {
                ctr: current.ctr.value, cpc: current.cpc.value, roas: current.roas.value,
                convRate: current.convRate.value, cac: current.cac.value,
              },
              ...priors.slice(0, weeks - 1),
            ]
          : priors;

        const metricsData = points.length
          ? {
              CTR:  points.map(p => p.ctr),
              CPC:  points.map(p => p.cpc),
              ROAS: points.map(p => p.roas),
              CR:   points.map(p => p.convRate),
              CAC:  points.map(p => p.cac),
            }
          : undefined;

        console.debug('[Module 4] pes-analysis metrics_data', metricsData);
        const r = await api.pesAnalysis(weeks, metricsData);
        setReportData(r);
      } catch (e) {
        console.warn('[Module 4] pesAnalysis failed', e);
        const msg = e instanceof ApiError
          ? `AI report generation failed. [${e.code}]`
          : 'AI report generation failed. The analytics service may be unavailable.';
        setServerError(msg);
      } finally {
        setIsGenerating(false);
      }
    };
    fetchReport();
  }, [weeks, current]);

  const data       = reportData?.report_data;
  const metadata   = reportData?.metadata;
  const weaknesses = data ? [...data.ranked_weaknesses].sort((a, b) => a.rank - b.rank) : [];
  const showWarning = !!metadata
    && (metadata.needs_human_review || !metadata.warning_message.startsWith('Report passed'));

  return (
    <div className="border-t-2 border-dashed border-slate-200 pt-12 animate-fade-in space-y-6 mt-12">
      {serverError && (
        <ServerErrorBanner message={serverError} onDismiss={() => setServerError(null)} />
      )}

      {/* ── Header bar ──────────────────────────────────────────────────── */}
      <div
        className="p-6 rounded-2xl border"
        style={{ backgroundColor: COLORS.CREAM, borderColor: '#E2E8F0' }}
      >
        <h2 className="text-2xl font-bold flex items-center gap-2" style={{ color: COLORS.NAVY }}>
          <Sparkles size={24} style={{ color: COLORS.GOLD }} />
          AI Action Plan
        </h2>
        <p className="mt-1 text-sm" style={{ color: COLORS.TEXT_MUTED }}>
          Exhaustive metric diagnostics with urgency-ranked, 1-to-1 recommendations for every weakness.
        </p>
      </div>

      {/* ── Loading state ───────────────────────────────────────────────── */}
      {isGenerating && (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center flex flex-col items-center justify-center min-h-[250px]">
          <Loader2 size={48} className="animate-spin mb-4" style={{ color: COLORS.NAVY }} />
          <h3 className="text-lg font-bold animate-pulse" style={{ color: COLORS.NAVY }}>
            Analyzing your campaign metrics…
          </h3>
          <p className="mt-1 text-sm" style={{ color: COLORS.TEXT_MUTED }}>
            Evaluating all KPI trends and generating ranked recommendations
          </p>
        </div>
      )}

      {/* ── Report content ──────────────────────────────────────────────── */}
      {data && !isGenerating && (
        <div className="flex flex-col gap-6 animate-fade-in">

          {/* Metadata warning banner */}
          {showWarning && metadata && (
            <div
              className="flex items-start gap-3 p-4 rounded-2xl border"
              style={{ backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }}
            >
              <AlertTriangle size={20} className="shrink-0 mt-0.5" style={{ color: '#D97706' }} />
              <div>
                <p className="text-sm font-bold" style={{ color: '#92400E' }}>
                  {metadata.needs_human_review ? 'Human review recommended' : 'Report notice'}
                </p>
                <p className="text-xs leading-relaxed mt-0.5" style={{ color: '#92400E' }}>
                  {metadata.warning_message}
                </p>
              </div>
            </div>
          )}

          {/* Executive Summary — cross-metric logic */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col gap-4">
            <div className="flex items-center gap-2 mb-2 border-b border-slate-100 pb-4">
              <div
                className="p-2 rounded-lg"
                style={{ backgroundColor: COLORS.TEXT_MUTED, color: COLORS.WHITE }}
              >
                <FileText size={20} />
              </div>
              <h3 className="text-lg font-bold" style={{ color: COLORS.TEXT_MAIN }}>
                Executive Summary
              </h3>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: COLORS.TEXT_MUTED }}>
                  Metric Relationships
                </p>
                <p className="leading-relaxed text-sm" style={{ color: COLORS.GREY }}>
                  {data.cross_metric_logic.relationships}
                </p>
              </div>
              {data.cross_metric_logic.insights && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: COLORS.TEXT_MUTED }}>
                    Combined Insights
                  </p>
                  <p className="leading-relaxed text-sm" style={{ color: COLORS.GREY }}>
                    {data.cross_metric_logic.insights}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Metric conditions strip */}
          {data.metric_conditions.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.metric_conditions.map((mc) => (
                <div
                  key={mc.metric_name}
                  className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col gap-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold" style={{ color: COLORS.NAVY }}>
                      {mc.metric_name}
                    </span>
                    <span className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider" style={{ color: COLORS.TEXT_MUTED }}>
                      <TrendIcon trend={mc.trend} />
                      {mc.trend}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs font-medium" style={{ color: COLORS.TEXT_MUTED }}>
                    <span>Peak: <strong style={{ color: COLORS.TEXT_MAIN }}>{fmtValue(mc.metric_name, mc.peak_value)}</strong></span>
                    <span>Low: <strong style={{ color: COLORS.TEXT_MAIN }}>{fmtValue(mc.metric_name, mc.low_value)}</strong></span>
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: COLORS.GREY }}>
                    {mc.current_status}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Stage-by-stage recommendations + funnel diagnostics */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            {/* Left: ranked recommendations */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col">
              <div className="flex items-center gap-2 mb-6 border-b border-slate-100 pb-4">
                <div
                  className="p-2 rounded-lg border"
                  style={{ backgroundColor: COLORS.GOLD_LIGHT, color: COLORS.GOLD, borderColor: '#FDE68A' }}
                >
                  <BarChart2 size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold leading-tight" style={{ color: COLORS.TEXT_MAIN }}>
                    Stage-by-Stage Analysis
                  </h3>
                  <p className="text-xs font-medium" style={{ color: COLORS.TEXT_MUTED }}>
                    {weaknesses.length} weaknesses ranked
                  </p>
                </div>
              </div>

              {/* Ranked recommendation list */}
              <div className="space-y-3">
                {weaknesses.map((w) => {
                  const uc = rankUrgency(w.rank);
                  return (
                    <div
                      key={`${w.metric_name}-${w.rank}`}
                      className="flex items-start gap-3 p-3 rounded-xl border"
                      style={{ backgroundColor: uc.bg, borderColor: uc.border }}
                    >
                      <span
                        className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0 mt-0.5"
                        style={{ backgroundColor: uc.text, color: '#FFFFFF' }}
                      >
                        {uc.label}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-bold leading-tight mb-0.5" style={{ color: uc.text }}>
                          {w.metric_name}
                        </p>
                        <p className="text-xs leading-relaxed" style={{ color: uc.text, opacity: 0.85 }}>
                          {w.recommendation}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right: funnel diagnostics — weakness meaning per metric */}
            <PriorityFixCard weaknesses={weaknesses} />
          </div>
        </div>
      )}
    </div>
  );
};

export default AIActionPlanReport;
