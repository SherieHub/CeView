import React from 'react';
import { COLORS } from '../../../../constants';

const ComplianceGauge: React.FC<{ score: number }> = ({ score }) => {
  const r = 52;
  const circ = 2 * Math.PI * r;
  const fill = (score / 100) * circ;
  const col = score >= 80 ? COLORS.GREEN : score >= 60 ? COLORS.GOLD : COLORS.RED_ORANGE;

  return (
    <div className="relative mx-auto" style={{ width: 136, height: 136 }}>
      <svg width="136" height="136" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="68" cy="68" r={r} fill="none" stroke={COLORS.LIGHT_GREY} strokeWidth="9" />
        <circle
          cx="68" cy="68" r={r} fill="none" stroke={col} strokeWidth="9"
          strokeDasharray={`${fill} ${circ}`} strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 1.6s cubic-bezier(0.22,1,0.36,1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-black leading-none tracking-tight" style={{ color: col }}>{score}%</span>
        <span className="text-[9px] font-black tracking-widest mt-1" style={{ color: COLORS.TEXT_MUTED }}>COMPLIANCE</span>
      </div>
    </div>
  );
};

export default ComplianceGauge;
