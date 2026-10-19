import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import StatisticalLiftPanel from './StatisticalLiftPanel';
import { apiClient } from '../../../services/apiClient';
import { mockCodes, mockLift } from '../../../services/fixtures/attributionCodes';

vi.mock('../../../services/apiClient', () => ({
  apiClient: { attribution: { codes: vi.fn(), lift: vi.fn() } },
}));

const api = apiClient as unknown as { attribution: Record<'codes' | 'lift', ReturnType<typeof vi.fn>> };

describe('StatisticalLiftPanel', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    api.attribution.codes.mockResolvedValue(mockCodes());
    api.attribution.lift.mockImplementation(async (id: string) => mockLift(id));
  });

  it('defaults to the live code and shows before/during per-week figures with the lift', async () => {
    render(<StatisticalLiftPanel />);

    await waitFor(() => expect(api.attribution.lift).toHaveBeenCalledWith(mockCodes()[0].attributionCodeId));
    expect(await screen.findByText('+40%')).toBeInTheDocument();
    expect(screen.getByText('+61.3%')).toBeInTheDocument();
    expect(screen.getByText('Bookings per week')).toBeInTheDocument();
    // The fixture's baseline is three weeks: flagged rather than hidden.
    expect(screen.getByText(/Fewer than four weeks of history/)).toBeInTheDocument();
  });

  it('explains, instead of inventing a percentage, when the window has not opened', async () => {
    render(<StatisticalLiftPanel />);
    await screen.findByText('+40%');

    fireEvent.change(screen.getByLabelText('Campaign code'), { target: { value: mockCodes()[1].attributionCodeId } });

    expect(await screen.findByText(/window hasn't opened yet/)).toBeInTheDocument();
    expect(screen.getAllByText('No change measurable')).toHaveLength(2);
  });

  it('says how lift works when there are no codes yet', async () => {
    api.attribution.codes.mockResolvedValue([]);
    render(<StatisticalLiftPanel />);
    expect(await screen.findByText(/measured per campaign code/)).toBeInTheDocument();
    expect(api.attribution.lift).not.toHaveBeenCalled();
  });
});
