/**
 * CARD — Settings: Platforms (M3-9)
 *
 * Covers: connected/disconnected row rendering, the real-OAuth Connect button,
 * the per-status rows (NEEDS_PAGE / NEEDS_RECONNECT / NO_LINKED_INSTAGRAM), the
 * Page picker, TikTok's return-and-complete step, and immediate disconnect + toast.
 */
import { StrictMode } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PlatformsSettings from './PlatformsSettings';
import { OverlayStackProvider } from '../shared/useOverlayStack';
import { ToastProvider } from '../shared/Toast';
import type { PlatformConnection } from '../../types';

const CONNECTIONS: PlatformConnection[] = [
  { platform: 'instagram', connected: true, handle: '@cebu.dive', connectedAt: '2026-05-01T00:00:00Z', status: 'ACTIVE', configured: true },
  { platform: 'tiktok', connected: false, handle: null, connectedAt: null, status: 'DISCONNECTED', configured: true },
  { platform: 'facebook', connected: false, handle: null, connectedAt: null, status: 'DISCONNECTED', configured: true },
];

const connectMock = vi.fn();
const disconnectMock = vi.fn();
const refreshMock = vi.fn();
const tiktokCompleteMock = vi.fn();
const adCompleteMock = vi.fn();
const metaPagesMock = vi.fn();
const adListMock = vi.fn();
let connections: PlatformConnection[] | null = CONNECTIONS;
let available = true;

vi.mock('../../services/connectionsStore', () => ({
  useConnections: () => ({
    connections,
    available,
    isConnected: (platform: string) => connections?.find((c) => c.platform === platform)?.connected ?? false,
    statusOf: (platform: string) => connections?.find((c) => c.platform === platform)?.status ?? 'DISCONNECTED',
    connect: (...args: unknown[]) => connectMock(...args),
    disconnect: (...args: unknown[]) => disconnectMock(...args),
    refresh: (...args: unknown[]) => refreshMock(...args),
    onDisconnect: () => () => {},
  }),
}));

vi.mock('../../services/apiClient', () => ({
  apiClient: {
    adConnections: {
      complete: (...args: unknown[]) => adCompleteMock(...args),
      list: (...args: unknown[]) => adListMock(...args),
      authorize: () => Promise.resolve({ authorizeUrl: '#' }),
      disconnect: () => Promise.resolve({ ok: true }),
      accounts: () => Promise.resolve([]),
      selectAccount: () => Promise.resolve({}),
    },
    connections: {
      metaPages: (...args: unknown[]) => metaPagesMock(...args),
      selectMetaPage: () => Promise.resolve([]),
      tiktokComplete: (...args: unknown[]) => tiktokCompleteMock(...args),
    },
  },
}));

function renderSettings() {
  return render(
    <ToastProvider>
      <OverlayStackProvider>
        <PlatformsSettings />
      </OverlayStackProvider>
    </ToastProvider>,
  );
}

beforeEach(() => {
  connections = CONNECTIONS;
  connectMock.mockReset().mockResolvedValue(undefined);
  disconnectMock.mockReset().mockResolvedValue(undefined);
  refreshMock.mockReset().mockResolvedValue(undefined);
  tiktokCompleteMock.mockReset().mockResolvedValue([]);
  adCompleteMock.mockReset().mockResolvedValue(undefined);
  metaPagesMock.mockReset().mockResolvedValue([]);
  adListMock.mockReset().mockResolvedValue([]);
});

afterEach(() => {
  window.history.replaceState({}, '', '/');
});

describe('PlatformsSettings', () => {
  it('completes Meta once with authentication, clears credentials and opens the Page picker', async () => {
    window.history.replaceState({}, '', '/settings/platforms?ad_code=C1&ad_provider=meta&state=S1');
    render(<StrictMode><ToastProvider><OverlayStackProvider><PlatformsSettings /></OverlayStackProvider></ToastProvider></StrictMode>);
    expect(window.location.search).toBe('');
    await waitFor(() => expect(adCompleteMock).toHaveBeenCalledExactlyOnceWith('meta', 'C1', 'S1'));
    expect(await screen.findByText('Choose a Facebook Page')).toBeInTheDocument();
  });

  it('does not open a picker if authenticated Meta completion fails', async () => {
    adCompleteMock.mockRejectedValue(new Error('403'));
    window.history.replaceState({}, '', '/settings/platforms?ad_code=C1&ad_provider=meta&state=S1');
    renderSettings();
    expect(await screen.findByText('Could not complete the connection. Try again.')).toBeInTheDocument();
    expect(screen.queryByText('Choose a Facebook Page')).not.toBeInTheDocument();
    expect(window.location.search).toBe('');
  });

  it('rejects a Meta code without state before attempting completion', async () => {
    window.history.replaceState({}, '', '/settings/platforms?ad_code=C1&ad_provider=meta');
    renderSettings();
    expect(await screen.findByText('Could not complete the connection. Try again.')).toBeInTheDocument();
    expect(adCompleteMock).not.toHaveBeenCalled();
    expect(window.location.search).toBe('');
  });

  it('shows connected platforms as Verified with their handle, and others as Connect', () => {
    renderSettings();

    expect(screen.getByText('@cebu.dive')).toBeInTheDocument();
    expect(screen.getAllByText('Verified')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Connect Facebook' })).toBeInTheDocument();
  });

  describe('TikTok while it is in development', () => {
    it('shows "In development" instead of a Connect button, even when the server is configured', () => {
      renderSettings();

      const row = screen.getByText('TikTok').closest('li') as HTMLElement;
      expect(within(row).getByText('In development')).toBeInTheDocument();
      expect(within(row).getByText(/coming soon/i)).toBeInTheDocument();
      expect(within(row).queryByRole('button')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /connect tiktok/i })).not.toBeInTheDocument();
    });

    it('does not offer a Reconnect either', () => {
      connections = CONNECTIONS.map((c) => (c.platform === 'tiktok' ? { ...c, status: 'NEEDS_RECONNECT' as const } : c));
      renderSettings();

      const row = screen.getByText('TikTok').closest('li') as HTMLElement;
      expect(within(row).getByText('In development')).toBeInTheDocument();
      expect(within(row).queryByRole('button')).not.toBeInTheDocument();
    });

    it('leaves it out of the connection count, so the progress reflects what can be connected', () => {
      renderSettings();

      expect(screen.getByText('1 of 2 platforms connected')).toBeInTheDocument();
    });
  });

  it('shows a loading skeleton before connections have loaded', () => {
    connections = null;
    const { container } = renderSettings();

    expect(container.querySelector('.skel')).toBeInTheDocument();
  });

  describe('when the backend has no platform connections', () => {
    it('says so and disables every Connect button', () => {
      available = false;
      try {
        renderSettings();
        expect(screen.getByRole('status')).toHaveTextContent(/isn't available yet/i);
        for (const button of screen.getAllByRole('button', { name: /^connect (tiktok|facebook)$/i })) {
          expect(button).toBeDisabled();
        }
      } finally {
        available = true;
      }
    });
  });

  describe('real connections', () => {
    it('starts the real login when Connect is pressed (no fake consent modal)', async () => {
      renderSettings();

      fireEvent.click(screen.getByRole('button', { name: 'Connect Facebook' }));

      await waitFor(() => expect(connectMock).toHaveBeenCalledTimes(1));
      expect(connectMock.mock.calls[0]).toHaveLength(1); // connect(platform) — no handle argument
      expect(screen.queryByText(/grant scope/i)).not.toBeInTheDocument();
    });

    it('disables Connect when the server has no credentials for that platform', () => {
      connections = CONNECTIONS.map((c) => (c.platform === 'facebook' ? { ...c, configured: false } : c));
      renderSettings();

      const facebookRow = screen.getByText('Facebook').closest('li') as HTMLElement;
      expect(within(facebookRow).getByRole('button', { name: 'Connect Facebook' })).toBeDisabled();
      expect(within(facebookRow).getByText('Not available on this server yet')).toBeInTheDocument();
    });

    it('keeps every Connect disabled after a click (the browser is navigating away)', async () => {
      renderSettings();

      fireEvent.click(screen.getByRole('button', { name: 'Connect Facebook' }));

      await waitFor(() => expect(connectMock).toHaveBeenCalledTimes(1));
      expect(screen.getByRole('button', { name: 'Connect Facebook' })).toBeDisabled();
    });

    it('toasts and re-enables Connect when starting the login fails', async () => {
      connectMock.mockRejectedValue(new Error('boom'));
      renderSettings();

      fireEvent.click(screen.getByRole('button', { name: 'Connect Facebook' }));

      expect(await screen.findByText(/could not start the facebook connection/i)).toBeInTheDocument();
      await waitFor(() => expect(screen.getByRole('button', { name: 'Connect Facebook' })).toBeEnabled());
    });

    it('asks for a Page after the Meta login, and opens the picker', async () => {
      connections = CONNECTIONS.map((c) =>
        c.platform === 'facebook' ? { ...c, connected: false, status: 'NEEDS_PAGE' as const } : c);
      renderSettings();

      expect(screen.getByText(/choose which facebook page/i)).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Choose Page' }));

      expect(await screen.findByText('Choose a Facebook Page')).toBeInTheDocument();
    });

    it('offers a reconnect when permissions changed', async () => {
      connections = CONNECTIONS.map((c) =>
        c.platform === 'instagram' ? { ...c, connected: false, status: 'NEEDS_RECONNECT' as const } : c);
      renderSettings();

      const row = screen.getByText('Instagram').closest('li') as HTMLElement;
      expect(within(row).getByText(/permissions changed/i)).toBeInTheDocument();
      fireEvent.click(within(row).getByRole('button', { name: 'Reconnect Instagram' }));

      await waitFor(() => expect(connectMock).toHaveBeenCalledWith('instagram'));
    });

    it('shows Choose Page on an Instagram row that needs a Page', () => {
      connections = CONNECTIONS.map((c) =>
        c.platform === 'instagram' ? { ...c, connected: false, status: 'NEEDS_PAGE' as const } : c);
      renderSettings();

      const row = screen.getByText('Instagram').closest('li') as HTMLElement;
      expect(within(row).getByRole('button', { name: 'Choose Page' })).toBeInTheDocument();
    });

    it('tells the user to link an Instagram business account and "Check again" reopens the Page picker', async () => {
      connections = CONNECTIONS.map((c) =>
        c.platform === 'instagram' ? { ...c, connected: false, status: 'NO_LINKED_INSTAGRAM' as const } : c);
      renderSettings();

      expect(screen.getByText(/link an instagram business account/i)).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Check again' }));

      expect(await screen.findByRole('dialog', { name: 'Choose a Facebook Page' })).toBeInTheDocument();
      expect(metaPagesMock).toHaveBeenCalled(); // re-asks Meta, which re-records the IG link on save
    });

    it('refreshes when the Page picker is cancelled (the save may have landed mid-cancel)', async () => {
      connections = CONNECTIONS.map((c) =>
        c.platform === 'facebook' ? { ...c, connected: false, status: 'NEEDS_PAGE' as const } : c);
      renderSettings();

      fireEvent.click(screen.getByRole('button', { name: 'Choose Page' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));

      await waitFor(() => expect(refreshMock).toHaveBeenCalled());
      expect(screen.queryByRole('dialog', { name: 'Choose a Facebook Page' })).not.toBeInTheDocument();
    });

    it('chains to the ad-account picker after choosing a Page when Meta ads still need an account', async () => {
      connections = CONNECTIONS.map((c) =>
        c.platform === 'facebook' ? { ...c, connected: false, status: 'NEEDS_PAGE' as const } : c);
      metaPagesMock.mockResolvedValue([{ id: 'P1', name: 'Cebu Dive Co.', instagramUsername: 'cebu.dive' }]);
      adListMock.mockResolvedValue([
        {
          provider: 'meta', configured: true, status: 'PENDING_ACCOUNT_SELECTION', accountName: null,
          currency: null, campaignId: null, campaignName: null, connectedAt: null, lastSyncedAt: null,
        },
      ]);
      renderSettings();
      await screen.findByRole('button', { name: 'Choose ad account' }); // ad list reported up

      fireEvent.click(screen.getByRole('button', { name: 'Choose Page' }));
      fireEvent.click(await screen.findByRole('radio', { name: /cebu dive co\./i }));
      fireEvent.click(screen.getByRole('button', { name: 'Use this Page' }));

      expect(await screen.findByRole('dialog', { name: /choose a meta ads account/i })).toBeInTheDocument();
      expect(screen.queryByRole('dialog', { name: 'Choose a Facebook Page' })).not.toBeInTheDocument();
      expect(refreshMock).toHaveBeenCalled();
    });

    it('does not open the ad-account picker after choosing a Page when no ad account is pending', async () => {
      connections = CONNECTIONS.map((c) =>
        c.platform === 'facebook' ? { ...c, connected: false, status: 'NEEDS_PAGE' as const } : c);
      metaPagesMock.mockResolvedValue([{ id: 'P1', name: 'Cebu Dive Co.', instagramUsername: null }]);
      renderSettings();

      fireEvent.click(screen.getByRole('button', { name: 'Choose Page' }));
      fireEvent.click(await screen.findByRole('radio', { name: /cebu dive co\./i }));
      fireEvent.click(screen.getByRole('button', { name: 'Use this Page' }));

      await waitFor(() => expect(refreshMock).toHaveBeenCalled());
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('Disconnect is immediate and the toast names both Meta platforms (one grant)', async () => {
    renderSettings();

    fireEvent.click(screen.getByRole('button', { name: /disconnect/i }));

    expect(disconnectMock).toHaveBeenCalledWith('instagram');
    await waitFor(() => expect(screen.getByText('Disconnected Facebook and Instagram')).toBeInTheDocument());
  });

  it('Disconnect on TikTok toasts TikTok only', async () => {
    connections = CONNECTIONS.map((c) =>
      c.platform === 'tiktok' ? { ...c, connected: true, status: 'ACTIVE' as const, handle: '@cebu' } : c);
    renderSettings();

    const row = screen.getByText('TikTok').closest('li') as HTMLElement;
    fireEvent.click(within(row).getByRole('button', { name: /disconnect/i }));

    expect(disconnectMock).toHaveBeenCalledWith('tiktok');
    expect(await screen.findByText('Disconnected from TikTok')).toBeInTheDocument();
  });

  it('toasts a failure (and no success) when Disconnect fails', async () => {
    disconnectMock.mockRejectedValue(new Error('500'));
    renderSettings();

    fireEvent.click(screen.getByRole('button', { name: /disconnect/i }));

    expect(await screen.findByText('Could not disconnect. Try again.')).toBeInTheDocument();
    expect(screen.queryByText(/^Disconnected/)).not.toBeInTheDocument();
  });

  it('still renders the publishing platforms alongside the ad accounts section', async () => {
    renderSettings();
    expect(await screen.findByText('Instagram')).toBeInTheDocument();
    expect(await screen.findByText('Ad accounts')).toBeInTheDocument();
  });

  describe('post-redirect handling', () => {
    afterEach(() => {
      window.history.replaceState({}, '', '/settings/platforms');
    });

    it('opens the account picker for ?adconnect=meta', async () => {
      window.history.pushState({}, '', '/settings/platforms?adconnect=meta');
      renderSettings();

      expect(await screen.findByRole('dialog', { name: /choose a meta ads account/i })).toBeInTheDocument();
    });

    it('shows a cancelled toast for ?adconnect_error=access_denied', async () => {
      window.history.pushState({}, '', '/settings/platforms?adconnect_error=access_denied');
      renderSettings();

      expect(await screen.findByText(/connection cancelled/i)).toBeInTheDocument();
    });

    it('shows a specific message for a mapped error code, not the raw slug', async () => {
      window.history.pushState({}, '', '/settings/platforms?adconnect_error=token_exchange_failed');
      renderSettings();

      expect(await screen.findByText(/couldn.t connect to that platform/i)).toBeInTheDocument();
      expect(screen.queryByText(/token_exchange_failed/i)).not.toBeInTheDocument();
    });

    it('strips the query params after handling them', async () => {
      window.history.pushState({}, '', '/settings/platforms?adconnect_error=access_denied');
      renderSettings();

      await waitFor(() => expect(window.location.search).toBe(''));
    });

    it('shows the friendly error and strips the query when TikTok sends the user back with social_error', async () => {
      window.history.pushState({}, '', '/settings/platforms?social_error=access_denied&platform=tiktok');
      renderSettings();

      expect(await screen.findByText('Connection cancelled.')).toBeInTheDocument();
      expect(window.location.search).toBe('');
    });

    it('finishes a TikTok connection exactly once, strips the query, toasts and refreshes', async () => {
      window.history.pushState({}, '', '/settings/platforms?tiktok_code=C1&state=S1');
      render(
        <StrictMode>
          <ToastProvider>
            <OverlayStackProvider>
              <PlatformsSettings />
            </OverlayStackProvider>
          </ToastProvider>
        </StrictMode>,
      );

      expect(await screen.findByText('Connected to TikTok')).toBeInTheDocument();
      expect(tiktokCompleteMock).toHaveBeenCalledTimes(1);
      expect(tiktokCompleteMock).toHaveBeenCalledWith('C1', 'S1');
      expect(window.location.search).toBe('');
      await waitFor(() => expect(refreshMock).toHaveBeenCalled());
    });

    it('toasts a failure (and not success) when finishing TikTok fails', async () => {
      tiktokCompleteMock.mockRejectedValue(new Error('403'));
      window.history.pushState({}, '', '/settings/platforms?tiktok_code=C1&state=S1');
      renderSettings();

      expect(await screen.findByText(/couldn.t finish connecting tiktok/i)).toBeInTheDocument();
      expect(screen.queryByText('Connected to TikTok')).not.toBeInTheDocument();
      // A 409 means a concurrent finish already succeeded - re-read the truth.
      await waitFor(() => expect(refreshMock).toHaveBeenCalled());
    });

    it.each([
      ['server_error', 'TikTok had a problem — try again in a moment.'],
      ['temporarily_unavailable', 'TikTok had a problem — try again in a moment.'],
      ['invalid_scope', 'TikTok did not allow the requested permissions.'],
    ])('shows a friendly message for social_error=%s', async (code, message) => {
      window.history.pushState({}, '', `/settings/platforms?social_error=${code}&platform=tiktok`);
      renderSettings();

      expect(await screen.findByText(message)).toBeInTheDocument();
      expect(screen.queryByText(code)).not.toBeInTheDocument();
    });

    it('strips a tiktok_code that arrives without state, and shows the failure toast without exchanging it', async () => {
      window.history.pushState({}, '', '/settings/platforms?tiktok_code=C1');
      renderSettings();

      expect(await screen.findByText(/couldn.t finish connecting tiktok/i)).toBeInTheDocument();
      expect(window.location.search).toBe('');
      expect(tiktokCompleteMock).not.toHaveBeenCalled();
    });

    it('strips the code from the URL before the network call resolves', async () => {
      let resolveComplete: (value: unknown) => void = () => {};
      tiktokCompleteMock.mockReturnValue(new Promise((resolve) => { resolveComplete = resolve; }));
      window.history.pushState({}, '', '/settings/platforms?tiktok_code=C1&state=S1');
      renderSettings();

      await waitFor(() => expect(tiktokCompleteMock).toHaveBeenCalledWith('C1', 'S1'));
      expect(window.location.search).toBe(''); // promise still pending
      resolveComplete([]);
      expect(await screen.findByText('Connected to TikTok')).toBeInTheDocument();
    });

    it('waits for the connection list, then opens the ad picker for ?adconnect=meta', async () => {
      connections = null;
      window.history.pushState({}, '', '/settings/platforms?adconnect=meta');
      const { rerender } = renderSettings();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

      connections = CONNECTIONS;
      rerender(
        <ToastProvider>
          <OverlayStackProvider>
            <PlatformsSettings />
          </OverlayStackProvider>
        </ToastProvider>,
      );

      expect(await screen.findByRole('dialog', { name: /choose a meta ads account/i })).toBeInTheDocument();
    });

    it('waits for the connection list, then opens the Page picker when facebook needs a Page', async () => {
      connections = null;
      window.history.pushState({}, '', '/settings/platforms?adconnect=meta');
      const { rerender } = renderSettings();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

      connections = CONNECTIONS.map((c) =>
        c.platform === 'facebook' ? { ...c, connected: false, status: 'NEEDS_PAGE' as const } : c);
      rerender(
        <ToastProvider>
          <OverlayStackProvider>
            <PlatformsSettings />
          </OverlayStackProvider>
        </ToastProvider>,
      );

      expect(await screen.findByRole('dialog', { name: 'Choose a Facebook Page' })).toBeInTheDocument();
      expect(screen.queryByRole('dialog', { name: /meta ads account/i })).not.toBeInTheDocument();
    });

    it('opens the Page picker after returning from Meta when no Page is chosen yet', async () => {
      connections = CONNECTIONS.map((c) =>
        c.platform === 'facebook' ? { ...c, connected: false, status: 'NEEDS_PAGE' as const } : c);
      window.history.pushState({}, '', '/settings/platforms?adconnect=meta');
      renderSettings();

      expect(await screen.findByText('Choose a Facebook Page')).toBeInTheDocument();
    });
  });
});
