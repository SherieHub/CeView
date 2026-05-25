import React from 'react';
import { COLORS } from '../../../../constants';

interface AdjustableCategoryItemProps {
  label: string;
  percentage: number;
}

const AdjustableCategoryItem: React.FC<AdjustableCategoryItemProps> = ({ label, percentage }) => {
  const isActive = percentage > 0;

  return (
    <div
      className="flex items-center justify-between p-3 rounded-xl border"
      style={{
        backgroundColor: isActive ? COLORS.NAVY : COLORS.WHITE,
        borderColor: isActive ? COLORS.NAVY : COLORS.LIGHT_GREY,
      }}
    >
      <span
        className="text-xs font-black uppercase tracking-wider"
        style={{ color: isActive ? COLORS.WHITE : COLORS.TEXT_MUTED }}
      >
        {label}
      </span>

      <div className="flex items-center gap-1">
        <span
          className="text-sm font-bold"
          style={{ color: isActive ? COLORS.WHITE : COLORS.TEXT_MUTED }}
        >
          {percentage}
        </span>
        <span className="text-xs font-black" style={{ color: isActive ? COLORS.WHITE : COLORS.TEXT_MUTED }}>%</span>
      </div>
    </div>
  );
};

export default AdjustableCategoryItem;
