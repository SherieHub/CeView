import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import CustomerJourneyFunnel from './CustomerJourneyFunnel';
import type { CampaignInput } from '../../../services/fixtures/campaign';

function makeInput(overrides: Partial<CampaignInput> = {}): CampaignInput {
  return {
    impressions: 1000,
    clicks: 500,
    adSpend: 0,
    revenue: 0,
    conversions: 100,
    bookings: 25,
    newCustomers: 0,
    ...overrides,
  };
}

describe('CustomerJourneyFunnel', () => {
  it('renders all 4 stages with their raw values', () => {
    render(<CustomerJourneyFunnel input={makeInput()} />);

    expect(screen.getByText('Impressions')).toBeInTheDocument();
    expect(screen.getByText('Clicks')).toBeInTheDocument();
    expect(screen.getByText('Conversions')).toBeInTheDocument();
    expect(screen.getByText('Bookings')).toBeInTheDocument();

    expect(screen.getByText('1,000')).toBeInTheDocument();
    expect(screen.getByText('500')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('25')).toBeInTheDocument();
  });

  it('computes and renders correct drop-off percentages when all stages are positive', () => {
    render(<CustomerJourneyFunnel input={makeInput()} />);

    // Impressions -> Clicks: (1000 - 500) / 1000 * 100 = 50.0%
    expect(screen.getByTestId('funnel-dropoff-clicks')).toHaveTextContent('-50.0% drop-off');
    // Clicks -> Conversions: (500 - 100) / 500 * 100 = 80.0%
    expect(screen.getByTestId('funnel-dropoff-conversions')).toHaveTextContent('-80.0% drop-off');
    // Conversions -> Bookings: (100 - 25) / 100 * 100 = 75.0%
    expect(screen.getByTestId('funnel-dropoff-bookings')).toHaveTextContent('-75.0% drop-off');

    // The first stage (Impressions) has no preceding stage, so it never gets a drop-off badge.
    expect(screen.queryByTestId('funnel-dropoff-impressions')).not.toBeInTheDocument();
  });

  it('renders no drop-off badge for a transition whose previous stage is zero', () => {
    render(<CustomerJourneyFunnel input={makeInput({ impressions: 0 })} />);

    // prevStage.value (impressions) is 0, so dropOff is null for Clicks -- not "0%", not "NaN%".
    expect(screen.queryByTestId('funnel-dropoff-clicks')).not.toBeInTheDocument();
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
    expect(screen.queryByText('-0.0% drop-off')).not.toBeInTheDocument();

    // Downstream transitions (Clicks -> Conversions, Conversions -> Bookings) are unaffected
    // since their own previous stages are still positive.
    expect(screen.getByTestId('funnel-dropoff-conversions')).toHaveTextContent('-80.0% drop-off');
    expect(screen.getByTestId('funnel-dropoff-bookings')).toHaveTextContent('-75.0% drop-off');
  });

  it('renders no drop-off badge for every transition when all prior stages are zero', () => {
    render(
      <CustomerJourneyFunnel
        input={makeInput({ impressions: 0, clicks: 0, conversions: 0, bookings: 0 })}
      />
    );

    expect(screen.queryByTestId('funnel-dropoff-clicks')).not.toBeInTheDocument();
    expect(screen.queryByTestId('funnel-dropoff-conversions')).not.toBeInTheDocument();
    expect(screen.queryByTestId('funnel-dropoff-bookings')).not.toBeInTheDocument();
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
  });
});
