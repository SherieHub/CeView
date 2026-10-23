/**
 * CARD — Settings: Platforms
 * Depends on: Foundation — Settings Shell (M3-F3)
 * Prototype reference: ui-ux-prototype.html:4131–4202, 4267–4284
 * Screen doc: docs/module-3/screens/settings-platforms.md
 * Plan: docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/04-module-3.md (M3-9)
 *
 * Route: /settings/platforms
 * Gates: Content Studio's publish picker (see PublishComposer.tsx) — connection
 * state lives in ConnectionsStoreProvider (mounted above AppShell), not here,
 * so Connect/Disconnect here are visible in Content Studio without a reload.
 *
 * Connect runs real OAuth: Facebook and Instagram share one Meta login (the same
 * one the ads connection uses), TikTok has its own. After Meta, the operator
 * picks the Facebook Page to publish to; TikTok's redirect brings a code back
 * here, which is completed through an authenticated call.
 */
import { useEffect, useRef, useState } from 'react';
import {
  BarChart3, ChevronRight, Layers, Plus, Send, Share2, Zap,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useToast } from '../shared/Toast';
import { useConnections } from '../../services/connectionsStore';
import { apiClient } from '../../services/apiClient';
import AdAccountsSection from './AdAccountsSection';
import AdSpendLimitsSection from './AdSpendLimitsSection';
import AdAccountPickerModal from './AdAccountPickerModal';
import PagePickerModal from './PagePickerModal';
import { PlatformLogo } from './PlatformLogo';
import { IN_DEVELOPMENT_LABEL, IN_DEVELOPMENT_SUBTITLE, isInDevelopment } from './platformAvailability';
import type { AdConnection, AdProvider, PlatformId, SocialStatus } from '../../types';
import './platforms.css';

const PLATFORM_LABELS: Record<PlatformId, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  facebook: 'Facebook',
};

function rowSubtitle(status: SocialStatus, handle: string | null | undefined, notSetUp: boolean): string {
  if (notSetUp && status === 'DISCONNECTED') return 'Not available on this server yet';
  switch (status) {
    case 'ACTIVE': return handle || 'Connected';
    case 'NEEDS_PAGE': return 'Choose which Facebook Page to publish to';
    case 'NEEDS_RECONNECT': return 'Permissions changed — reconnect to keep publishing';
    case 'NO_LINKED_INSTAGRAM': return 'Link an Instagram business account to your Page, then check again';
    default: return 'Not connected';
  }
}

const WHY = [
  { icon: BarChart3, title: 'Automatically pull performance data', body: 'Ad accounts bring impressions, clicks and spend into Performance.' },
  { icon: Send, title: 'Publish straight from Content Studio', body: 'Connected platforms are the ones Quick Post can publish to.' },
  { icon: Zap, title: 'Decide with real numbers', body: 'See what each post and ad actually did, in one place.' },
];

function StatusTile({ href, icon, value, label }: { href: string; icon: ReactNode; value: string; label: string }) {
  return (
    <a className="pf-tile" href={href}>
      <span className="pf-tile-icon" aria-hidden="true">{icon}</span>
      <span className="pf-tile-text">
        <strong className="num">{value}</strong>
        <span>{label}</span>
      </span>
      <ChevronRight size={18} aria-hidden="true" />
    </a>
  );
}

/**
 * Friendly copy for every `adconnect_error` code AdConnectionController can
 * send (see backend `AdConnectionController.callback`). Anything not listed
 * here — a code this frontend doesn't know about yet — falls back to a
 * generic message rather than showing the raw slug to the operator.
 */
const AD_CONNECT_ERROR_MESSAGES: Record<string, string> = {
  access_denied: 'Connection cancelled.',
  consent_declined: 'Connection cancelled.',
  invalid_provider: 'Could not complete the connection. Try again.',
  missing_code_or_state: 'Your session expired mid-connection — try again.',
  invalid_state: 'Your session expired mid-connection — try again.',
  token_exchange_failed: "Couldn't connect to that platform — try again.",
  // TikTok's own OAuth error codes, passed through by SocialConnectionController.
  server_error: 'TikTok had a problem — try again in a moment.',
  temporarily_unavailable: 'TikTok had a problem — try again in a moment.',
  invalid_scope: 'TikTok did not allow the requested permissions.',
};

export default function PlatformsSettings() {
  const { connections, available, isConnected, statusOf, connect, disconnect, refresh } = useConnections();
  const { showToast } = useToast();

  const [connectingPlatform, setConnectingPlatform] = useState<PlatformId | null>(null);
  const [pageOpen, setPageOpen] = useState(false);
  // True between landing back from Meta and the connection list arriving.
  const [metaReturn, setMetaReturn] = useState(false);
  // Guards the one-shot TikTok code exchange against StrictMode's double-invoked effect.
  const tiktokCompleteStarted = useRef(false);
  const adCompleteStarted = useRef(false);

  /**
   * The provider whose account picker is open. Set either by returning from the
   * OAuth redirect (?adconnect=meta) or by the row's "Choose ad account" button.
   */
  const [pickerProvider, setPickerProvider] = useState<AdProvider | null>(null);
  const [adRefreshKey, setAdRefreshKey] = useState(0);
  // Reported up by AdAccountsSection, for the summary on the left.
  const [adConnections, setAdConnections] = useState<AdConnection[] | null>(null);

  // Ads callbacks bring ad_code/ad_provider/state for authenticated completion;
  // legacy ?adconnect=<provider> redirects still open their selection UI.
  // ?tiktok_code=<code>&state=<state> (TikTok consent), or ?adconnect_error / ?social_error
  // =<code> on failure. Read them once, then strip them so a refresh doesn't replay them.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const adConnected = params.get('adconnect');
    const adCode = params.get('ad_code');
    const adProvider = params.get('ad_provider');
    const adFailed = params.get('adconnect_error');
    const socialFailed = params.get('social_error');
    const tiktokCode = params.get('tiktok_code');
    const tiktokState = params.get('state');

    if (adConnected === 'meta') {
      setMetaReturn(true); // decided once the connection list has loaded (below)
    } else if (adConnected === 'tiktok') {
      setPickerProvider('tiktok');
    }

    const failed = adFailed ?? socialFailed;
    if (failed) {
      showToast(
        AD_CONNECT_ERROR_MESSAGES[failed] ?? 'Could not complete the connection. Try again.',
      );
    }

    const hasTikTokCode = !!tiktokCode;
    const hasTikTokReturn = hasTikTokCode && !!tiktokState;
    if (adConnected || adFailed || socialFailed || hasTikTokCode || adCode) {
      // Strip first: the one-time code must not linger in the address bar or history.
      window.history.replaceState({}, '', window.location.pathname);
    }

    if (adCode && !adCompleteStarted.current && !failed) {
      adCompleteStarted.current = true;
      if (!tiktokState || (adProvider !== 'meta' && adProvider !== 'tiktok')) {
        showToast('Could not complete the connection. Try again.');
      } else {
        apiClient.adConnections.complete(adProvider, adCode, tiktokState)
          .then(async () => {
            await refresh();
            setAdRefreshKey((key) => key + 1);
            // A fresh Meta grant invalidates the old Page selection.
            if (adProvider === 'meta') setPageOpen(true);
            else setPickerProvider('tiktok');
          })
          .catch(() => {
            showToast('Could not complete the connection. Try again.');
            void refresh();
          });
      }
    }

    if (hasTikTokCode && !tiktokState && !failed) {
      // A code without its state can't be exchanged (and is unverifiable) — don't try.
      showToast("Couldn't finish connecting TikTok — try again.");
    }

    if (hasTikTokReturn && !tiktokCompleteStarted.current) {
      tiktokCompleteStarted.current = true;
      apiClient.connections
        .tiktokComplete(tiktokCode, tiktokState)
        .then(() => {
          showToast('Connected to TikTok');
          void refresh();
        })
        .catch(() => {
          showToast("Couldn't finish connecting TikTok — try again.");
          // A 409 means a concurrent finish already succeeded, so re-read the truth.
          void refresh();
        });
    }
  }, [showToast, refresh]);

  // Back from Meta's login: pick the Page first if publishing still needs one, otherwise the ad account.
  useEffect(() => {
    if (!metaReturn || connections === null) return;
    setMetaReturn(false);
    if (statusOf('facebook') === 'NEEDS_PAGE') setPageOpen(true);
    else setPickerProvider('meta');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metaReturn, connections]);

  // Facebook and Instagram share one Meta login, so while any connect is starting
  // every Connect/Reconnect is locked (two clicks would mint two OAuth states).
  const connectLocked = connectingPlatform !== null;

  async function startConnect(platform: PlatformId) {
    setConnectingPlatform(platform);
    try {
      await connect(platform); // navigates away to the consent screen
    } catch {
      showToast(`Could not start the ${PLATFORM_LABELS[platform]} connection. Try again.`);
      setConnectingPlatform(null);
    }
    // On success the browser is navigating away: keep every Connect button disabled.
  }

  async function handleDisconnect(platform: PlatformId) {
    try {
      await disconnect(platform);
      // Facebook and Instagram are one Meta grant: disconnecting either drops both.
      showToast(platform === 'tiktok' ? 'Disconnected from TikTok' : 'Disconnected Facebook and Instagram');
    } catch {
      showToast('Could not disconnect. Try again.');
    }
  }

  const platforms = Object.keys(PLATFORM_LABELS) as PlatformId[];
  // A platform still in development only counts once it's somehow connected; otherwise
  // "1 of 3" would read as unfinished setup the operator can't actually finish.
  const countable = platforms.filter((p) => !isInDevelopment(p) || isConnected(p));
  const connectedCount = countable.filter((p) => isConnected(p)).length;
  const adCountable = adConnections?.filter((c) => !isInDevelopment(c.provider) || c.status === 'ACTIVE');
  const adActive = adCountable?.filter((c) => c.status === 'ACTIVE').length ?? 0;

  return (
    <div className="pf">
      <header className="pf-head">
        <p className="pf-eyebrow">Settings</p>
        <h1 className="pf-heading">Platforms</h1>
        <p className="pf-subhead">Connect where you publish and where you advertise.</p>
      </header>

      <div className="pf-layout">
        <aside className="pf-aside">
          <section className="pf-card pf-status" aria-labelledby="pf-status-title">
            <h2 id="pf-status-title" className="pf-side-title">Connection status</h2>
            <p className="pf-side-sub">
              {connections === null ? 'Checking your platforms…' : `${connectedCount} of ${countable.length} platforms connected`}
            </p>
            <div className="pf-bar" aria-hidden="true">
              <i style={{ width: `${countable.length ? (connectedCount / countable.length) * 100 : 0}%` }} />
            </div>
            <StatusTile
              href="#pf-ads"
              icon={<Layers size={20} />}
              value={adCountable ? `${adActive} of ${adCountable.length}` : '—'}
              label="Ad accounts connected"
            />
            <StatusTile
              href="#pf-publishing"
              icon={<Share2 size={20} />}
              value={`${connectedCount} of ${countable.length}`}
              label="Platforms connected"
            />
          </section>

          <section className="pf-card pf-why" aria-labelledby="pf-why-title">
            <h2 id="pf-why-title" className="pf-side-title">Why connect?</h2>
            <p className="pf-side-sub">Unlock the full power of CeView with your platforms and ad accounts.</p>
            <ul className="pf-why-list">
              {WHY.map(({ icon: Icon, title, body }) => (
                <li key={title}>
                  <span className="pf-why-icon" aria-hidden="true"><Icon size={18} /></span>
                  <span>
                    <strong>{title}</strong>
                    <span>{body}</span>
                  </span>
                </li>
              ))}
            </ul>
            <span className="pf-why-art" aria-hidden="true" />
          </section>
        </aside>

        <div className="pf-main">
          <section className="pf-card pf-panel" id="pf-publishing" aria-labelledby="pf-publishing-title">
            <div className="pf-panel-head pf-panel-head--dark">
              <span className="pf-panel-icon" aria-hidden="true"><Share2 size={22} /></span>
              <div>
                <h2 id="pf-publishing-title" className="pf-panel-title">Connected platforms</h2>
                <p className="pf-panel-sub">Connection state here gates which platforms Content Studio can publish to.</p>
              </div>
            </div>

            <div className="pf-panel-body">
              {connections === null ? (
                <div className="flex flex-col gap-3" aria-hidden="true">
                  <div className="skel" style={{ height: 72 }} />
                  <div className="skel" style={{ height: 72 }} />
                  <div className="skel" style={{ height: 72 }} />
                </div>
              ) : (
                <>
                  {!available && (
                    <p className="pf-note" role="status">
                      Connecting social platforms isn't available yet, so nothing can be connected from here.
                    </p>
                  )}
                  <ul className="pf-rows">
                    {platforms.map((platform) => {
                      const status = statusOf(platform);
                      const conn = connections.find((c) => c.platform === platform);
                      const notSetUp = conn?.configured === false;
                      // Still being built: no way to start (or restart) a connection, but an
                      // existing one keeps its Disconnect so nobody is stuck with it.
                      const inDevelopment = isInDevelopment(platform) && status !== 'ACTIVE';
                      return (
                        <li key={platform} className="pf-row" data-muted={inDevelopment || undefined}>
                          <PlatformLogo platform={platform} />
                          <div className="pf-row-text">
                            <p className="pf-row-name">{PLATFORM_LABELS[platform]}</p>
                            <p className="pf-row-sub">
                              {inDevelopment ? IN_DEVELOPMENT_SUBTITLE : rowSubtitle(status, conn?.handle, notSetUp)}
                            </p>
                          </div>
                          {status === 'ACTIVE' ? (
                            <div className="pf-row-actions">
                              <span className="pf-pill">Verified</span>
                              <span className="pf-divider" aria-hidden="true" />
                              <button type="button" className="pf-text-btn" onClick={() => handleDisconnect(platform)}>
                                Disconnect
                              </button>
                            </div>
                          ) : inDevelopment ? (
                            <span className="pf-pill pf-pill--dev">{IN_DEVELOPMENT_LABEL}</span>
                          ) : status === 'NEEDS_PAGE' ? (
                            <button type="button" className="pf-connect" onClick={() => setPageOpen(true)}>
                              Choose Page
                            </button>
                          ) : status === 'NO_LINKED_INSTAGRAM' ? (
                            <div className="pf-row-actions">
                              <button type="button" className="pf-connect" onClick={() => setPageOpen(true)}>
                                Check again
                              </button>
                              <span className="pf-divider" aria-hidden="true" />
                              <button type="button" className="pf-text-btn" onClick={() => handleDisconnect(platform)}>
                                Disconnect
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              className="pf-connect"
                              disabled={!available || notSetUp || connectLocked}
                              aria-label={`${status === 'NEEDS_RECONNECT' ? 'Reconnect' : 'Connect'} ${PLATFORM_LABELS[platform]}`}
                              title={notSetUp ? 'This server has no credentials for this platform yet' : undefined}
                              onClick={() => startConnect(platform)}
                            >
                              {status === 'NEEDS_RECONNECT' ? 'Reconnect' : (<><Plus size={16} aria-hidden="true" />Connect</>)}
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </div>
          </section>

          {/* Sibling keys must differ, or React leaves the old AdAccountsSection mounted on each refresh. */}
          <AdAccountsSection key={`ads-${adRefreshKey}`} onConnected={setPickerProvider} onLoaded={setAdConnections} />
          <AdSpendLimitsSection key={`limits-${adRefreshKey}`} meta={adConnections?.find((c) => c.provider === 'meta') ?? null} />
        </div>
      </div>

      {pageOpen && (
        <PagePickerModal
          onClose={() => {
            setPageOpen(false);
            // The save may have landed after a mid-save cancel — re-read the truth.
            void refresh();
          }}
          onSelected={() => {
            setPageOpen(false);
            void refresh();
            // Back from Meta with the ad account still unchosen: carry on to that picker.
            if (adConnections?.some((c) => c.provider === 'meta' && c.status === 'PENDING_ACCOUNT_SELECTION')) {
              setPickerProvider('meta');
            }
          }}
        />
      )}

      {pickerProvider && (
        <AdAccountPickerModal
          provider={pickerProvider}
          onClose={() => setPickerProvider(null)}
          onSelected={() => {
            setPickerProvider(null);
            // Force AdAccountsSection to remount and refetch so the row flips
            // to ACTIVE without a page reload.
            setAdRefreshKey((k) => k + 1);
          }}
        />
      )}
    </div>
  );
}
