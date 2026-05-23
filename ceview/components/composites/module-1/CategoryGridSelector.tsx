import React from 'react';
import ActionTag from '../../base/module-1/ActionTag';
import { COLORS } from '../../../constants';

interface CategoryGridSelectorProps {
  options: string[];
  selectedCategories: string[];
  onChange: (categories: string[]) => void;
}

const CategoryGridSelector: React.FC<CategoryGridSelectorProps> = ({ options, selectedCategories, onChange }) => {
  const toggleCategory = (cat: string) => {
    if (selectedCategories.includes(cat)) {
      onChange(selectedCategories.filter(c => c !== cat));
    } else {
      onChange([...selectedCategories, cat]);
    }
  };

  return (
    <div className="mb-4">
      <label className="text-xs font-black uppercase tracking-wider block mb-1.5" style={{ color: COLORS.TEXT_MUTED }}>
        Active Operational Categories
      </label>
      <div className="flex flex-wrap gap-2 p-3 rounded-xl border min-h-[56px]" style={{ borderColor: COLORS.LIGHT_GREY, backgroundColor: COLORS.WHITE }}>
        {options.map(cat => (
          <ActionTag 
            key={cat} 
            label={cat} 
            isActive={selectedCategories.includes(cat)} 
            onClick={() => toggleCategory(cat)} 
          />
        ))}
      </div>
    </div>
  );
};

export default CategoryGridSelector;