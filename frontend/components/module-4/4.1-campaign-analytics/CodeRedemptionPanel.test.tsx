import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import CodeRedemptionPanel from './CodeRedemptionPanel';
import { apiClient } from '../../../services/apiClient';
import { ApiError } from '../../../services/apiError';
import { mockCodes, mockRedemptions } from '../../../services/fixtures/attributionCodes';
import { mockLinks, mockUnconvertedClicks } from '../../../services/fixtures/attributionLinks';

vi.mock('../../../services/apiClient', () => ({
  apiClient: {
    attribution: {
      codes: vi.fn(),
      recentRedemptions: vi.fn(),
      logBooking: vi.fn(),
      deleteRedemption: vi.fn(),
    },
    attributionLinks: {
      list: vi.fn(),
      unconvertedClicks: vi.fn(),
    },
  },
}));

const api = apiClient as unknown as {
  attribution: Record<'codes' | 'recentRedemptions' | 'logBooking' | 'deleteRedemption', ReturnType<typeof vi.fn>>;
  attributionLinks: Record<'list' | 'unconvertedClicks', ReturnType<typeof vi.fn>>;
};

describe('CodeRedemptionPanel', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    api.attribution.codes.mockResolvedValue(mockCodes());
    api.attribution.recentRedemptions.mockResolvedValue(mockRedemptions());
    api.attribution.logBooking.mockImplementation(async (input) => ({
      ...mockRedemptions()[0],
      bookings: input.bookings,
      code: 'KR-ACCO-1019',
    }));
    api.attribution.deleteRedemption.mockResolvedValue(undefined);
    api.attributionLinks.list.mockResolvedValue([]);
    api.attributionLinks.unconvertedClicks.mockResolvedValue([]);
  });

  it('explains codes when the operator has none yet', async () => {
    api.attribution.codes.mockResolvedValue([]);
    api.attribution.recentRedemptions.mockResolvedValue([]);
    render(<CodeRedemptionPanel />);
    expect(await screen.findByText(/No campaign codes yet/)).toBeInTheDocument();
  });

  it('shows each code with bookings split by how they were captured', async () => {
    render(<CodeRedemptionPanel />);
    const rows = await screen.findByRole('rowgroup', { name: 'Campaign codes' });
    expect(within(rows).getByText('KR-ACCO-1019')).toBeInTheDocument();
    const captured = within(rows).getByRole('list', { name: 'How KR-ACCO-1019 bookings were captured' });
    expect(within(captured).getByText('2 via enquiry form')).toBeInTheDocument();
    expect(within(captured).getByText('1 via ad click')).toBeInTheDocument();
    expect(within(captured).getByText('3 logged by staff')).toBeInTheDocument();
    expect(within(rows).getByText('Upcoming')).toBeInTheDocument();
    expect(within(rows).getByText(/Accommodation & Staycation • South Korea •/)).toBeInTheDocument();
    // Totals across both codes.
    expect(screen.getByText('Total').closest('tr')).toHaveTextContent('6');
  });

  it('flags a code with more bookings tracked than reported, without hiding it', async () => {
    render(<CodeRedemptionPanel />);
    expect(await screen.findByText(/More bookings tracked than the 4 you reported/)).toBeInTheDocument();
    // Only the flagged code carries the warning.
    expect(screen.getAllByText(/More bookings tracked/)).toHaveLength(1);
  });

  it('surfaces a load failure with a retry', async () => {
    api.attribution.codes
      .mockRejectedValueOnce(new ApiError({ status: 500, method: 'GET', path: '/api/attribution/codes', body: { message: 'boom' } }))
      .mockResolvedValueOnce([]);
    render(<CodeRedemptionPanel />);
    fireEvent.click(await screen.findByRole('button', { name: /retry/i }));
    expect(await screen.findByText(/No campaign codes yet/)).toBeInTheDocument();
  });

  it('keeps walk-in vouchers out of the Log a booking picker but still lists them as evidence', async () => {
    const [surge, other] = mockCodes();
    api.attribution.codes.mockResolvedValue([surge, { ...other, voucher: true }]);
    render(<CodeRedemptionPanel />);

    const rows = await screen.findByRole('rowgroup', { name: 'Campaign codes' });
    expect(within(rows).getByText('JP-DIVE-1102')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Log a booking' }));
    const picker = screen.getByLabelText('Code the customer quoted');
    expect(within(picker).getByRole('option', { name: /KR-ACCO-1019/ })).toBeInTheDocument();
    expect(within(picker).queryByRole('option', { name: /JP-DIVE-1102/ })).not.toBeInTheDocument();
  });

  it('logs a booking against the selected code and refreshes', async () => {
    render(<CodeRedemptionPanel />);
    fireEvent.click(await screen.findByRole('button', { name: 'Log a booking' }));

    fireEvent.change(screen.getByLabelText('Bookings'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Revenue (₱)'), { target: { value: '5000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save booking' }));

    await waitFor(() => expect(api.attribution.logBooking).toHaveBeenCalledTimes(1));
    const input = api.attribution.logBooking.mock.calls[0][0];
    expect(input).toMatchObject({
      attributionCodeId: mockCodes()[0].attributionCodeId,
      bookings: 2,
      revenue: 5000,
    });
    expect(input.clickId).toBeUndefined();
    expect(typeof input.eventAt).toBe('string');
    expect(await screen.findByRole('status')).toHaveTextContent('Logged 2 bookings for KR-ACCO-1019.');
    expect(api.attribution.codes).toHaveBeenCalledTimes(2);
  });

  it('rejects an invalid count without calling the API', async () => {
    render(<CodeRedemptionPanel />);
    fireEvent.click(await screen.findByRole('button', { name: 'Log a booking' }));
    fireEvent.change(screen.getByLabelText('Bookings'), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save booking' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/whole number from 1 to 500/);
    expect(api.attribution.logBooking).not.toHaveBeenCalled();
  });

  it('offers recorded ad clicks when the code has a tracked link, and sends the chosen click', async () => {
    const [link] = mockLinks();
    const code = mockCodes()[0];
    // Same surge window as the first code, so the two are siblings.
    api.attributionLinks.list.mockResolvedValue([
      { ...link, category: code.category, targetMarket: code.targetMarket, windowStart: code.windowStart },
    ]);
    api.attributionLinks.unconvertedClicks.mockResolvedValue(mockUnconvertedClicks());

    render(<CodeRedemptionPanel />);
    fireEvent.click(await screen.findByRole('button', { name: 'Log a booking' }));
    fireEvent.click(await screen.findByLabelText(/Sunset villa/));
    fireEvent.click(screen.getByRole('button', { name: 'Save booking' }));

    await waitFor(() => expect(api.attribution.logBooking).toHaveBeenCalled());
    expect(api.attribution.logBooking.mock.calls[0][0].clickId).toBe(mockUnconvertedClicks()[0].clickId);
  });

  it('lets the operator undo their own log but not a traveller enquiry', async () => {
    render(<CodeRedemptionPanel />);
    const recent = await screen.findByRole('rowgroup', { name: 'Recent bookings', hidden: true });
    const removeButtons = within(recent).getAllByRole('button', { name: /Remove booking/, hidden: true });
    expect(removeButtons).toHaveLength(1);

    fireEvent.click(removeButtons[0]);
    await waitFor(() =>
      expect(api.attribution.deleteRedemption).toHaveBeenCalledWith(mockRedemptions()[0].redemptionId),
    );
  });
});
