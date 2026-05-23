import React from 'react';
import StatTypography from '../../base/module-1/StatTypography';
import { COLORS } from '../../../constants';

interface ActionableScoreCardProps {
  title: string;
  score: number;
  color: string; // Dynamic border and text color (Teal or Gold)
  description: string;
  feedbackText: string;
}

const ActionableScoreCard: React.FC<ActionableScoreCardProps> = ({ 
  title, 
  score, 
  color, 
  description, 
  feedbackText 
}) => {
  return (
    <div className="p-6 rounded-2xl border bg-white shadow-sm" style={{ borderColor: color }}>
      <h4 className="text-xs font-black uppercase tracking-wider mb-2" style={{ color: COLORS.TEXT_MUTED }}>
        {title}
      </h4>
      
      <div className="mb-4">
        <StatTypography value={score} color={color} sizeClass="text-4xl" />
      </div>
      
      <p className="text-xs font-medium mb-3 leading-relaxed" style={{ color: COLORS.TEXT_MUTED }}>
        {description}
      </p>
      
      <p className="text-xs font-bold leading-relaxed" style={{ color: COLORS.NAVY }}>
        {feedbackText}
      </p>
    </div>
  );
};

export default ActionableScoreCard;