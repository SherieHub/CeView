import React from 'react';
import { COLORS } from '../../../constants';

interface MetricHighlightProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}

const MetricHighlight: React.FC<MetricHighlightProps> = ({ icon, label, value, color }) => (
  <div className="flex flex-col p-4 md:p-5">
    <div className="flex items-center gap-1.5 mb-1.5" style={{ color }}>
      {icon}
      <span className="text-xs font-black uppercase tracking-wider">{label}</span>
    </div>
    <span className="text-base font-black leading-tight" style={{ color: COLORS.NAVY }}>{value}</span>
  </div>
);

export default MetricHighlight;