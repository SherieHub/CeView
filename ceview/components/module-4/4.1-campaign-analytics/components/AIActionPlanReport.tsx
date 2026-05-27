import React, { useState } from 'react';
import { Sparkles, Download, FileText, BarChart2, Loader2, Globe2 } from 'lucide-react';
import ReportActionBtn from './ReportActionBtn';
import PriorityFixCard from './PriorityFixCard';
import { COLORS } from '../../../../constants';
import { api, ApiError } from '../../../../services/apiClient';
import ServerErrorBanner from '../../../shared/ServerErrorBanner';
import type { PrescriptiveReport } from '../../../../types';

interface AIActionPlanReportProps {
  weeks: 4 | 8;
}

const AIActionPlanReport: React.FC<AIActionPlanReportProps> = ({ weeks }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [reportData, setReportData]     = useState<PrescriptiveReport | null>(null);
  const [serverError, setServerError]   = useState<string | null>(null);

  const handleGenerateReport = async () => {
    setIsGenerating(true);
    setServerError(null);
    try {
      const r = await api.prescriptiveReport(weeks);
      setReportData(r);
    } catch (e) {
      console.warn('[Module 4] prescriptiveReport failed', e);
      const msg = e instanceof ApiError
        ? `AI report generation failed. [${e.code}]`
        : 'AI report generation failed. The analytics service may be unavailable.';
      setServerError(msg);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="border-t-2 border-dashed border-slate-200 pt-12 animate-fade-in space-y-6 mt-12">
      {serverError && (
        <ServerErrorBanner message={serverError} onDismiss={() => setServerError(null)} />
      )}

      {/* ── Header bar ──────────────────────────────────────────────────── */}
      <div
        className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-6 rounded-2xl border"
        style={{ backgroundColor: COLORS.CREAM, borderColor: '#E2E8F0' }}
      >
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2" style={{ color: COLORS.NAVY }}>
            <Sparkles size={24} style={{ color: COLORS.GOLD }} />
            AI Action Plan
          </h2>
          <p className="mt-1 text-sm" style={{ color: COLORS.TEXT_MUTED }}>
            Exhaustive funnel diagnostics with urgency-ranked, 1-to-1 recommendations for every stage.
          </p>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <ReportActionBtn
            onClick={handleGenerateReport}
            disabled={isGenerating}
            icon={isGenerating ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
            label={isGenerating ? 'Analyzing...' : reportData ? 'Regenerate Analysis' : 'Generate AI Report'}
          />
          {reportData && (
            <ReportActionBtn
              icon={<Download size={18} />}
              label="PDF"
              variant="danger"
            />
          )}
        </div>
      </div>

      {/* ── Empty state ─────────────────────────────────────────────────── */}
      {!reportData && !isGenerating && (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center flex flex-col items-center justify-center min-h-[250px]">
          <div
            className="w-16 h-16 border rounded-full flex items-center justify-center mb-4"
            style={{ backgroundColor: COLORS.CREAM, borderColor: '#E2E8F0', color: COLORS.GOLD }}
          >
            <Sparkles size={32} />
          </div>
          <h3 className="text-lg font-bold" style={{ color: COLORS.TEXT_MAIN }}>
            Ready for Strategic Calibration
          </h3>
          <p className="max-w-md mt-2" style={{ color: COLORS.TEXT_MUTED }}>
            Click Generate to analyse your campaign funnel — all stages evaluated, ranked by impact, with urgency-mapped action steps.
          </p>
        </div>
      )}

      {/* ── Loading state ───────────────────────────────────────────────── */}
      {isGenerating && (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center flex flex-col items-center justify-center min-h-[250px]">
          <Loader2 size={48} className="animate-spin mb-4" style={{ color: COLORS.NAVY }} />
          <h3 className="text-lg font-bold animate-pulse" style={{ color: COLORS.NAVY }}>
            Analyzing your campaign funnel…
          </h3>
          <p className="mt-1 text-sm" style={{ color: COLORS.TEXT_MUTED }}>
            Evaluating all funnel stages and generating ranked recommendations
          </p>
        </div>
      )}

      {/* ── Report content ──────────────────────────────────────────────── */}
      {reportData && !isGenerating && (
        <div className="flex flex-col gap-6 animate-fade-in">

          {/* Executive Summary */}
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
            <p className="leading-relaxed text-sm" style={{ color: COLORS.GREY }}>
              {reportData.executiveSummary}
            </p>
          </div>

          {/* Recommended Platform badge */}
          {reportData.recommendedPlatform && (
            <div
              className="flex items-center gap-3 px-5 py-3 rounded-xl border"
              style={{ backgroundColor: `${COLORS.TEAL}12`, borderColor: `${COLORS.TEAL}30` }}
            >
              <Globe2 size={18} style={{ color: COLORS.TEAL }} />
              <span className="text-sm font-bold" style={{ color: COLORS.NAVY }}>
                Recommended Platform for this Market:&nbsp;
              </span>
              <span
                className="text-sm font-black px-3 py-0.5 rounded-full"
                style={{ backgroundColor: COLORS.TEAL, color: '#FFFFFF' }}
              >
                {reportData.recommendedPlatform}
              </span>
            </div>
          )}

          {/* Funnel diagnostics + recommendations */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            {/* Left: stage count summary */}
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
                    {reportData.funnelDiagnostics.length} transitions evaluated
                  </p>
                </div>
              </div>

              {/* Mini urgency summary list */}
              <div className="space-y-3">
                {reportData.recommendations.map((rec, i) => {
                  const urgencyColors: Record<string, { bg: string; text: string; border: string }> = {
                    'Most Urgent':    { bg: '#FEE2E2', text: '#991B1B', border: '#FECACA' },
                    'Urgent':         { bg: '#FEF3C7', text: '#92400E', border: '#FDE68A' },
                    'Not Very Urgent':{ bg: '#DCFCE7', text: '#166534', border: '#BBF7D0' },
                  };
                  const uc = urgencyColors[rec.urgency] ?? urgencyColors['Not Very Urgent'];
                  return (
                    <div
                      key={i}
                      className="flex items-start gap-3 p-3 rounded-xl border"
                      style={{ backgroundColor: uc.bg, borderColor: uc.border }}
                    >
                      <span
                        className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0 mt-0.5"
                        style={{ backgroundColor: uc.text, color: '#FFFFFF' }}
                      >
                        {rec.urgency}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-bold leading-tight mb-0.5" style={{ color: uc.text }}>
                          {rec.title}
                        </p>
                        <p className="text-xs leading-relaxed" style={{ color: uc.text, opacity: 0.85 }}>
                          {rec.action}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right: full ranked diagnostics card */}
            <PriorityFixCard
              funnelDiagnostics={reportData.funnelDiagnostics}
              recommendations={reportData.recommendations}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default AIActionPlanReport;
