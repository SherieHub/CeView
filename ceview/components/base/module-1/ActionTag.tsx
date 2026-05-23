import React from 'react';
import { X as XIcon } from 'lucide-react';
import { COLORS } from '../../../constants';

interface ActionTagProps {
  label: string;
  isActive?: boolean;
  onClick?: () => void;
  onRemove?: () => void;
}

const ActionTag: React.FC<ActionTagProps> = ({ label, isActive = true, onClick, onRemove }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all border"
      style={{
        backgroundColor: isActive ? COLORS.NAVY : COLORS.WHITE,
        color: isActive ? COLORS.WHITE : COLORS.TEXT_MUTED,
        borderColor: isActive ? COLORS.NAVY : COLORS.LIGHT_GREY,
        cursor: onClick ? 'pointer' : 'default'
      }}
    >
      {label}
      {onRemove && (
        <span 
          onClick={(e) => { e.stopPropagation(); onRemove(); }} 
          className="hover:opacity-70 cursor-pointer ml-1"
        >
          <XIcon size={12} />
        </span>
      )}
    </button>
  );
};

export default ActionTag;