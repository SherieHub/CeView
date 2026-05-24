import React, { useEffect, useState } from 'react';
import TrendAlertCard from '../../composites/module-2/TrendAlertCard';
import MarketRadarView from './MarketRadarView';
import { MOCK_NOTIFICATIONS, COLORS } from '../../../constants';
import { Notification } from '../../../types';
import { api } from '../../../services/apiClient';

interface HomeViewProps {
  onNavigateToContent?: () => void;
}

const HomeView: React.FC<HomeViewProps> = ({ onNavigateToContent }) => {
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>(MOCK_NOTIFICATIONS);

  useEffect(() => {
    api.listNotifications()
      .then(r => { if (r.notifications?.length) setNotifications(r.notifications); })
      .catch(e => console.warn('listNotifications failed, using mock', e));
  }, []);

  const getMarketId = (market: string): string => {
    const normalized = market.toLowerCase();
    if (normalized.includes('korea')) return 'korea';
    if (normalized.includes('japan')) return 'japan';
    if (normalized.includes('australia')) return 'australia';
    return 'korea';
  };

  if (selectedNotification) {
    return (
      <div className="animate-fade-in">
        <MarketRadarView
          initialMarketId={getMarketId(selectedNotification.market)}
          onBack={() => setSelectedNotification(null)}
          onNavigateToContent={onNavigateToContent}
        />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 animate-fade-in space-y-8 min-h-screen" style={{ backgroundColor: COLORS.CREAM }}>
      <div>
        <h2 className="text-3xl font-bold" style={{ color: COLORS.NAVY }}>Home</h2>
        <p className="mt-1" style={{ color: COLORS.TEXT_MUTED }}>Weekly trend updates and market signals.</p>
      </div>

      <div className="space-y-4">
        {notifications.map((notif) => (
          <TrendAlertCard 
            key={notif.id} 
            notif={notif} 
            onClick={() => setSelectedNotification(notif)} 
          />
        ))}
      </div>
    </div>
  );
};

export default HomeView;