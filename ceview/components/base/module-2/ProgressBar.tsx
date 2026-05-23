import React from 'react';
import { COLORS } from '../../../constants';

interface ProgressBarProps {
  score: number;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ score }) => {
  // Logic retained from original MarketPrediction
  const bgColor = score > 85 ? COLORS.RED_ORANGE : score > 75 ? COLORS.GOLD : COLORS.NAVY;

  return (
    <div className="h-2 w-full rounded-full overflow-hidden" style={{ backgroundColor: COLORS.OFF_WHITE }}>
      <div 
        className="h-full rounded-full transition-all duration-1000" 
        style={{ width: `${score}%`, backgroundColor: bgColor }} 
      />
    </div>
  );
};

export default ProgressBar;