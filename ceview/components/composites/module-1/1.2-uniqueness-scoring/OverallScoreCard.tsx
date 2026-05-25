import React from 'react';
import StatTypography from '../../../base/module-1/1.2-uniqueness-scoring/StatTypography';
import { COLORS } from '../../../../constants';

interface OverallScoreCardProps {
  score: number;
}

const OverallScoreCard: React.FC<OverallScoreCardProps> = ({ score }) => {
  return (
    <div className="p-6 rounded-2xl border bg-white shadow-sm" style={{ borderColor: COLORS.NAVY }}>
      <h4 className="text-xs font-black uppercase tracking-wider mb-2" style={{ color: COLORS.TEXT_MUTED }}>
        Overall Uniqueness Score
      </h4>
      <StatTypography value={score} color={COLORS.NAVY} sizeClass="text-5xl" />
    </div>
  );
};

export default OverallScoreCard;
