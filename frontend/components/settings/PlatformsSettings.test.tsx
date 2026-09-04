/**
 * CARD — Settings: Platforms (M3-9)
 *
 * Covers: connected/disconnected row rendering, the two-step connect modal
 * (redirecting -> scope grant -> connect() + toast), Cancel leaving the
 * connection untouched, and immediate disconnect + toast.
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PlatformsSettings from './PlatformsSettings';
import { OverlayStackProvider } from '../shared/useOverlayStack';
import { ToastProvider } from '../shared/Toast';
import type { PlatformConnection } from '../../types';

const CONNECTIONS: PlatformConnection[] = [
  { platform: 'instagram', connected: true, handle: '@cebu.dive', connectedAt: '2026-05-01T00:00:00Z' },
  { platform: 'tiktok', connected: false, handle: null, connectedAt: null },
  { platform: 'facebook', connected: false, handle: null, connectedAt: null },
];

const connectMock = vi.fn();
const disconnectMock = vi.fn();
let connections: PlatformConnection[] | null = CONNECTIONS;

vi.mock('../../services/connectionsStore', () => ({
  useConnections: () => ({
    connections,
    isConnected: (platform: string) => connections?.find((c) => c.platform === platform)?.connected ?? false,
    connect: (...args: unknown[]) => connectMock(...args),
    disconnect: (...args: unknown[]) => disconnectMock(...args),
    onDisconnect: () => () => {},
  }),
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
});

describe('PlatformsSettings', () => {
  it('shows connected platforms as Verified with their handle, and others as Connect', () => {
    renderSettings();

    expect(screen.getByText('@cebu.dive')).toBeInTheDocument();
    expect(screen.getAllByText('Verified')).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Connect' })).toHaveLength(2); // tiktok, facebook
  });

  it('shows a loading skeleton before connections have loaded', () => {
    connections = null;
    const { container } = renderSettings();

    expect(container.querySelector('.skel')).toBeInTheDocument();
  });

  describe('connect flow', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('redirecting -> scope grant -> Grant scope connects and shows a toast', async () => {
      renderSettings();

      fireEvent.click(screen.getAllByRole('button', { name: 'Connect' })[0]);

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText(/redirecting to/i)).toBeInTheDocument();

      act(() => vi.advanceTimersByTime(1300));

      expect(screen.getByText(/requesting permission/i)).toBeInTheDocument();
      expect(screen.getByText(/publish posts on your behalf/i)).toBeInTheDocument();

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /grant scope/i }));
      });

      expect(connectMock).toHaveBeenCalledWith('tiktok', '');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.getByText(/connected to tiktok/i)).toBeInTheDocument();
    });

    it('Cancel closes the modal without connecting', () => {
      renderSettings();

      fireEvent.click(screen.getAllByRole('button', { name: 'Connect' })[0]);
      act(() => vi.advanceTimersByTime(1300));

      fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(connectMock).not.toHaveBeenCalled();
    });
  });

  it('Disconnect is immediate and shows a confirmation toast', async () => {
    renderSettings();

    fireEvent.click(screen.getByRole('button', { name: /disconnect/i }));

    expect(disconnectMock).toHaveBeenCalledWith('instagram');
    await waitFor(() => expect(screen.getByText(/disconnected from instagram/i)).toBeInTheDocument());
  });
});
