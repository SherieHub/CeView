import React from 'react';
import { COLORS } from '../../../../constants';

interface BlueprintStepItemProps {
  index: number;
  text: string;
}

const BlueprintStepItem: React.FC<BlueprintStepItemProps> = ({ index, text }) => (
  <div className="flex gap-3 mb-3 p-3.5 rounded-xl border transition-all" style={{ backgroundColor: index % 2 !== 0 ? COLORS.CREAM : COLORS.OFF_WHITE, borderColor: COLORS.LIGHT_GREY }}>
    <div className="w-6 h-6 rounded-full flex shrink-0 items-center justify-center text-xs font-black text-white" style={{ backgroundColor: COLORS.NAVY }}>
      {index}
    </div>
    <p className="text-sm font-medium leading-relaxed" style={{ color: COLORS.TEXT_MAIN }}>{text}</p>
  </div>
);

export default BlueprintStepItem;
