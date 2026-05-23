import React from 'react';
import { Sparkles, Check, X as XIcon, AlertTriangle } from 'lucide-react';
import AdjustableCategoryItem from '../../composites/module-1/AdjustableCategoryItem';
import { COLORS } from '../../../constants';

export interface CategoryAllocation {
  name: string;
  percentage: number;
}

interface InferredCategoryBoardProps {
  categories: CategoryAllocation[];
  onChangeCategory: (name: string, newPercentage: number) => void;
}

const InferredCategoryBoard: React.FC<InferredCategoryBoardProps> = ({ categories, onChangeCategory }) => {
  const totalPercentage = categories.reduce((sum, cat) => sum + cat.percentage, 0);
  const isValid = totalPercentage === 100;

  return (
    <div className="p-6 md:p-8 rounded-2xl border bg-white shadow-sm mb-6 animate-fade-in" style={{ borderColor: COLORS.LIGHT_GREY }}>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h4 className="text-sm font-black uppercase tracking-wider flex items-center gap-1.5" style={{ color: COLORS.NAVY }}>
            <Sparkles size={16} style={{ color: COLORS.GOLD, fill: COLORS.GOLD }} />
            AI-Inferred Operational Categories
          </h4>
          <p className="text-sm font-medium mt-1" style={{ color: COLORS.TEXT_MUTED }}>
            CeView assigned these categories. Adjust the percentages below to ensure they total 100%.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
        {categories.map((cat) => (
          <AdjustableCategoryItem
            key={cat.name}
            label={cat.name}
            percentage={cat.percentage}
            onChange={(val) => onChangeCategory(cat.name, val)}
          />
        ))}
      </div>

      {/* Validation Row */}
      <div className={`flex items-center justify-between p-4 rounded-xl border ${!isValid ? 'bg-red-50' : 'bg-green-50'}`} style={{ borderColor: !isValid ? COLORS.RED_ORANGE : COLORS.GREEN }}>
        <div className="flex items-center gap-2">
          {!isValid && <AlertTriangle size={18} style={{ color: COLORS.RED_ORANGE }} />}
          <span className="text-sm font-bold" style={{ color: !isValid ? COLORS.RED_ORANGE : COLORS.GREEN }}>
            {isValid ? 'Allocation Balanced (100%)' : `Total Allocation: ${totalPercentage}% (Must be 100%)`}
          </span>
        </div>
        <span className={`text-lg font-black ${!isValid ? 'text-red-600' : 'text-green-600'}`}>
          {totalPercentage}%
        </span>
      </div>
    </div>
  );
};

export default InferredCategoryBoard;