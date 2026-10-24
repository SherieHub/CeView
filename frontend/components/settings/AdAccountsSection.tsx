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
import { useEffect, useState } from 'react';
import { Loader2, Megaphone, Plus } from 'lucide-react';
import { useToast } from '../shared/Toast';
import { useAdConnections } from '../../services/useAdConnections';
import { apiClient } from '../../services/apiClient';
import { PlatformLogo } from './PlatformLogo';
import { IN_DEVELOPMENT_LABEL, IN_DEVELOPMENT_SUBTITLE, isInDevelopment } from './platformAvailability';
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
  onLoaded,
}: {
  /** Called when a provider needs its ad account chosen — opens the picker. */
  onConnected: (provider: AdProvider) => void;
  /** Reports the list as it loads and changes, for the page's summary. */
  onLoaded?: (connections: AdConnection[] | null) => void;
}) {
  const { connections, error, disconnect } = useAdConnections();
  const { showToast } = useToast();
  const [busy, setBusy] = useState<AdProvider | null>(null);

  useEffect(() => {
    onLoaded?.(connections);
  }, [connections, onLoaded]);

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

  return (
    <section className="pf-card pf-panel" id="pf-ads" aria-labelledby="pf-ads-title">
      <div className="pf-panel-head pf-panel-head--light">
        <span className="pf-panel-icon" aria-hidden="true"><Megaphone size={22} /></span>
        <div>
          <h2 id="pf-ads-title" className="pf-panel-title">Ad accounts</h2>
          <p className="pf-panel-sub">
            Connect an ad account to pull impressions, clicks, and spend into Performance
            automatically. Revenue and bookings stay yours to enter.
          </p>
        </div>
      </div>

      <div className="pf-panel-body">
        {connections === null ? (
          <div className="flex flex-col gap-3" aria-hidden="true">
            <div className="skel" style={{ height: 72 }} />
            <div className="skel" style={{ height: 72 }} />
          </div>
        ) : (
          <>
            {error != null && (
              <p className="pf-note pf-note--error">
                Could not load ad connections. Check that the backend is running.
              </p>
            )}
            <ul className="pf-rows">
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
            </ul>
          </>
        )}
      </div>
    </section>
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
  // Still being built: no Connect, but an existing grant can still be disconnected.
  const inDevelopment = isInDevelopment(provider) && !isActive && !isPending;

  return (
    <li className="pf-row" data-muted={!configured || inDevelopment || undefined}>
      <PlatformLogo platform={provider} />
      <div className="pf-row-text">
        <p className="pf-row-name">{PROVIDER_LABELS[provider]}</p>
        <p className="pf-row-sub">{inDevelopment ? IN_DEVELOPMENT_SUBTITLE : statusLine(connection)}</p>
      </div>

      <div className="pf-row-actions">
        {busy && <Loader2 className="animate-spin pf-busy" size={16} aria-hidden="true" />}
        {isActive && <span className="pf-pill">Connected</span>}
        {inDevelopment && <span className="pf-pill pf-pill--dev">{IN_DEVELOPMENT_LABEL}</span>}

        {isPending && (
          <button type="button" className="pf-connect" onClick={onChooseAccount}>
            Choose ad account
          </button>
        )}

        {inDevelopment ? null : isActive || isPending ? (
          <>
            <span className="pf-divider" aria-hidden="true" />
            <button type="button" className="pf-text-btn" onClick={onDisconnect} disabled={busy}>
              Disconnect
            </button>
          </>
        ) : (
          <button
            type="button"
            className="pf-connect"
            onClick={onConnect}
            disabled={!configured || busy}
            title={configured ? undefined : 'This server has no credentials for this provider'}
          >
            <Plus size={16} aria-hidden="true" />Connect
          </button>
        )}
      </div>
    </li>
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
