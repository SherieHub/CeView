import React, { useRef, useEffect } from 'react';
import { Shield, ToggleLeft, ToggleRight } from 'lucide-react';
import AuditEmptyBanner from '../../composites/module-3/AuditEmptyBanner';
import ComplianceGauge from '../../composites/module-3/ComplianceGauge';
import ChecklistIndicator from '../../composites/module-3/ChecklistIndicator';
import FeedbackList from '../../composites/module-3/FeedbackList';
import { COLORS } from '../../../constants';

interface SmartOptimizationBoardProps {
  auditOn: boolean;
  setAuditOn: (val: boolean) => void;
  hasFile: boolean;
  auditRunning: boolean;
  auditDone: boolean;
  auditProgress: number;
  onRunAudit: () => void;
  onResetAudit: () => void;
  mockData: any;
  auditSteps: any[];
}

const SmartOptimizationBoard: React.FC<SmartOptimizationBoardProps> = ({ 
  auditOn, setAuditOn, hasFile, auditRunning, auditDone, auditProgress, onRunAudit, onResetAudit, mockData, auditSteps 
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

  return (
    <div className="rounded-2xl shadow-sm border overflow-hidden transition-all duration-300" style={{ backgroundColor: COLORS.WHITE, borderColor: auditOn ? COLORS.NAVY : COLORS.LIGHT_GREY }}>
      <div className="p-5 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b" style={{ borderColor: auditOn ? COLORS.LIGHT_GREY : 'transparent' }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center transition-all shrink-0" style={{ backgroundColor: auditOn ? COLORS.GOLD : COLORS.LIGHT_GREY }}>
            <Shield size={18} style={{ color: auditOn ? COLORS.WHITE : COLORS.NAVY }} />
          </div>
          <div>
            <h2 className="text-base font-black leading-tight" style={{ color: COLORS.NAVY }}>Smart Optimization Audit</h2>
            <p className="text-xs font-bold uppercase tracking-wider mt-0.5" style={{ color: COLORS.TEXT_MUTED }}>
              Content Review <span className="ml-2 px-2 py-0.5 rounded text-[9px]" style={{ backgroundColor: COLORS.GOLD_LIGHT, color: COLORS.GOLD }}>OPTIONAL</span>
            </p>
          </div>
        </div>
        <button onClick={toggleAudit} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-black transition-all border shadow-sm shrink-0" style={{ backgroundColor: auditOn ? COLORS.NAVY : COLORS.WHITE, borderColor: auditOn ? COLORS.NAVY : COLORS.LIGHT_GREY, color: auditOn ? COLORS.WHITE : COLORS.TEXT_MUTED }}>
          {auditOn ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
          {auditOn ? 'Audit Active' : 'Activate Audit'}
        </button>
      </div>

      {auditOn && (
        <div className="p-5 md:p-6 bg-white">
          {!hasFile && <AuditEmptyBanner />}

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

          {auditDone && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-6 rounded-xl border flex flex-col items-center justify-center text-center" style={{ backgroundColor: COLORS.CREAM, borderColor: COLORS.LIGHT_GREY }}>
                  <ComplianceGauge score={mockData.compliance.score} />
                  <div className="mt-4 px-3 py-1 rounded-lg border text-xs font-black" style={{ backgroundColor: COLORS.GREEN_LIGHT, borderColor: `${COLORS.GREEN}40`, color: COLORS.GREEN }}>
                    ✓ Great Content
                  </div>
                </div>
                <div className="md:col-span-2 flex flex-col gap-4">
                  <ChecklistIndicator />
                  <div className="flex-1 p-4 rounded-xl border flex items-center" style={{ backgroundColor: COLORS.OFF_WHITE, borderLeftColor: COLORS.NAVY, borderLeftWidth: 4 }}>
                    <p className="text-sm font-medium leading-relaxed" style={{ color: COLORS.TEXT_MAIN }}>
                      <strong className="font-black" style={{ color: COLORS.NAVY }}>{mockData.compliance.score}% Marketing Score</strong> — Your content creates the right emotional feeling for travelers from <strong className="font-black">{mockData.market.city}</strong>.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FeedbackList type="pros" items={mockData.compliance.aligned} />
                <FeedbackList type="cons" items={mockData.compliance.gaps} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SmartOptimizationBoard;