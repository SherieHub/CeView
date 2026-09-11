/**
 * Four states matter here and each is a different message to the operator:
 * server has no credentials, operator hasn't connected, operator connected but
 * hasn't picked an account, and fully active.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdAccountsSection from './AdAccountsSection';
import { ToastProvider } from '../shared/Toast';
import { OverlayStackProvider } from '../shared/useOverlayStack';
import type { AdConnection } from '../../types';

const listMock = vi.fn();
const authorizeMock = vi.fn();
const disconnectMock = vi.fn();

vi.mock('../../services/apiClient', () => ({
  apiClient: {
    adConnections: {
      list: () => listMock(),
      authorize: (...args: unknown[]) => authorizeMock(...args),
      disconnect: (...args: unknown[]) => disconnectMock(...args),
    },
  },
}));

function connection(over: Partial<AdConnection>): AdConnection {
  return {
    provider: 'meta',
    configured: true,
    status: 'DISCONNECTED',
    accountName: null,
    currency: null,
    campaignId: null,
    campaignName: null,
    connectedAt: null,
    lastSyncedAt: null,
    ...over,
  };
}

function renderSection() {
  return render(
    <ToastProvider>
      <OverlayStackProvider>
        <AdAccountsSection onConnected={() => {}} />
      </OverlayStackProvider>
    </ToastProvider>,
  );
}

beforeEach(() => {
  listMock.mockReset();
  authorizeMock.mockReset();
  disconnectMock.mockReset();
  authorizeMock.mockResolvedValue({ authorizeUrl: 'https://facebook.test/dialog' });
  disconnectMock.mockResolvedValue({ ok: true });
});

describe('AdAccountsSection', () => {
  it('renders a row per provider', async () => {
    listMock.mockResolvedValue([
      connection({ provider: 'meta' }),
      connection({ provider: 'tiktok' }),
    ]);
    renderSection();
    expect(await screen.findByText('Meta Ads')).toBeInTheDocument();
    expect(screen.getByText('TikTok Ads')).toBeInTheDocument();
  });

  it('says so when the server has no credentials for a provider', async () => {
    listMock.mockResolvedValue([connection({ provider: 'meta', configured: false })]);
    renderSection();
    expect(await screen.findByText(/not configured on this server/i)).toBeInTheDocument();
  });

  it('disables Connect when the provider is unconfigured', async () => {
    listMock.mockResolvedValue([connection({ provider: 'meta', configured: false })]);
    renderSection();
    await screen.findByText('Meta Ads');
    expect(screen.getByRole('button', { name: /connect/i })).toBeDisabled();
  });

  it('shows the account name and currency when active', async () => {
    listMock.mockResolvedValue([
      connection({ status: 'ACTIVE', accountName: 'Sunset Cove Beach Resort Ads', currency: 'PHP' }),
    ]);
    renderSection();
    expect(await screen.findByText(/Sunset Cove Beach Resort Ads/)).toBeInTheDocument();
    expect(screen.getByText(/PHP/)).toBeInTheDocument();
  });

  it('prompts to finish setup when connected but no account is chosen', async () => {
    listMock.mockResolvedValue([connection({ status: 'PENDING_ACCOUNT_SELECTION' })]);
    renderSection();
    expect(await screen.findByRole('button', { name: /choose ad account/i })).toBeInTheDocument();
  });

  it('navigates to the consent screen on Connect', async () => {
    listMock.mockResolvedValue([connection({ provider: 'meta' })]);
    const assign = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { ...window.location, assign, href: '' },
      writable: true,
    });

    renderSection();
    await screen.findByText('Meta Ads');
    fireEvent.click(screen.getByRole('button', { name: /connect/i }));

    await waitFor(() => expect(authorizeMock).toHaveBeenCalledWith('meta'));
  });

  it('disconnects and refetches', async () => {
    listMock.mockResolvedValue([connection({ status: 'ACTIVE', accountName: 'Ads' })]);
    renderSection();
    // Waiting on the Disconnect button rather than findByText(/Ads/): the
    // accountName fixture "Ads" is also a substring of the "Meta Ads" label
    // rendered in the same row, so a text-content regex match is ambiguous
    // (matches both nodes). The button is what this test actually needs to
    // wait for and click.
    fireEvent.click(await screen.findByRole('button', { name: /disconnect/i }));

    await waitFor(() => expect(disconnectMock).toHaveBeenCalledWith('meta'));
    expect(listMock).toHaveBeenCalledTimes(2);
  });

  it('shows an error message when the connections list fails to load', async () => {
    listMock.mockRejectedValue(new Error('network down'));
    renderSection();
    expect(await screen.findByText(/could not load ad connections/i)).toBeInTheDocument();
  });

  it('shows a toast when starting Connect fails', async () => {
    listMock.mockResolvedValue([connection({ provider: 'meta' })]);
    authorizeMock.mockRejectedValue(new Error('authorize failed'));
    renderSection();

    fireEvent.click(await screen.findByRole('button', { name: /connect/i }));

    await waitFor(() =>
      expect(screen.getByText(/could not start the meta ads connection/i)).toBeInTheDocument(),
    );
  });

  it('shows a toast when Disconnect fails', async () => {
    listMock.mockResolvedValue([connection({ status: 'ACTIVE', accountName: 'Ads' })]);
    disconnectMock.mockRejectedValue(new Error('disconnect failed'));
    renderSection();

    fireEvent.click(await screen.findByRole('button', { name: /disconnect/i }));

    await waitFor(() =>
      expect(screen.getByText(/could not disconnect from meta ads/i)).toBeInTheDocument(),
    );
  });

  it('does not show a campaign / reporting-scope control (that lives on Performance now)', async () => {
    listMock.mockResolvedValue([
      connection({ status: 'ACTIVE', accountName: 'Sunset Cove Beach Resort Ads', currency: 'PHP',
                   campaignId: 'cmp_1', campaignName: 'Dry-Season Promo' }),
    ]);
    renderSection();
    await screen.findByRole('button', { name: /disconnect/i });
    expect(screen.queryByText(/reporting on/i)).not.toBeInTheDocument();
  });
});
