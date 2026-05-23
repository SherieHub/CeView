import React, { useState } from 'react';
import { Bell, ChevronRight } from 'lucide-react';
import { MOCK_NOTIFICATIONS, COLORS } from '../constants';
import { Notification } from '../types';
import MarketPrediction from './MarketPrediction';

// Define the props interface to accept the navigation callback from App.tsx
interface HomeNotificationProps {
  onNavigateToContent?: () => void;
}

const Home_Notification: React.FC<HomeNotificationProps> = ({ onNavigateToContent }) => {
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  // Safely map notification market to market IDs
  const getMarketId = (market: string): string => {
    const normalized = market.toLowerCase();

    if (normalized.includes('korea')) return 'korea';
    if (normalized.includes('japan')) return 'japan';
    if (normalized.includes('australia')) return 'australia';

    return 'korea';
  };

  // Redirect to MarketPrediction page
  if (selectedNotification) {
    return (
      <div className="animate-fade-in">
        <MarketPrediction
          initialMarketId={getMarketId(selectedNotification.market)}
          onBack={() => setSelectedNotification(null)}
          // Pass the navigation function down into the prediction dashboard view
          onNavigateToContent={onNavigateToContent}
        />
      </div>
    );
  }

  return (
    <div
      className="max-w-4xl mx-auto p-4 md:p-6 animate-fade-in space-y-8 min-h-screen"
      style={{ backgroundColor: COLORS.CREAM }}
    >
      <div>
        <h2
          className="text-3xl font-bold"
          style={{ color: COLORS.NAVY }}
        >
          Home
        </h2>

        <p
          className="mt-1"
          style={{ color: COLORS.TEXT_MUTED }}
        >
          Weekly trend updates and market signals.
        </p>
      </div>

      <div className="space-y-4">
        {MOCK_NOTIFICATIONS.map((notif) => {
          const isHovered = hoveredCard === notif.id;

          return (
            <div
              key={notif.id}
              onClick={() => setSelectedNotification(notif)}
              onMouseEnter={() => setHoveredCard(notif.id)}
              onMouseLeave={() => setHoveredCard(null)}
              className="p-6 rounded-xl shadow-sm border transition-all duration-200 cursor-pointer relative overflow-hidden"
              style={{
                backgroundColor: COLORS.WHITE,
                borderColor: isHovered
                  ? COLORS.GOLD
                  : COLORS.LIGHT_GREY,
                boxShadow: isHovered
                  ? '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)'
                  : '',
                borderWidth: isHovered ? '2px' : '1px',
                borderStyle: 'solid',
              }}
            >
              {!notif.isRead && (
                <div
                  className="absolute top-6 right-6 w-3 h-3 rounded-full animate-pulse"
                  style={{ backgroundColor: COLORS.GOLD }}
                />
              )}

              <div className="flex items-start gap-4">
                <div
                  className="p-3 rounded-full flex items-center justify-center transition-colors"
                  style={{
                    backgroundColor: isHovered
                      ? COLORS.LIGHT_GOLD
                      : COLORS.LIGHT_GREY,
                    color: COLORS.NAVY,
                  }}
                >
                  <Bell size={24} />
                </div>

                <div className="flex-1">
                  <p
                    className="text-xs font-bold uppercase tracking-wide mb-1"
                    style={{ color: COLORS.TEXT_MUTED }}
                  >
                    {notif.date}
                  </p>

                  <h3
                    className="text-xl font-bold transition-colors duration-200"
                    style={{
                      color: isHovered
                        ? COLORS.NAVY
                        : COLORS.TEXT_MAIN,
                    }}
                  >
                    {notif.title}
                  </h3>

                  <p
                    className="mt-1 text-sm leading-relaxed"
                    style={{ color: COLORS.TEXT_MUTED }}
                  >
                    New data detected for{' '}
                    <span
                      className="font-semibold"
                      style={{ color: COLORS.LIGHTNAVY }}
                    >
                      {notif.market}
                    </span>{' '}
                    showing rising interest in{' '}
                    <span
                      className="font-semibold"
                      style={{ color: COLORS.LIGHTNAVY }}
                    >
                      {notif.trend}
                    </span>.
                  </p>

                  <div
                    className="mt-4 flex items-center text-sm font-bold transition-all duration-200"
                    style={{
                      color: isHovered
                        ? COLORS.DARK_GOLD
                        : COLORS.NAVY,
                      transform: isHovered
                        ? 'translateX(4px)'
                        : 'translateX(0)',
                    }}
                  >
                    View Market Forecast
                    <ChevronRight size={16} className="ml-1" />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Home_Notification;