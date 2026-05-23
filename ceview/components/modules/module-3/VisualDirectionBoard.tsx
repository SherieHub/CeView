import React from 'react';
import { Eye } from 'lucide-react';
import BlueprintStepItem from '../../composites/module-3/BlueprintStepItem';
import { COLORS } from '../../../constants';

interface VisualDirectionBoardProps {
  guide: string[];
}

const VisualDirectionBoard: React.FC<VisualDirectionBoardProps> = ({ guide }) => (
  <div className="rounded-2xl shadow-sm border overflow-hidden flex flex-col max-h-[600px]" style={{ backgroundColor: COLORS.WHITE, borderColor: COLORS.LIGHT_GREY }}>
    <div className="p-5 border-b flex items-center gap-3 shrink-0" style={{ borderColor: COLORS.LIGHT_GREY }}>
      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${COLORS.NAVY}12` }}>
        <Eye size={16} style={{ color: COLORS.NAVY }} />
      </div>
      <div>
        <h2 className="text-base font-black leading-tight" style={{ color: COLORS.NAVY }}>Visual Direction Guide</h2>
        <p className="text-xs font-bold uppercase tracking-wider mt-0.5" style={{ color: COLORS.TEXT_MUTED }}>AI Staging Blueprint</p>
      </div>
    </div>
    
    <div className="p-5 overflow-y-auto flex-1">
      {guide.map((step, i) => (
        <BlueprintStepItem key={i} index={i + 1} text={step} />
      ))}
    </div>
  </div>
);

export default VisualDirectionBoard;