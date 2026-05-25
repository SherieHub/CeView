import React, { useState } from 'react';
import { COLORS } from '../../../../constants';

interface AdjustableCategoryItemProps {
  label: string;
  percentage: number;
  onChange: (newPercentage: number) => void;
}

const AdjustableCategoryItem: React.FC<AdjustableCategoryItemProps> = ({ label, percentage, onChange }) => {
  const [isHovered, setIsHovered] = useState(false);
  const isActive = percentage > 0;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = parseInt(e.target.value, 10);
    if (isNaN(val)) val = 0;
    if (val > 100) val = 100;
    if (val < 0) val = 0;
    onChange(val);
  };

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="flex items-center justify-between p-3 rounded-xl border transition-all duration-200"
      style={{
        backgroundColor: isActive ? COLORS.NAVY : COLORS.WHITE,
        borderColor: isHovered ? COLORS.SKYBLUE : (isActive ? COLORS.NAVY : COLORS.LIGHT_GREY),
        boxShadow: isHovered ? `0 4px 12px ${COLORS.SKYBLUE}20` : 'none',
      }}
    >
      <span
        className="text-xs font-black uppercase tracking-wider"
        style={{ color: isActive ? COLORS.WHITE : COLORS.TEXT_MUTED }}
      >
        {label}
      </span>

      <div className="flex items-center gap-1">
        <input
          type="number"
          min="0"
          max="100"
          value={percentage}
          onChange={handleInputChange}
          className="w-14 px-2 py-1 text-right text-sm font-bold rounded-md border focus:outline-none focus:ring-2 transition-colors"
          style={{
            backgroundColor: isActive ? 'rgba(255,255,255,0.1)' : COLORS.OFF_WHITE,
            borderColor: isActive ? 'rgba(255,255,255,0.2)' : COLORS.LIGHT_GREY,
            color: isActive ? COLORS.WHITE : COLORS.TEXT_MAIN,
            outlineColor: COLORS.SKYBLUE
          }}
        />
        <span className="text-xs font-black" style={{ color: isActive ? COLORS.WHITE : COLORS.TEXT_MUTED }}>%</span>
      </div>
    </div>
  );
};

export default AdjustableCategoryItem;
