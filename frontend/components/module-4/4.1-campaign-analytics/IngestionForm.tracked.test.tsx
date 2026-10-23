import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import IngestionForm from './IngestionForm';
import { apiClient } from '../../../services/apiClient';
import { lastCompleteWeek } from './dateRange';

/** CVW-42 — the Bookings field says what CeView already tracked for the period. */
describe('IngestionForm tracked-bookings hint', () => {
  afterEach(() => vi.restoreAllMocks());

  const summary = (trackedBookings: number, automaticBookings = 0) => ({
    periodStart: '2026-10-12',
    periodEnd: '2026-10-18',
    trackedBookings,
    automaticBookings,
    clickMatchedBookings: 0,
    codeLoggedBookings: trackedBookings - automaticBookings,
    trackedRevenue: 0,
  });

  it('asks for the reporting period and shows what was tracked', async () => {
    const tracked = vi.spyOn(apiClient.attribution, 'tracked').mockResolvedValue(summary(3, 1));
    render(<IngestionForm onSubmit={vi.fn()} />);

    const { periodStart, periodEnd } = lastCompleteWeek();
    await waitFor(() => expect(tracked).toHaveBeenCalledWith(periodStart, periodEnd));
    expect(await screen.findByText(/CeView tracked 3 bookings this period \(1 automatic\)/)).toBeInTheDocument();
  });

  it('warns, without blocking, when the entered total is below what was tracked', async () => {
    vi.spyOn(apiClient.attribution, 'tracked').mockResolvedValue(summary(3));
    render(<IngestionForm onSubmit={vi.fn()} />);
    await screen.findByText(/CeView tracked 3 bookings/);

    await userEvent.type(screen.getByLabelText(/bookings/i), '2');
    expect(screen.getByText(/fewer than the 3 bookings CeView tracked/)).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText(/bookings/i), '0');
    expect(screen.queryByText(/fewer than the 3 bookings/)).not.toBeInTheDocument();
  });

  it('shows nothing when nothing was tracked or the lookup fails', async () => {
    const tracked = vi.spyOn(apiClient.attribution, 'tracked').mockRejectedValue(new Error('offline'));
    render(<IngestionForm onSubmit={vi.fn()} />);
    await waitFor(() => expect(tracked).toHaveBeenCalled());
    expect(screen.queryByText(/CeView tracked/)).not.toBeInTheDocument();
  });
});
