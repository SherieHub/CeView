import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import QuickLogBooking from './QuickLogBooking';
import { apiClient } from '../../../services/apiClient';
import { mockCodes, mockRedemptions } from '../../../services/fixtures/attributionCodes';

vi.mock('../../../services/apiClient', () => ({
  apiClient: {
    attribution: { codes: vi.fn(), logBooking: vi.fn() },
    attributionLinks: { list: vi.fn(), unconvertedClicks: vi.fn() },
  },
}));

const api = apiClient as unknown as {
  attribution: Record<'codes' | 'logBooking', ReturnType<typeof vi.fn>>;
  attributionLinks: Record<'list' | 'unconvertedClicks', ReturnType<typeof vi.fn>>;
};

const renderCard = () => render(<MemoryRouter><QuickLogBooking /></MemoryRouter>);

describe('QuickLogBooking (dashboard)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    api.attribution.codes.mockResolvedValue(mockCodes());
    api.attribution.logBooking.mockResolvedValue({ ...mockRedemptions()[0], bookings: 1 });
    api.attributionLinks.list.mockResolvedValue([]);
  });

  it('names the live codes and logs a booking without leaving the dashboard', async () => {
    renderCard();
    expect(await screen.findByText('KR-ACCO-1019')).toBeInTheDocument();
    expect(screen.getByText('JP-DIVE-1102')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Log a booking' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save booking' }));

    await waitFor(() => expect(api.attribution.logBooking).toHaveBeenCalled());
    expect(await screen.findByRole('status')).toHaveTextContent('Logged 1 booking for KR-ACCO-1019.');
    expect(screen.getByRole('link', { name: 'See campaign evidence' })).toHaveAttribute('href', '/performance');
  });

  it('stays out of the way when there is nothing to log against', async () => {
    api.attribution.codes.mockResolvedValue(mockCodes().map((c) => ({ ...c, status: 'ENDED' })));
    const { container } = renderCard();
    await waitFor(() => expect(api.attribution.codes).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();

    api.attribution.codes.mockRejectedValue(new Error('offline'));
    const failed = renderCard();
    await waitFor(() => expect(api.attribution.codes).toHaveBeenCalledTimes(2));
    expect(failed.container).toBeEmptyDOMElement();
  });
});
