import React from 'react';
import { CheckCircle, AlertTriangle } from 'lucide-react';
import { COLORS } from '../../../../constants';

interface FeedbackListProps {
  type: 'pros' | 'cons';
  items: string[];
}

const FeedbackList: React.FC<FeedbackListProps> = ({ type, items }) => {
  const isPros = type === 'pros';
  const mainColor = isPros ? COLORS.GREEN : COLORS.RED_ORANGE;
  const bgColor = isPros ? COLORS.GREEN_LIGHT : COLORS.GOLD_LIGHT;
  const Icon = isPros ? CheckCircle : AlertTriangle;
  const symbol = isPros ? '✓' : '⚠';

  return (
    <div className="p-5 rounded-xl border" style={{ backgroundColor: bgColor, borderColor: `${mainColor}40` }}>
      <h3 className="text-sm font-black uppercase tracking-wider mb-4 flex items-center gap-2" style={{ color: mainColor }}>
        <Icon size={16} /> {isPros ? 'What You Did Great' : 'Tips to Improve'}
      </h3>
      {items.map((item, i) => (
        <p key={i} className="text-xs font-bold leading-relaxed mb-2 border p-2 bg-white/70 rounded-lg shadow-2xs">
          {symbol} {item}
        </p>
      ))}
    </div>
  );
};

export default FeedbackList;
