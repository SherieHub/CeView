import React from 'react';
import { Check } from 'lucide-react';
import { COLORS } from '../../../constants';

interface PlatformSyncCardProps {
  channel: any;
  isSelected: boolean;
  onToggle: () => void;
}

const PlatformSyncCard: React.FC<PlatformSyncCardProps> = ({ channel, isSelected, onToggle }) => (
  <button 
    onClick={onToggle} 
    className="p-5 rounded-2xl border text-center transition-all duration-300 relative flex flex-col items-center justify-center min-h-[140px]"
    style={{
      borderColor: isSelected ? COLORS.NAVY : COLORS.LIGHT_GREY,
      backgroundColor: isSelected ? 'rgba(15,40,84,0.03)' : COLORS.CREAM,
      transform: isSelected ? 'scale(1.02)' : 'scale(1)',
      boxShadow: isSelected ? `0 4px 16px ${COLORS.NAVY}20` : 'none',
    }}
  >
    {isSelected && (
      <div className="absolute top-3 right-3 w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: COLORS.NAVY }}>
        <Check size={12} color={COLORS.WHITE} strokeWidth={3} />
      </div>
    )}
    <div className="mb-3 flex items-center justify-center">{channel.icon}</div>
    <p className="text-sm font-black mb-1" style={{ color: COLORS.NAVY }}>{channel.label}</p>
    <p className="text-xs font-medium mb-3" style={{ color: COLORS.TEXT_MUTED }}>{channel.handle}</p>
    <div className="flex items-center justify-center gap-1.5">
      <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: channel.verified ? COLORS.GREEN : COLORS.GOLD }} />
      <span className="text-[10px] font-black uppercase tracking-wider" style={{ color: channel.verified ? COLORS.GREEN : COLORS.GOLD }}>
        {channel.verified ? 'Token Active' : 'Auth Pending'}
      </span>
    </div>
  </button>
);

export default PlatformSyncCard;