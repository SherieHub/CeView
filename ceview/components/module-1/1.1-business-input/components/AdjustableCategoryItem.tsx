import React from 'react';
import { X, Plus } from 'lucide-react';
import { COLORS } from '../../../../constants';

interface AdjustableCategoryItemProps {
  label: string;
  percentage?: number;
  mode: 'selected' | 'addable';
  onToggle: () => void;
  disabled?: boolean;
}

const AdjustableCategoryItem: React.FC<AdjustableCategoryItemProps> = ({
  label, percentage, mode, onToggle, disabled = false,
}) => {
  const isSelected = mode === 'selected';

  return (
    <div
      className="flex items-center justify-between p-3 rounded-xl border transition-all"
      style={{
        backgroundColor: isSelected ? COLORS.NAVY : COLORS.CREAM,
        borderColor: isSelected ? COLORS.NAVY : COLORS.GOLD,
      }}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <span
          className="text-xs font-black uppercase tracking-wider truncate"
          style={{ color: isSelected ? COLORS.WHITE : COLORS.TEXT_MUTED }}
        >
          {label}
        </span>

        {percentage !== undefined && (
          <span
            className="text-[10px] font-black px-1.5 py-0.5 rounded-md shrink-0 ml-auto mr-2"
            style={
              isSelected
                ? { backgroundColor: `${COLORS.WHITE}20`, color: COLORS.WHITE }
                : { backgroundColor: `${COLORS.GOLD}20`, color: COLORS.GOLD }
            }
          >
            {Math.round(percentage)}%
          </span>
        )}
      </div>

      <button
        onClick={onToggle}
        disabled={disabled}
        className="shrink-0 flex items-center justify-center w-5 h-5 rounded-full transition-all"
        style={{
          backgroundColor: isSelected
            ? disabled ? `${COLORS.WHITE}30` : `${COLORS.WHITE}20`
            : `${COLORS.GOLD}20`,
          color: isSelected
            ? disabled ? `${COLORS.WHITE}50` : COLORS.WHITE
            : COLORS.GOLD,
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
        title={isSelected ? 'Remove category' : 'Add category'}
      >
        {isSelected ? <X size={11} /> : <Plus size={11} />}
      </button>
    </div>
  );
};

export default AdjustableCategoryItem;
