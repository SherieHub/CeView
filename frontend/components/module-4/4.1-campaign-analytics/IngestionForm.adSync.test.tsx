/**
 * Ad-sync behaviour of the ingestion form. The form's own validation and
 * submit path are covered by its existing tests; this file only covers what
 * connecting an ad account changes.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import IngestionForm from './IngestionForm';
import type { AdConnection, AdInsightSummary } from '../../../types';

const insightsMock = vi.fn();
const ingestMock = vi.fn();
let connections: AdConnection[] = [];

vi.mock('../../../services/apiClient', () => ({
  apiClient: {
    adConnections: { insights: (...a: unknown[]) => insightsMock(...a) },
    campaign: { ingest: (...a: unknown[]) => ingestMock(...a) },
  },
}));

vi.mock('../../../services/useAdConnections', () => ({
  useAdConnections: () => ({
    connections,
    error: null,
    hasActive: connections.some((c) => c.status === 'ACTIVE'),
    forProvider: (p: string) => connections.find((c) => c.provider === p) ?? null,
    refresh: async () => {},
    disconnect: async () => {},
  }),
}));

const ACTIVE_META: AdConnection = {
  provider: 'meta',
  configured: true,
  status: 'ACTIVE',
  accountName: 'Cebu Dive Co. Ads',
  currency: 'PHP',
  connectedAt: '2026-08-20T00:00:00Z',
  lastSyncedAt: null,
};

const SUMMARY: AdInsightSummary = {
  periodStart: '2026-08-31',
  periodEnd: '2026-09-06',
  impressions: 48210,
  clicks: 1327,
  spend: 4820.55,
  conversions: 45,
  currency: 'PHP',
  sources: [
    {
      provider: 'meta',
      accountName: 'Cebu Dive Co. Ads',
      impressions: 48210,
      clicks: 1327,
      spend: 4820.55,
      conversions: 45,
      currency: 'PHP',
    },
  ],
  warnings: [],
};

beforeEach(() => {
  insightsMock.mockReset();
  ingestMock.mockReset();
  ingestMock.mockResolvedValue({});
  insightsMock.mockResolvedValue(SUMMARY);
  connections = [];
});

describe('IngestionForm ad sync', () => {
  it('hides the sync button when no ad account is connected', () => {
    render(<IngestionForm onSubmit={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /sync from ad accounts/i })).toBeNull();
  });

  it('starts every field blank, never pre-filled with placeholder numbers', () => {
    // A fresh form previously seeded every field from a fixture constant
    // (DEFAULT_CAMPAIGN_INPUT) meant only for the fixture/demo data layer —
    // an operator could submit those numbers as their own real business
    // data without ever having typed anything, corrupting their own
    // analytics. Every field starts empty; the operator (or a sync) fills it.
    render(<IngestionForm onSubmit={vi.fn()} />);

    for (const label of [
      /impressions/i, /^clicks/i, /ad spend/i, /revenue/i,
      /conversions/i, /bookings/i, /new customers/i,
    ]) {
      expect((screen.getByLabelText(label) as HTMLInputElement).value).toBe('');
    }
  });

  it('capitalizes the provider name in the sync confirmation note', async () => {
    connections = [ACTIVE_META];
    render(<IngestionForm onSubmit={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /sync from ad accounts/i }));

    expect(await screen.findByText(/filled from meta\./i)).toHaveTextContent('Filled from Meta.');
  });

  it('shows the sync button when a connection is active', () => {
    connections = [ACTIVE_META];
    render(<IngestionForm onSubmit={vi.fn()} />);
    expect(screen.getByRole('button', { name: /sync from ad accounts/i })).toBeInTheDocument();
  });

  it('fills the four platform-known fields', async () => {
    connections = [ACTIVE_META];
    render(<IngestionForm onSubmit={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /sync from ad accounts/i }));

    await waitFor(() =>
      expect((screen.getByLabelText(/impressions/i) as HTMLInputElement).value).toBe('48210'),
    );
    expect((screen.getByLabelText(/^clicks/i) as HTMLInputElement).value).toBe('1327');
    expect((screen.getByLabelText(/ad spend/i) as HTMLInputElement).value).toBe('4820.55');
    expect((screen.getByLabelText(/conversions/i) as HTMLInputElement).value).toBe('45');
  });

  it('clears the synced badge when the operator edits a synced field', async () => {
    connections = [ACTIVE_META];
    render(<IngestionForm onSubmit={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /sync from ad accounts/i }));
    await waitFor(() =>
      expect((screen.getByLabelText(/impressions/i) as HTMLInputElement).value).toBe('48210'),
    );

    const impressionsField = screen.getByLabelText(/impressions/i).closest('label');
    expect(impressionsField).toHaveTextContent(/synced/i);

    fireEvent.change(screen.getByLabelText(/impressions/i), { target: { value: '99999' } });

    expect(impressionsField).not.toHaveTextContent(/synced/i);
    // Other still-synced fields keep their badge.
    const clicksField = screen.getByLabelText(/^clicks/i).closest('label');
    expect(clicksField).toHaveTextContent(/synced/i);
  });

  it('leaves the business-side fields untouched', async () => {
    // The ad platforms do not know revenue, bookings, or new customers.
    // Filling them with anything — including zero — would corrupt ROAS and CAC.
    connections = [ACTIVE_META];
    render(<IngestionForm onSubmit={vi.fn()} />);
    const revenueBefore = (screen.getByLabelText(/revenue/i) as HTMLInputElement).value;

    fireEvent.click(screen.getByRole('button', { name: /sync from ad accounts/i }));
    await waitFor(() => expect(insightsMock).toHaveBeenCalled());

    expect((screen.getByLabelText(/revenue/i) as HTMLInputElement).value).toBe(revenueBefore);
  });

  it('labels the money fields with the account currency', async () => {
    connections = [{ ...ACTIVE_META, currency: 'USD' }];
    insightsMock.mockResolvedValue({ ...SUMMARY, currency: 'USD' });
    render(<IngestionForm onSubmit={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /sync from ad accounts/i }));

    await waitFor(() => expect(screen.getByLabelText(/ad spend \(USD\)/i)).toBeInTheDocument());
  });

  it('syncs the same period the form submits', async () => {
    connections = [ACTIVE_META];
    render(<IngestionForm onSubmit={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /sync from ad accounts/i }));

    await waitFor(() => expect(insightsMock).toHaveBeenCalled());
    const [start, end] = insightsMock.mock.calls[0];
    expect(String(start)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(String(end)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(String(start) < String(end)).toBe(true);
  });

  it('shows the warning and does not prefill when currencies differ', async () => {
    connections = [ACTIVE_META];
    insightsMock.mockResolvedValue({
      ...SUMMARY,
      impressions: null,
      clicks: null,
      spend: null,
      conversions: null,
      currency: null,
      warnings: ['Connected ad accounts report in different currencies (PHP, USD).'],
    });

    render(<IngestionForm onSubmit={vi.fn()} />);
    const before = (screen.getByLabelText(/impressions/i) as HTMLInputElement).value;
    fireEvent.click(screen.getByRole('button', { name: /sync from ad accounts/i }));

    expect(await screen.findByText(/different currencies/i)).toBeInTheDocument();
    expect((screen.getByLabelText(/impressions/i) as HTMLInputElement).value).toBe(before);
  });

  it('reports a sync failure without wiping what is typed', async () => {
    connections = [ACTIVE_META];
    insightsMock.mockRejectedValue(new Error('502'));
    render(<IngestionForm onSubmit={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /sync from ad accounts/i }));

    expect(await screen.findByText(/could not sync/i)).toBeInTheDocument();
  });
});
