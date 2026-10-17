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
 * Connect is a two-step modal (redirecting -> scope grant) per the screen doc.
 * The doc is explicit that this is UI scaffolding with no real OAuth
 * round-trip yet — production wiring is a backend concern
 * (docs/module-3/backend/PlatformConnectionController.md).
 */
import { useEffect, useState } from 'react';
import {
  BarChart3, ChevronRight, Eye, FileEdit, Layers, Plus, Send, Share2, ShieldCheck, Zap,
} from 'lucide-react';
import type { ReactNode } from 'react';
import Modal from '../shared/Modal';
import { useToast } from '../shared/Toast';
import { useConnections } from '../../services/connectionsStore';
import AdAccountsSection from './AdAccountsSection';
import AdAccountPickerModal from './AdAccountPickerModal';
import { PlatformLogo } from './PlatformLogo';
import type { AdConnection, AdProvider, PlatformId } from '../../types';
import './platforms.css';

const PLATFORM_LABELS: Record<PlatformId, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  facebook: 'Facebook',
};

const SCOPES = [
  { icon: FileEdit, label: 'Read page and profile metadata' },
  { icon: ShieldCheck, label: 'Publish posts on your behalf' },
  { icon: Eye, label: 'Read post insights' },
];

// Fake OAuth-redirect latency, matching the prototype's own timing
// (ui-ux-prototype.html connectPlatform ~1.3s) — replaced by a real redirect
// once the backend OAuth flow (PlatformConnectionController) exists.
const REDIRECT_DELAY_MS = 1300;

type ModalStep = 'redirecting' | 'scope' | null;

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
};

export default function PlatformsSettings() {
  const { connections, available, isConnected, connect, disconnect } = useConnections();
  const { showToast } = useToast();

  const [connectingPlatform, setConnectingPlatform] = useState<PlatformId | null>(null);
  const [modalStep, setModalStep] = useState<ModalStep>(null);

  /**
   * The provider whose account picker is open. Set either by returning from the
   * OAuth redirect (?adconnect=meta) or by the row's "Choose ad account" button.
   */
  const [pickerProvider, setPickerProvider] = useState<AdProvider | null>(null);
  const [adRefreshKey, setAdRefreshKey] = useState(0);
  // Reported up by AdAccountsSection, for the summary on the left.
  const [adConnections, setAdConnections] = useState<AdConnection[] | null>(null);

  // The backend's callback redirects here with ?adconnect=<provider> on success
  // or ?adconnect_error=<code> on failure. Read them once, then strip them so a
  // refresh doesn't reopen the picker.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get('adconnect');
    const failed = params.get('adconnect_error');

    if (connected === 'meta' || connected === 'tiktok') {
      setPickerProvider(connected);
    } else if (failed) {
      showToast(
        AD_CONNECT_ERROR_MESSAGES[failed] ?? 'Could not complete the connection. Try again.',
      );
    }

    if (connected || failed) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [showToast]);

  function startConnect(platform: PlatformId) {
    setConnectingPlatform(platform);
    setModalStep('redirecting');
  }

  useEffect(() => {
    if (modalStep !== 'redirecting') return;
    const timer = setTimeout(() => setModalStep('scope'), REDIRECT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [modalStep]);

  function closeModal() {
    setModalStep(null);
    setConnectingPlatform(null);
  }

  async function grantScope() {
    if (!connectingPlatform) return;
    const platform = connectingPlatform;
    // No real OAuth round-trip yet (see header comment) — there is no handle
    // to read back, so the connection shows as verified without one.
    await connect(platform, '');
    closeModal();
    showToast(`Connected to ${PLATFORM_LABELS[platform]}`);
  }

  async function handleDisconnect(platform: PlatformId) {
    await disconnect(platform);
    showToast(`Disconnected from ${PLATFORM_LABELS[platform]}`);
  }

  const platforms = Object.keys(PLATFORM_LABELS) as PlatformId[];
  const connectedCount = platforms.filter((p) => isConnected(p)).length;
  const adActive = adConnections?.filter((c) => c.status === 'ACTIVE').length ?? 0;

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
              {connections === null ? 'Checking your platforms…' : `${connectedCount} of ${platforms.length} platforms connected`}
            </p>
            <div className="pf-bar" aria-hidden="true">
              <i style={{ width: `${(connectedCount / platforms.length) * 100}%` }} />
            </div>
            <StatusTile
              href="#pf-ads"
              icon={<Layers size={20} />}
              value={adConnections ? `${adActive} of ${adConnections.length}` : '—'}
              label="Ad accounts connected"
            />
            <StatusTile
              href="#pf-publishing"
              icon={<Share2 size={20} />}
              value={`${connectedCount} of ${platforms.length}`}
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
                      const connected = isConnected(platform);
                      const handle = connections.find((c) => c.platform === platform)?.handle;
                      return (
                        <li key={platform} className="pf-row">
                          <PlatformLogo platform={platform} />
                          <div className="pf-row-text">
                            <p className="pf-row-name">{PLATFORM_LABELS[platform]}</p>
                            <p className="pf-row-sub">{connected ? handle || 'Connected' : 'Not connected'}</p>
                          </div>
                          {connected ? (
                            <div className="pf-row-actions">
                              <span className="pf-pill">Verified</span>
                              <span className="pf-divider" aria-hidden="true" />
                              <button type="button" className="pf-text-btn" onClick={() => handleDisconnect(platform)}>
                                Disconnect
                              </button>
                            </div>
                          ) : (
                            <button type="button" className="pf-connect" disabled={!available} onClick={() => startConnect(platform)}>
                              <Plus size={16} aria-hidden="true" />Connect
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

          <AdAccountsSection key={adRefreshKey} onConnected={setPickerProvider} onLoaded={setAdConnections} />
        </div>
      </div>

      <Modal
        open={modalStep != null}
        onClose={closeModal}
        title={connectingPlatform ? `Connect ${PLATFORM_LABELS[connectingPlatform]}` : undefined}
      >
        {modalStep === 'redirecting' && (
          <div className="flex flex-col items-center gap-3 py-6 text-center" role="status">
            <span className="spinner" aria-hidden="true" />
            <p className="body-sm">
              Redirecting to {connectingPlatform && PLATFORM_LABELS[connectingPlatform]}… Establishing
              a secure authorization session.
            </p>
          </div>
        )}

        {modalStep === 'scope' && (
          <div>
            <p className="body-sm mb-4">This app is requesting permission to:</p>
            <ul className="mb-5 flex flex-col gap-3">
              {SCOPES.map(({ icon: Icon, label }) => (
                <li key={label} className="flex items-center gap-2 body-sm">
                  <Icon size={16} aria-hidden="true" /> {label}
                </li>
              ))}
            </ul>
            <div className="flex justify-end gap-3">
              <button type="button" className="btn-outline" onClick={closeModal}>
                Cancel
              </button>
              <button type="button" className="btn-primary" onClick={grantScope}>
                Grant scope
              </button>
            </div>
          </div>
        )}
      </Modal>

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
