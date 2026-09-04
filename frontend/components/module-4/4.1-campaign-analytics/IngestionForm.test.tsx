import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import IngestionForm from './IngestionForm';
import { apiClient } from '../../../services/apiClient';
import { ApiError } from '../../../services/apiError';

describe('IngestionForm', () => {
  it('submits entered values to the backend as numbers', async () => {
    const ingest = vi.spyOn(apiClient.campaign, 'ingest').mockResolvedValue({ ok: true } as never);
    const onSubmit = vi.fn();
    render(<IngestionForm onSubmit={onSubmit} />);

    const impressions = screen.getByLabelText(/impressions/i);
    await userEvent.clear(impressions);
    await userEvent.type(impressions, '120000');
    await userEvent.click(screen.getByRole('button', { name: /generate campaign analytics/i }));

    await waitFor(() =>
      expect(ingest).toHaveBeenCalledWith(expect.objectContaining({ impressions: 120000 })),
    );
    // Via `unknown`: the runtime payload is CampaignInput plus the period
    // fields, which the static type doesn't model — an index signature is what
    // the assertions below need.
    const payload = ingest.mock.calls[0][0] as unknown as Record<string, unknown>;

    // Every CAMPAIGN field must be a number, not a string — the form holds its
    // values as strings, so a missing coercion here would silently post
    // "120000" where the backend expects 120000.
    const NUMERIC_FIELDS = [
      'impressions', 'clicks', 'adSpend', 'revenue',
      'conversions', 'bookings', 'newCustomers',
    ];
    NUMERIC_FIELDS.forEach((k) => expect(typeof payload[k]).toBe('number'));

    // periodStart/periodEnd are deliberately ISO date STRINGS. Omitting them
    // persisted NULL dates, which left the history trend charts with nothing
    // to plot against — so assert they are sent and well-formed.
    expect(payload.periodStart).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(payload.periodEnd).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(String(payload.periodStart) < String(payload.periodEnd)).toBe(true);

    // Task 17: onSubmit now also receives the ingest response's `pes` as a
    // second argument — undefined here since the mocked response has none.
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ impressions: 120000 }), undefined),
    );
  });

  it('forwards the ingest response\'s pes to onSubmit as the second argument', async () => {
    const serverPes = { overallScore: 0.5773, label: 'Fair Performance', breakdown: [] };
    vi.spyOn(apiClient.campaign, 'ingest').mockResolvedValue({ pes: serverPes } as never);
    const onSubmit = vi.fn();
    render(<IngestionForm onSubmit={onSubmit} />);

    await userEvent.click(screen.getByRole('button', { name: /generate campaign analytics/i }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(expect.any(Object), serverPes),
    );
  });

  it('calls onSubmit with undefined pes when the ingest response has none', async () => {
    vi.spyOn(apiClient.campaign, 'ingest').mockResolvedValue({} as never);
    const onSubmit = vi.fn();
    render(<IngestionForm onSubmit={onSubmit} />);

    await userEvent.click(screen.getByRole('button', { name: /generate campaign analytics/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.any(Object), undefined));
  });

  it('surfaces a submit failure instead of failing silently', async () => {
    vi.spyOn(apiClient.campaign, 'ingest').mockRejectedValue(
      new ApiError({
        status: 409,
        method: 'POST',
        path: '/api/analytics/manual',
        body: { code: 'MOD22_PROFILE_NOT_READY', message: 'no business profile yet' },
      }),
    );
    render(<IngestionForm onSubmit={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: /generate campaign analytics/i }));

    expect(await screen.findByText(/complete onboarding/i)).toBeInTheDocument();
  });

  it('disables the submit button and shows a pending label while submitting', async () => {
    let resolveIngest: (value: unknown) => void = () => {};
    vi.spyOn(apiClient.campaign, 'ingest').mockReturnValue(
      new Promise((resolve) => {
        resolveIngest = resolve;
      }) as never,
    );
    render(<IngestionForm onSubmit={vi.fn()} />);

    const button = screen.getByRole('button', { name: /generate campaign analytics/i });
    await userEvent.click(button);

    const pendingButton = screen.getByRole('button', { name: /computing analytics/i });
    expect(pendingButton).toBeDisabled();

    resolveIngest({ ok: true });
    await waitFor(() => expect(screen.getByRole('button', { name: /generate campaign analytics/i })).not.toBeDisabled());
  });
});
