import React from 'react';
import { Zap } from 'lucide-react';
import { COLORS } from '../../../constants'; // Adjust import path as needed

const SurgeBadge: React.FC = () => (
  <div className="absolute -top-2 -right-2 flex items-center gap-1 px-2 py-1 rounded-full text-xs font-black shadow-md" style={{ backgroundColor: COLORS.RED_ORANGE, color: COLORS.WHITE }}>
    <Zap size={10} color={COLORS.WHITE} style={{ fill: COLORS.WHITE }} /> SURGE
  </div>
);

export default SurgeBadge;