import React, { useState } from 'react';
import TrendIndicator from '../../base/module-4/TrendIndicator';
import { COLORS } from '../../../constants';

interface KpiMetricCardProps {
  title: string;
  data: any;
  icon: React.ReactNode;
  tooltip: React.ReactNode;
  inverseLogic?: boolean;
}

const KpiMetricCard: React.FC<KpiMetricCardProps> = ({ title, data, icon, tooltip, inverseLogic = false }) => {
  const isPositiveTrend = inverseLogic ? !data.isPositive : data.isPositive;
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div 
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="bg-white p-5 rounded-2xl shadow-sm border flex flex-col justify-between group relative hover:shadow-md transition-shadow" 
      style={{ borderColor: isHovered ? COLORS.TEXT_MUTED : COLORS.LIGHT_GREY }}
    > 
      <div className="absolute top-0 left-0 w-full h-full text-white text-xs p-3 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-10 pointer-events-none text-center" style={{ backgroundColor: COLORS.WHITE}}>
        {tooltip}
      </div>
      <div className="flex justify-between items-start mb-2">
        <p className="text-sm font-bold" style={{ color: COLORS.TEXT_MUTED }}>{title}</p>
        <div className="p-2 rounded-lg border" style={{ backgroundColor: COLORS.CREAM, color: COLORS.NAVY, borderColor: '#E2E8F0' }}>
          {icon}
        </div>
      </div>
      <div>
        <h3 className="text-2xl font-black" style={{ color: COLORS.TEXT_MAIN }}>
          {title === 'CPC' || title === 'CAC' ? data.unit : ''}{data.value}{title !== 'CPC' && title !== 'CAC' ? data.unit : ''}
        </h3>
        <TrendIndicator trend={data.trend} unit={data.unit} isPositive={isPositiveTrend} />
      </div>
    </div>
  );
};

export default KpiMetricCard;