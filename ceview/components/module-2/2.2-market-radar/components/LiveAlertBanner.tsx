import React from 'react';
import { Zap, CheckCircle } from 'lucide-react';
import { Market } from '../../../../types';
import { COLORS } from '../../../../constants';

interface LiveAlertBannerProps {
  market: Market;
}

const LiveAlertBanner: React.FC<LiveAlertBannerProps> = ({ market }) => {
  const hasSpikeNow = market.chartData.some((d) => d.history !== null && d.spike === 1);
  const hasSpikeAhead = market.chartData.some((d) => d.forecast !== null && d.spike === 1);

  if (!hasSpikeNow && !hasSpikeAhead) return null;

  const bgColor = hasSpikeNow ? COLORS.RED_ORANGE : COLORS.GOLD;
  const lightBg = hasSpikeNow ? COLORS.BEIGE : COLORS.GOLD_LIGHT;
  const spikeWeek = market.chartData.find((d) => d.spike === 1)?.week || '';

  return (
    <div className="rounded-2xl overflow-hidden shadow-lg" style={{ border: `2px solid ${bgColor}` }}>
      <div className="flex items-center gap-3 px-4 md:px-6 py-4" style={{ backgroundColor: bgColor }}>
        <div className="p-2 rounded-full shrink-0" style={{ backgroundColor: 'rgba(255,255,255,0.25)' }}>
          <Zap size={20} color={COLORS.WHITE} style={{ fill: COLORS.WHITE }} />
        </div>
        <div>
          <p className="font-black text-sm uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.75)' }}>
            {hasSpikeNow ? 'Live Alert — Right Now' : `Upcoming Surge Detected — ${spikeWeek}`}
          </p>
          <p className="font-black text-base md:text-lg leading-tight" style={{ color: COLORS.WHITE }}>
            {hasSpikeNow ? `Demand Surge Active: ${market.name} tourists are searching Cebu heavily right now` : `Demand Surge Incoming: ${market.name} interest projected to spike in ${spikeWeek}`}
          </p>
        </div>
      </div>
      <div className="px-4 md:px-6 py-5" style={{ backgroundColor: lightBg }}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <p className="text-xs font-black uppercase tracking-wider mb-2" style={{ color: bgColor }}>What This Means for Your Business</p>
            <p className="text-sm leading-relaxed font-medium" style={{ color: COLORS.TEXT_MAIN }}>
              {hasSpikeNow ? `Tourist interest from ${market.name} has jumped well above the normal baseline. You have a 48–72 hour window where visitors are actively booking.` : `Our AI model forecasts an above-normal surge from ${market.name} around ${spikeWeek}. Prepare your inventory and promotions now.`}
            </p>
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-wider mb-2" style={{ color: bgColor }}>Your Action Checklist</p>
            <div className="space-y-2">
              {[
                hasSpikeNow ? 'Post targeted social content in Korean/Japanese NOW' : 'Schedule social content for this market 2 weeks ahead',
                'Raise premium room & package rates by 10–15%',
                'Alert your tour operators and guides to increase availability',
                hasSpikeNow ? 'Enable flash booking discounts to close hesitant buyers' : 'Prepare limited "early-bird" deals to lock in bookings early',
              ].map((action, i) => (
                <div key={i} className="flex items-start gap-2">
                  <CheckCircle size={15} className="shrink-0 mt-0.5" style={{ color: bgColor }} />
                  <span className="text-xs font-semibold leading-relaxed" style={{ color: COLORS.TEXT_MAIN }}>{action}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveAlertBanner;
