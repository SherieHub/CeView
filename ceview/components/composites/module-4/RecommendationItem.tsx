import React from 'react';
import { COLORS } from '../../../constants';

interface RecommendationItemProps {
  index: number;
  title: string;
  explanation: string;
}

const RecommendationItem: React.FC<RecommendationItemProps> = ({ index, title, explanation }) => (
  <div className="bg-slate-50 border border-slate-100 p-5 rounded-xl transition-colors relative group hover:border-[#F4A216]">
    <div 
      className="absolute -left-3 -top-3 w-8 h-8 rounded-full flex items-center justify-center font-black shadow-sm border transition-colors group-hover:border-[#F4A216]"
      style={{ backgroundColor: COLORS.CREAM, color: COLORS.GOLD, borderColor: '#E2E8F0' }}
    >
      {index}
    </div>
    <h4 className="font-bold text-md mb-2" style={{ color: COLORS.TEXT_MAIN }}>{title}</h4>
    <p className="text-sm leading-relaxed" style={{ color: COLORS.TEXT_MUTED }}>{explanation}</p>
  </div>
);

export default RecommendationItem;