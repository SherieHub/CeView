import React from 'react';
import { Sparkles } from 'lucide-react';
import AdjustableCategoryItem from './AdjustableCategoryItem';
import { COLORS } from '../../../../constants';

export interface CategoryAllocation {
  name: string;
  percentage: number;
}

interface InferredCategoryBoardProps {
  categories: CategoryAllocation[];
}

const InferredCategoryBoard: React.FC<InferredCategoryBoardProps> = ({ categories }) => (
  <div className="p-6 md:p-8 rounded-2xl border bg-white shadow-sm mb-6 animate-fade-in" style={{ borderColor: COLORS.LIGHT_GREY }}>
    <div className="flex items-start justify-between mb-6">
      <div>
        <h4 className="text-sm font-black uppercase tracking-wider flex items-center gap-1.5" style={{ color: COLORS.NAVY }}>
          <Sparkles size={16} style={{ color: COLORS.GOLD, fill: COLORS.GOLD }} />
          AI-Inferred Operational Categories
        </h4>
        <p className="text-sm font-medium mt-1" style={{ color: COLORS.TEXT_MUTED }}>
          These category weightings were derived automatically from your business details.
        </p>
      </div>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {categories.map((cat) => (
        <AdjustableCategoryItem key={cat.name} label={cat.name} percentage={cat.percentage} />
      ))}
    </div>
  </div>
);

export default InferredCategoryBoard;
