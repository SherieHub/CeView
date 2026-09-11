import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import AlertCard from './AlertCard';
import RankCard from './RankCard';
import SignalSummary from './SignalSummary';
import DrawerChartPanel from '../2.2-market-radar/DrawerChartPanel';
import { MOCK_MARKETS } from '../../../services/fixtures/markets';
import { isSurge, marketSurgeState } from '@/types';

const critical = MOCK_MARKETS.find((market) => market.id === 'korea')!;

describe('Module 2 surge vocabulary', () => {
  it('uses persisted levels, rather than spike points, across all four surfaces', () => {
    expect(isSurge({ alertLevel: 'WARNING' })).toBe(true);
    expect(isSurge({ alertLevel: 'CRITICAL' })).toBe(true);
    expect(isSurge({ alertLevel: 'INFO' })).toBe(false);
    expect(marketSurgeState(critical)).toBe('critical');
    expect(marketSurgeState({ ...critical, surgeLevel: null })).toBe('none');

    const { rerender } = render(
      <AlertCard
        alert={{
          id: 'a1', date: '2026-09-01', title: 'South Korea', market: 'South Korea', marketId: 'korea',
          category: 'Diving', trend: 'Sudden interest spike', isRead: false, alertLevel: 'CRITICAL',
          alertMessage: null, windowOpenDate: '2026-09-07T00:00:00Z', upliftPct: 28.4,
        }}
        isRead={false}
        isSelected={false}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText('Surge')).toBeInTheDocument();

    rerender(<RankCard market={critical} onOpen={vi.fn()} />);
    expect(screen.getByText('Surge active')).toBeInTheDocument();

    rerender(
      <SignalSummary
        loading={false} degraded={false} unreadCount={0} surgeCount={1}
        surgeMarkets={['South Korea']} topMarket={{ ...critical, category: 'Diving' }} onOpenMarket={vi.fn()}
      />,
    );
    expect(screen.getByText('Active surges')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();

    rerender(<DrawerChartPanel market={critical} timeframe="4WK" onTimeframeChange={vi.fn()} />);
    expect(screen.getByText('Surge confirmed')).toBeInTheDocument();
  });
});
