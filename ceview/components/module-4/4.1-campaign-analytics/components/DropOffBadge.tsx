import React from 'react';
import { COLORS } from '../../../../constants';

interface DropOffBadgeProps {
  dropoff: string;
}

const DropOffBadge: React.FC<DropOffBadgeProps> = ({ dropoff }) => (
  <div className="flex flex-col items-center animate-fade-in">
    <div className="w-px h-6 bg-red-200 mb-1"></div>
    <span
      className="text-xs font-bold bg-red-50 px-2 py-1 rounded border border-red-100"
      style={{ color: COLORS.RED_ORANGE }}
    >
      {dropoff} Loss
    </span>
  </div>
);

export default DropOffBadge;
