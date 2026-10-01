/**
 * Settings -> Platforms: ad-account connections.
 *
 * Sits BELOW the existing publishing-platform rows and is deliberately separate
 * from them. Connecting a Meta ad account grants read access to ad metrics; it
 * is not permission to publish, and one Meta grant covers both Facebook and
 * Instagram placements. Merging the two lists would misrepresent both.
 *
 * Spec: docs/superpowers/specs/2026-09-06-ad-platform-connections-design.md
 */
import { useState } from 'react';
import { CheckCircle2, Circle, Loader2 } from 'lucide-react';
import { useToast } from '../shared/Toast';
import { useAdConnections } from '../../services/useAdConnections';
import { apiClient } from '../../services/apiClient';
import type { AdConnection, AdProvider } from '../../types';

const PROVIDER_LABELS: Record<AdProvider, string> = {
  meta: 'Meta Ads',
  tiktok: 'TikTok Ads',
};

const PROVIDER_HINTS: Record<AdProvider, string> = {
  meta: 'Covers Facebook and Instagram ad placements',
  tiktok: 'TikTok Ads Manager',
};

export default function AdAccountsSection({
  onConnected,
}: {
  /** Called when a provider needs its ad account chosen — opens the picker. */
  onConnected: (provider: AdProvider) => void;
}) {
  const { connections, error, disconnect } = useAdConnections();
  const { showToast } = useToast();
  const [busy, setBusy] = useState<AdProvider | null>(null);

  async function startConnect(provider: AdProvider) {
    setBusy(provider);
    try {
      const { authorizeUrl } = await apiClient.adConnections.authorize(provider);
      // A full navigation, not a popup: the consent screen is a first-party
      // page on the platform's domain and returns via our own callback.
      window.location.href = authorizeUrl;
    } catch {
      showToast(`Could not start the ${PROVIDER_LABELS[provider]} connection`);
      setBusy(null);
    }
  }

  async function handleDisconnect(provider: AdProvider) {
    setBusy(provider);
    try {
      await disconnect(provider);
      showToast(`Disconnected from ${PROVIDER_LABELS[provider]}`);
    } catch {
      showToast(`Could not disconnect from ${PROVIDER_LABELS[provider]}`);
    } finally {
      setBusy(null);
    }
  }

  if (connections === null) {
    return (
      <div className="card p-6">
        <div className="flex flex-col gap-3" aria-hidden="true">
          <div className="skel" style={{ height: 64 }} />
          <div className="skel" style={{ height: 64 }} />
        </div>
      </div>
    );
  }

  return (
    <div className="card p-6">
      <h2 className="heading-lg mb-1">Ad accounts</h2>
      <p className="body-sm mb-5">
        Connect an ad account to pull impressions, clicks, and spend into Performance
        automatically. Revenue and bookings stay yours to enter.
      </p>

      {error != null && (
        <p className="body-sm mb-4 text-[var(--color-critical-text)]">
          Could not load ad connections. Check that the backend is running.
        </p>
      )}

      <div className="flex flex-col gap-3">
        {connections.map((connection) => (
          <AdConnectionRow
            key={connection.provider}
            connection={connection}
            busy={busy === connection.provider}
            onConnect={() => startConnect(connection.provider)}
            onChooseAccount={() => onConnected(connection.provider)}
            onDisconnect={() => handleDisconnect(connection.provider)}
          />
        ))}
      </div>
    </div>
  );
}

function AdConnectionRow({
  connection,
  busy,
  onConnect,
  onChooseAccount,
  onDisconnect,
}: {
  connection: AdConnection;
  busy: boolean;
  onConnect: () => void;
  onChooseAccount: () => void;
  onDisconnect: () => void;
}) {
  const { provider, configured, status, accountName, currency } = connection;
  const isActive = status === 'ACTIVE';
  const isPending = status === 'PENDING_ACCOUNT_SELECTION';

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--color-gray-light)] p-4">
      <div className="flex items-center gap-3">
        {isActive ? (
          <CheckCircle2 className="text-[var(--color-mint-primary)]" aria-hidden="true" />
        ) : (
          <Circle className="text-[var(--color-text-muted)]" aria-hidden="true" />
        )}
        <div>
          <p className="font-semibold text-navy-dark">{PROVIDER_LABELS[provider]}</p>
          <p className="body-xs text-[var(--color-text-muted)]">{statusLine(connection)}</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {isActive && <span className="badge badge--teal">Connected</span>}
        {busy && <Loader2 className="animate-spin" size={16} aria-hidden="true" />}

        {isPending && (
          <button type="button" className="btn-primary" onClick={onChooseAccount}>
            Choose ad account
          </button>
        )}

        {isActive || isPending ? (
          <button type="button" className="btn-outline--sm" onClick={onDisconnect} disabled={busy}>
            Disconnect
          </button>
        ) : (
          <button
            type="button"
            className="btn-primary"
            onClick={onConnect}
            disabled={!configured || busy}
            title={configured ? undefined : 'This server has no credentials for this provider'}
          >
            Connect
          </button>
        )}
      </div>
    </div>
  );
}

function statusLine(connection: AdConnection): string {
  const { configured, status, accountName, currency, provider } = connection;
  const isActive = status === 'ACTIVE';
  const isPending = status === 'PENDING_ACCOUNT_SELECTION';
  if (!configured) return 'Not configured on this server';
  if (isActive) {
    return currency ? `${accountName ?? 'Connected'} · ${currency}` : (accountName ?? 'Connected');
  }
  if (isPending) return 'Connected — choose which ad account to report on';
  return PROVIDER_HINTS[provider];
}
