import React, { useEffect } from 'react';
import { Shield, ToggleLeft, ToggleRight, CheckCircle2, XCircle } from 'lucide-react';
import AuditEmptyBanner from './AuditEmptyBanner';
import ComplianceGauge from './ComplianceGauge';
import { COLORS } from '../../../../constants';
import type { OmcsAuditResultDTO } from '../../../../types';

interface AuditStep { label: string; at: number }

interface SmartOptimizationBoardProps {
  auditOn: boolean;
  setAuditOn: (val: boolean) => void;
  hasFile: boolean;
  auditRunning: boolean;
  auditDone: boolean;
  auditProgress: number;
  onRunAudit: () => void;
  onResetAudit: () => void;
  omcs: OmcsAuditResultDTO | null;
  marketCity: string;
  auditSteps: AuditStep[];
}

const RUBRIC_LABELS: Record<string, string> = {
  visual_business_context_match:   'Visual ↔ Business Context',
  visual_intent_consistency:       'Visual Intent Consistency',
  tone_visual_mood_alignment:      'Tone ↔ Visual Mood',
  psychological_strategy_support:  'Psychological Strategy',
  target_audience_fit:             'Target Audience Fit',
  platform_suitability:            'Platform Suitability',
  attribute_coverage_consistency:  'Attribute Coverage',
};

// ── Score chip ──────────────────────────────────────────────────────────────
const ScoreChip: React.FC<{ label: string; score: number; tooltip: string }> = ({ label, score, tooltip }) => {
  const col    = score >= 80 ? COLORS.GREEN  : score >= 60 ? COLORS.GOLD  : COLORS.RED_ORANGE;
  const bg     = score >= 80 ? '#E8F9EF'     : score >= 60 ? '#FFF8E1'    : '#FFEEEE';
  const border = score >= 80 ? `${COLORS.GREEN}40` : score >= 60 ? `${COLORS.GOLD}40` : `${COLORS.RED_ORANGE}40`;
  return (
    <div className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl border" style={{ backgroundColor: bg, borderColor: border }} title={tooltip}>
      <span className="text-[10px] font-black uppercase tracking-widest text-center leading-tight" style={{ color: COLORS.TEXT_MUTED }}>{label}</span>
      <span className="text-lg font-black leading-none" style={{ color: col }}>{Math.round(score)}</span>
    </div>
  );
};

// ── Pass / Fail status badge ─────────────────────────────────────────────────
const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const pass = status.toLowerCase() === 'pass';
  const col  = pass ? COLORS.GREEN : COLORS.RED_ORANGE;
  const bg   = pass ? '#E8F9EF' : '#FFEEEE';
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border text-xs font-black" style={{ backgroundColor: bg, borderColor: `${col}40`, color: col }}>
      {pass ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
      {pass ? 'Pass' : 'Fail'}
    </span>
  );
};

const SmartOptimizationBoard: React.FC<SmartOptimizationBoardProps> = ({
  auditOn, setAuditOn, hasFile, auditRunning, auditDone, auditProgress, onRunAudit, onResetAudit,
  omcs, marketCity, auditSteps,
}) => {
  const currentStep = auditSteps.find(s => auditProgress < s.at) || auditSteps.at(-1);

  const toggleAudit = () => {
    if (!auditOn) {
      setAuditOn(true);
      if (hasFile) onRunAudit();
    } else {
      setAuditOn(false);
      onResetAudit();
    }
  };

  useEffect(() => {
    if (auditOn && hasFile && !auditRunning && !auditDone) onRunAudit();
  }, [hasFile, auditOn]);

  const rubricScores = omcs?.rubricEvaluationData?.scores ?? {};
  const rubricEntries = Object.entries(rubricScores);

  return (
    <div className="rounded-2xl shadow-sm border overflow-hidden transition-all duration-300" style={{ backgroundColor: COLORS.WHITE, borderColor: auditOn ? COLORS.NAVY : COLORS.LIGHT_GREY }}>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="p-4 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b" style={{ borderColor: auditOn ? COLORS.LIGHT_GREY : 'transparent' }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center transition-all shrink-0" style={{ backgroundColor: auditOn ? COLORS.GOLD : COLORS.LIGHT_GREY }}>
            <Shield size={18} style={{ color: auditOn ? COLORS.WHITE : COLORS.NAVY }} />
          </div>
          <div>
            <h2 className="text-base font-black leading-tight" style={{ color: COLORS.NAVY }}>Smart Optimization Audit</h2>
            <p className="text-xs font-bold uppercase tracking-wider mt-0.5" style={{ color: COLORS.TEXT_MUTED }}>
              OMCS Compliance Agent <span className="ml-2 px-2 py-0.5 rounded text-[9px]" style={{ backgroundColor: COLORS.GOLD_LIGHT, color: COLORS.GOLD }}>OPTIONAL</span>
            </p>
          </div>
        </div>
        <button onClick={toggleAudit} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-black transition-all border shadow-sm shrink-0" style={{ backgroundColor: auditOn ? COLORS.NAVY : COLORS.WHITE, borderColor: auditOn ? COLORS.NAVY : COLORS.LIGHT_GREY, color: auditOn ? COLORS.WHITE : COLORS.TEXT_MUTED }}>
          {auditOn ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
          {auditOn ? 'Audit Active' : 'Activate Audit'}
        </button>
      </div>

      {auditOn && (
        <div className="p-4 md:p-6 bg-white">
          {!hasFile && <AuditEmptyBanner />}

          {/* ── Progress bar ────────────────────────────────────────── */}
          {auditRunning && (
            <div className="p-6 rounded-xl border" style={{ backgroundColor: COLORS.CREAM, borderColor: COLORS.LIGHT_GREY }}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-sm font-black" style={{ color: COLORS.NAVY }}>
                  <div className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ backgroundColor: COLORS.NAVY }} />
                  AI Review in Progress
                </div>
                <span className="text-sm font-black" style={{ color: COLORS.NAVY }}>{Math.round(auditProgress)}%</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden mb-4" style={{ backgroundColor: COLORS.LIGHT_GREY }}>
                <div className="h-full rounded-full transition-all duration-300" style={{ width: `${auditProgress}%`, backgroundColor: COLORS.NAVY }} />
              </div>
              <p className="text-xs font-bold mb-3" style={{ color: COLORS.TEXT_MUTED }}>⚙️ {currentStep?.label}</p>
              <div className="flex gap-1.5 mb-4">
                {auditSteps.map((s, i) => (
                  <div key={i} className="flex-1 h-1 rounded-full" style={{ backgroundColor: auditProgress >= s.at ? COLORS.NAVY : COLORS.LIGHT_GREY }} />
                ))}
              </div>
            </div>
          )}

          {/* ── OMCS results ─────────────────────────────────────────── */}
          {auditDone && omcs && (
            <div className="space-y-4">

              {/* Top row: gauge + sub-scores */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                {/* Gauge + Pass/Fail */}
                <div className="p-6 rounded-xl border flex flex-col items-center justify-center text-center gap-3" style={{ backgroundColor: COLORS.CREAM, borderColor: COLORS.LIGHT_GREY }}>
                  <ComplianceGauge score={Math.round(omcs.omcsScore)} />
                  <StatusBadge status={omcs.status} />
                  <p className="text-[10px] font-bold" style={{ color: COLORS.TEXT_MUTED }}>
                    OMCS = <span className="font-black" style={{ color: COLORS.NAVY }}>{omcs.omcsScore.toFixed(2)}</span>
                    <span className="ml-1 opacity-60">(0.35×P)+(0.45×R)+(0.20×C)</span>
                  </p>
                </div>

                {/* Component scores */}
                <div className="md:col-span-2 flex flex-col gap-4">
                  <div className="p-4 rounded-xl border" style={{ backgroundColor: COLORS.CREAM, borderColor: COLORS.LIGHT_GREY }}>
                    <p className="text-[10px] font-black uppercase tracking-widest mb-3" style={{ color: COLORS.TEXT_MUTED }}>
                      OMCS Components
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      <ScoreChip label="Profile" score={omcs.profileSemanticScore} tooltip="Profile Semantic Score — business profile alignment (weight 0.35)" />
                      <ScoreChip label="Recommendations" score={omcs.recommendationsPictureScore} tooltip="Recommendations Picture Score — rubric total: image vs visual-guide recommendations (weight 0.45)" />
                      <ScoreChip label="Consistency" score={omcs.pubmatConsistencyScore} tooltip="Pubmat Consistency Score — caption ↔ image consistency (weight 0.20)" />
                    </div>
                  </div>

                  {/* Consistency rationale */}
                  {omcs.consistencyExplanation && (
                    <div className="flex-1 p-4 rounded-xl border" style={{ backgroundColor: COLORS.OFF_WHITE, borderLeftColor: COLORS.NAVY, borderLeftWidth: 4 }}>
                      <p className="text-[10px] font-black uppercase tracking-widest mb-1.5" style={{ color: COLORS.TEXT_MUTED }}>
                        Caption ↔ Image Consistency
                      </p>
                      <p className="text-sm font-medium leading-relaxed" style={{ color: COLORS.TEXT_MAIN }}>
                        {omcs.consistencyExplanation}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Rubric breakdown */}
              {rubricEntries.length > 0 && (
                <div className="p-4 rounded-xl border" style={{ backgroundColor: COLORS.WHITE, borderColor: COLORS.LIGHT_GREY }}>
                  <p className="text-[10px] font-black uppercase tracking-widest mb-3" style={{ color: COLORS.TEXT_MUTED }}>
                    Pubmat ↔ Recommendation Rubric
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                    {rubricEntries.map(([key, val]) => {
                      const num = typeof val === 'number' ? val : 0;
                      return (
                        <div key={key} className="flex items-center justify-between gap-3 text-xs">
                          <span className="font-medium" style={{ color: COLORS.TEXT_MAIN }}>{RUBRIC_LABELS[key] ?? key}</span>
                          <span className="font-black tabular-nums" style={{ color: num > 0 ? COLORS.NAVY : COLORS.RED_ORANGE }}>{num}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Feedback diagnostic — shown when the asset fails */}
              {omcs.feedback && omcs.status.toLowerCase() !== 'pass' && (
                <div className="p-4 rounded-xl border" style={{ backgroundColor: '#FFF8E1', borderColor: `${COLORS.GOLD}40` }}>
                  <p className="text-xs font-black uppercase tracking-widest mb-2" style={{ color: COLORS.GOLD }}>
                    ⚠ What Went Wrong — Actionable Feedback
                  </p>
                  <pre className="text-xs font-medium whitespace-pre-wrap leading-relaxed" style={{ color: COLORS.TEXT_MAIN, fontFamily: 'inherit' }}>
                    {omcs.feedback}
                  </pre>
                </div>
              )}

              <p className="text-[11px] font-medium" style={{ color: COLORS.TEXT_MUTED }}>
                Evaluated for travelers from <strong style={{ color: COLORS.NAVY }}>{marketCity}</strong> against the approved visual-guide recommendations.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SmartOptimizationBoard;
