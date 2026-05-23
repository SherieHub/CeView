import React from 'react';
import { COLORS } from '../../../constants';

interface QualitativeLabelProps {
  label: string;
}

const QualitativeLabel: React.FC<QualitativeLabelProps> = ({ label }) => (
  <span 
    className="px-4 py-1 rounded-full font-bold text-sm uppercase tracking-wide border mt-4 z-10"
    style={{ backgroundColor: COLORS.LIGHT_GREY, color: COLORS.NAVY, borderColor: '#D2E1F3' }}
  >
    {label}
  </span>
);

export default QualitativeLabel;