/**
 * Live week-to-date ad metrics panel — a read-only preview of the
 * still-open week, separate from the weekly sync that fills the submitted
 * form fields (covered by IngestionForm.adSync.test.tsx).
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import IngestionForm from './IngestionForm';
import type { AdConnection, AdInsightSummary } from '../../../types';

const insightsMock = vi.fn();
const ingestMock = vi.fn();
const campaignsMock = vi.fn();
const selectCampaignMock = vi.fn();
let connections: AdConnection[] = [];

vi.mock('../../../services/apiClient', () => ({
  apiClient: {
    adConnections: {
      insights: (...a: unknown[]) => insightsMock(...a),
      campaigns: (...a: unknown[]) => campaignsMock(...a),
      selectCampaign: (...a: unknown[]) => selectCampaignMock(...a),
    },
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
    selectCampaign: async () => {},
  }),
}));

const ACTIVE_META: AdConnection = {
  provider: 'meta',
  configured: true,
  status: 'ACTIVE',
  accountName: 'Cebu Dive Co. Ads',
  currency: 'PHP',
  campaignId: null,
  campaignName: null,
  connectedAt: '2026-08-20T00:00:00Z',
  lastSyncedAt: null,
};

const LIVE_SUMMARY: AdInsightSummary = {
  periodStart: '2026-09-07',
  periodEnd: '2026-09-12',
  impressions: 9120,
  clicks: 214,
  spend: 980.4,
  conversions: 6,
  currency: 'PHP',
  sources: [
    {
      provider: 'meta',
      accountName: 'Cebu Dive Co. Ads',
      impressions: 9120,
      clicks: 214,
      spend: 980.4,
      conversions: 6,
      currency: 'PHP',
    },
  ],
  warnings: [],
};

beforeEach(() => {
  insightsMock.mockReset();
  ingestMock.mockReset();
  campaignsMock.mockReset();
  selectCampaignMock.mockReset();
  ingestMock.mockResolvedValue({});
  insightsMock.mockResolvedValue(LIVE_SUMMARY);
  selectCampaignMock.mockResolvedValue({});
  campaignsMock.mockResolvedValue([]);
  connections = [];
});

describe('IngestionForm live week-to-date panel', () => {
  it('hides the live panel when no ad account is connected', () => {
    render(<IngestionForm onSubmit={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /refresh live totals/i })).toBeNull();
  });

  it('shows the live panel when a connection is active', () => {
    connections = [ACTIVE_META];
    render(<IngestionForm onSubmit={vi.fn()} />);
    expect(screen.getByRole('button', { name: /refresh live totals/i })).toBeInTheDocument();
  });

  it('requests a week-to-date range ending today, not the last complete week', async () => {
    connections = [ACTIVE_META];
    render(<IngestionForm onSubmit={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /refresh live totals/i }));

    await waitFor(() => expect(insightsMock).toHaveBeenCalled());
    const [start, end] = insightsMock.mock.calls[0];
    const todayIso = new Date().toISOString().slice(0, 10);
    expect(String(end)).toBe(todayIso);
    expect(String(start) <= String(end)).toBe(true);
  });

  it('renders live stat tiles from the response', async () => {
    connections = [ACTIVE_META];
    render(<IngestionForm onSubmit={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /refresh live totals/i }));

    await waitFor(() => expect(screen.getByText('9120')).toBeInTheDocument());
    expect(screen.getByText('214')).toBeInTheDocument();
    expect(screen.getByText('980.4')).toBeInTheDocument();
    expect(screen.getByText('6')).toBeInTheDocument();
  });

  it('does not mutate the editable fields', async () => {
    connections = [ACTIVE_META];
    render(<IngestionForm onSubmit={vi.fn()} />);
    const impressionsBefore = (screen.getByLabelText(/impressions/i) as HTMLInputElement).value;

    fireEvent.click(screen.getByRole('button', { name: /refresh live totals/i }));
    await waitFor(() => expect(screen.getByText('9120')).toBeInTheDocument());

    expect((screen.getByLabelText(/impressions/i) as HTMLInputElement).value).toBe(
      impressionsBefore,
    );
    expect(screen.queryByText(/^synced$/i)).toBeNull();
  });

  it('shows a warning and withholds tiles on a currency mismatch', async () => {
    connections = [ACTIVE_META];
    insightsMock.mockResolvedValue({
      ...LIVE_SUMMARY,
      impressions: null,
      clicks: null,
      spend: null,
      conversions: null,
      currency: null,
      warnings: ['Connected ad accounts report in different currencies (PHP, USD).'],
    });

    render(<IngestionForm onSubmit={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /refresh live totals/i }));

    expect(await screen.findByText(/different currencies/i)).toBeInTheDocument();
    expect(screen.queryByText('9120')).toBeNull();
  });

  it('reports a live sync failure without crashing', async () => {
    connections = [ACTIVE_META];
    insightsMock.mockRejectedValue(new Error('502'));
    render(<IngestionForm onSubmit={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /refresh live totals/i }));

    expect(await screen.findByText(/could not fetch live totals/i)).toBeInTheDocument();
  });

  it('keeps the weekly sync button enabled while a live refresh is pending', async () => {
    connections = [ACTIVE_META];
    let resolveLive: (v: AdInsightSummary) => void = () => {};
    insightsMock.mockImplementation(
      () => new Promise((resolve) => { resolveLive = resolve; }),
    );

    render(<IngestionForm onSubmit={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /refresh live totals/i }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /refreshing/i })).toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: /sync from ad accounts/i })).not.toBeDisabled();

    resolveLive(LIVE_SUMMARY);
    await waitFor(() => expect(screen.getByText('9120')).toBeInTheDocument());
  });
});
