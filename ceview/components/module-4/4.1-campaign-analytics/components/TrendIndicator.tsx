import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { COLORS } from '../../../../constants';

interface TrendIndicatorProps {
  trend: number;
  unit: string;
  isPositive: boolean;
}

const TrendIndicator: React.FC<TrendIndicatorProps> = ({ trend, unit, isPositive }) => {
  const TrendIcon = isPositive ? TrendingUp : TrendingDown;
  const trendColor = isPositive ? '#10B981' : COLORS.RED;

  return (
    <div className="flex items-center mt-2 text-xs font-bold" style={{ color: trendColor }}>
      <TrendIcon size={14} className="mr-1" />
      <span>{trend > 0 ? '+' : ''}{trend}{unit} vs last period</span>
    </div>
  );
};

export default TrendIndicator;
