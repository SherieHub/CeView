import React from 'react';
import { COLORS } from '../../../../constants';

interface StatTypographyProps {
  value: number;
  color: string;
  sizeClass?: string;
}

const StatTypography: React.FC<StatTypographyProps> = ({
  value,
  color,
  sizeClass = 'text-5xl'
}) => {
  return (
    <div className="flex items-baseline gap-1">
      <span className={`${sizeClass} font-black tracking-tight`} style={{ color }}>
        {value}
      </span>
      <span className="text-xl font-bold" style={{ color: COLORS.TEXT_MUTED }}>
        /100
      </span>
    </div>
  );
};

export default StatTypography;
