import React from 'react';
import { Zap } from 'lucide-react';
import { COLORS } from '../../../../constants';

interface StrategicDirectivePanelProps {
  directive: string;
  onNavigateToContent?: () => void;
}

const StrategicDirectivePanel: React.FC<StrategicDirectivePanelProps> = ({ directive, onNavigateToContent }) => (
  <div className="p-4 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6" style={{ backgroundColor: COLORS.NAVY }}>
    <div className="flex-1">
      <div className="flex items-center gap-2 mb-2">
        <Zap size={16} color={COLORS.GOLD} style={{ fill: COLORS.GOLD }} />
        <h2 className="text-xs font-black uppercase tracking-widest" style={{ color: COLORS.LIGHT_GOLD }}>AI Strategic Directive</h2>
      </div>
      <p className="text-base md:text-xl font-medium leading-relaxed" style={{ color: COLORS.WHITE }}>{directive}</p>
    </div>
    <button
      onClick={onNavigateToContent}
      className="shrink-0 px-6 py-4 rounded-xl text-md font-black transition-all hover:scale-105 shadow-lg w-full md:w-auto text-center hover:opacity-90"
      style={{ backgroundColor: COLORS.GOLD, color: COLORS.WHITE }}
    >
      Generate Content
    </button>
  </div>
);

export default StrategicDirectivePanel;
