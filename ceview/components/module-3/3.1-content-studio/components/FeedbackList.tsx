import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { COLORS } from '../../../../constants';

interface FeedbackListProps {
  type: 'cons';
  items: string[];
}

const FeedbackList: React.FC<FeedbackListProps> = ({ items }) => {
  return (
    <div className="p-5 rounded-xl border" style={{ backgroundColor: COLORS.GOLD_LIGHT, borderColor: `${COLORS.RED_ORANGE}40` }}>
      <h3 className="text-sm font-black uppercase tracking-wider mb-4 flex items-center gap-2" style={{ color: COLORS.RED_ORANGE }}>
        <AlertTriangle size={16} /> Tips to Improve
      </h3>
      {items.map((item, i) => (
        <p key={i} className="text-xs font-bold leading-relaxed mb-2 border p-2 bg-white/70 rounded-lg shadow-2xs">
          ⚠ {item}
        </p>
      ))}
    </div>
  );
};

export default FeedbackList;
