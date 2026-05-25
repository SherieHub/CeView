import React, { useEffect, useState } from 'react';
import TrendAlertCard from '../../composites/module-2/TrendAlertCard';
import MarketRadarView from './MarketRadarView';
import { MOCK_NOTIFICATIONS, COLORS } from '../../../constants';
import { Notification } from '../../../types';
import { api } from '../../../services/apiClient';

interface HomeViewProps {
  businessProfileId?: string | null;
  businessName?: string;
  categories?: string[];
  onNavigateToContent?: () => void;
}

const HomeView: React.FC<HomeViewProps> = ({ businessProfileId, businessName, categories, onNavigateToContent }) => {
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>(MOCK_NOTIFICATIONS);
  const [isUsingMock, setIsUsingMock] = useState<boolean>(true);

  useEffect(() => {
    api.listNotifications()
      .then(r => {
        if (r.notifications?.length) {
          setNotifications(r.notifications);
          setIsUsingMock(false);
        }
      })
      .catch(e => {
        console.warn('listNotifications failed, using mock', e);
        setIsUsingMock(true);
      });
  }, []);

  if (selectedNotification) {
    return (
      <div className="animate-fade-in">
        <MarketRadarView
          businessProfileId={businessProfileId}
          businessName={businessName}
          categories={categories}
          initialMarketId={selectedNotification.marketId}
          onBack={() => setSelectedNotification(null)}
          onNavigateToContent={onNavigateToContent}
        />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 animate-fade-in space-y-8 min-h-screen" style={{ backgroundColor: COLORS.CREAM }}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold" style={{ color: COLORS.NAVY }}>Home</h2>
          <p className="mt-1" style={{ color: COLORS.TEXT_MUTED }}>Weekly trend updates and market signals.</p>
        </div>
        {isUsingMock && (
          <span
            className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full border"
            style={{ backgroundColor: COLORS.GOLD_LIGHT, color: COLORS.NAVY, borderColor: `${COLORS.GOLD}40` }}
            title="Backend unreachable — showing seeded demo data"
          >
            Demo Data
          </span>
        )}
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
