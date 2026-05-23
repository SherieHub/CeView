import React, { useState } from 'react';
import { Bell, ChevronRight } from 'lucide-react';
import { Notification } from '../../../types';
import { COLORS } from '../../../constants';

interface TrendAlertCardProps {
  notif: Notification;
  onClick: () => void;
}

const TrendAlertCard: React.FC<TrendAlertCardProps> = ({ notif, onClick }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="p-6 rounded-xl shadow-sm border transition-all duration-200 cursor-pointer relative overflow-hidden"
      style={{
        backgroundColor: COLORS.WHITE,
        borderColor: isHovered ? COLORS.GOLD : COLORS.LIGHT_GREY,
        boxShadow: isHovered ? '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)' : '',
        borderWidth: isHovered ? '2px' : '1px',
        borderStyle: 'solid',
      }}
    >
      {!notif.isRead && (
        <div className="absolute top-6 right-6 w-3 h-3 rounded-full animate-pulse" style={{ backgroundColor: COLORS.GOLD }} />
      )}

      <div className="flex items-start gap-4">
        <div
          className="p-3 rounded-full flex items-center justify-center transition-colors"
          style={{ backgroundColor: isHovered ? COLORS.LIGHT_GOLD : COLORS.LIGHT_GREY, color: COLORS.NAVY }}
        >
          <Bell size={24} />
        </div>

        <div className="flex-1">
          <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: COLORS.TEXT_MUTED }}>{notif.date}</p>
          <h3 className="text-xl font-bold transition-colors duration-200" style={{ color: isHovered ? COLORS.NAVY : COLORS.TEXT_MAIN }}>{notif.title}</h3>
          
          <p className="mt-1 text-sm leading-relaxed" style={{ color: COLORS.TEXT_MUTED }}>
            New data detected for <span className="font-semibold" style={{ color: COLORS.LIGHTNAVY }}>{notif.market}</span> showing rising interest in <span className="font-semibold" style={{ color: COLORS.LIGHTNAVY }}>{notif.trend}</span>.
          </p>

          <div
            className="mt-4 flex items-center text-sm font-bold transition-all duration-200"
            style={{
              color: isHovered ? COLORS.DARK_GOLD : COLORS.NAVY,
              transform: isHovered ? 'translateX(4px)' : 'translateX(0)',
            }}
          >
            View Market Forecast <ChevronRight size={16} className="ml-1" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrendAlertCard;