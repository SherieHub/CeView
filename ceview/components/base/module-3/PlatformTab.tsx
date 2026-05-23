import React from 'react';
import { COLORS } from '../../../constants';

interface PlatformTabProps {
  id: string;
  label: string;
  icon: React.ReactNode;
  isActive: boolean;
  onClick: () => void;
}

const PlatformTab: React.FC<PlatformTabProps> = ({ label, icon, isActive, onClick }) => (
  <button 
    onClick={onClick} 
    className="flex-1 py-3 text-xs font-black transition-all border-b-2 flex items-center justify-center gap-2"
    style={{
      color: isActive ? COLORS.NAVY : COLORS.TEXT_MUTED,
      borderColor: isActive ? COLORS.NAVY : 'transparent',
      backgroundColor: isActive ? COLORS.OFF_WHITE : 'transparent'
    }}
  >
    <span className="flex items-center justify-center shrink-0">{icon}</span> {label}
  </button>
);

export default PlatformTab;