import React from 'react';
import { Sparkles } from 'lucide-react';
import AdjustableCategoryItem from './AdjustableCategoryItem';
import { COLORS } from '../../../../constants';

export interface CategoryAllocation {
  name: string;
  percentage: number;
}

const ALL_CATEGORIES = [
  'Coastal & Island',
  'Adventure & Nature',
  'Cultural & Heritage',
  'Theme Parks / Entertainment',
  'Urban & City',
  'Culinary & Gastronomy',
  'Accommodation & Staycation',
];

interface InferredCategoryBoardProps {
  topCategories: CategoryAllocation[];
  selectedCategories: string[];
  onToggle: (name: string) => void;
}

const InferredCategoryBoard: React.FC<InferredCategoryBoardProps> = ({
  topCategories, selectedCategories, onToggle,
}) => {
  const addable = ALL_CATEGORIES.filter(n => !selectedCategories.includes(n));
  const percentageMap = Object.fromEntries(topCategories.map(c => [c.name, c.percentage]));

  return (
    <div className="p-6 md:p-8 rounded-2xl border bg-white shadow-sm mb-6 animate-fade-in" style={{ borderColor: COLORS.LIGHT_GREY }}>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h4 className="text-sm font-black uppercase tracking-wider flex items-center gap-1.5" style={{ color: COLORS.NAVY }}>
            <Sparkles size={16} style={{ color: COLORS.GOLD, fill: COLORS.GOLD }} />
            AI-Predicted Categories
          </h4>
          <p className="text-sm font-medium mt-1" style={{ color: COLORS.TEXT_MUTED }}>
            Top 3 predicted by the ML model. Remove any that don't fit, or add more below.
          </p>
        </div>
      </div>

      {/* ── Selected categories ──────────────────────────────────────────── */}
      <div className="mb-5">
        <p className="text-xs font-black uppercase tracking-wider mb-2" style={{ color: COLORS.TEXT_MUTED }}>
          Selected
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {selectedCategories.map(name => (
            <AdjustableCategoryItem
              key={name}
              label={name}
              percentage={percentageMap[name]}
              mode="selected"
              onToggle={() => onToggle(name)}
              disabled={selectedCategories.length <= 1}
            />
          ))}
        </div>
      </div>

      {/* ── Addable categories ───────────────────────────────────────────── */}
      {addable.length > 0 && (
        <div>
          <p className="text-xs font-black uppercase tracking-wider mb-2" style={{ color: COLORS.TEXT_MUTED }}>
            Add a Category
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {addable.map(name => (
              <AdjustableCategoryItem
                key={name}
                label={name}
                mode="addable"
                onToggle={() => onToggle(name)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default InferredCategoryBoard;
