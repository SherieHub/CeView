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
  allCategories: CategoryAllocation[];
  selectedCategories: string[];
  onToggle: (name: string) => void;
}

const InferredCategoryBoard: React.FC<InferredCategoryBoardProps> = ({
  allCategories, selectedCategories, onToggle,
}) => {
  const percentageMap = Object.fromEntries(allCategories.map(c => [c.name, c.percentage]));
  // Always show all 7 sorted by model score descending; fallback to 0% for any not returned
  const fullList: CategoryAllocation[] = ALL_CATEGORIES
    .map(name => ({ name, percentage: percentageMap[name] ?? 0 }))
    .sort((a, b) => b.percentage - a.percentage);
  const unselected = fullList.filter(c => !selectedCategories.includes(c.name));

  return (
    <div className="p-6 md:p-8 rounded-2xl border bg-white shadow-sm mb-6 animate-fade-in" style={{ borderColor: COLORS.LIGHT_GREY }}>
      <div className="mb-6">
        <h4 className="text-sm font-black uppercase tracking-wider flex items-center gap-1.5" style={{ color: COLORS.NAVY }}>
          <Sparkles size={16} style={{ color: COLORS.GOLD, fill: COLORS.GOLD }} />
          Business Categories
        </h4>
        <p className="text-sm font-medium mt-1" style={{ color: COLORS.TEXT_MUTED }}>
          Each category shows how strongly it matches your profile. Select the ones that best represent your business.
        </p>
      </div>

      {/* ── Selected categories ──────────────────────────────────────────── */}
      {selectedCategories.length > 0 && (
        <div className="mb-5">
          <p className="text-xs font-black uppercase tracking-wider mb-2" style={{ color: COLORS.TEXT_MUTED }}>
            Your Categories
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {selectedCategories.map(name => (
              <AdjustableCategoryItem
                key={name}
                label={name}
                percentage={percentageMap[name] ?? 0}
                mode="selected"
                onToggle={() => onToggle(name)}
                disabled={selectedCategories.length <= 1}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── All unselected categories ────────────────────────────────────── */}
      {unselected.length > 0 && (
        <div>
          <p className="text-xs font-black uppercase tracking-wider mb-2" style={{ color: COLORS.TEXT_MUTED }}>
            {selectedCategories.length === 0 ? 'Select Your Categories' : 'Add More'}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {unselected.map(c => (
              <AdjustableCategoryItem
                key={c.name}
                label={c.name}
                percentage={c.percentage}
                mode="addable"
                onToggle={() => onToggle(c.name)}
              />
            ))}
          </div>
        </div>
      )}

      {selectedCategories.length === 0 && (
        <p className="text-xs font-medium mt-4 text-center" style={{ color: COLORS.TEXT_MUTED }}>
          Select at least one category to proceed.
        </p>
      )}
    </div>
  );
};

export default InferredCategoryBoard;
