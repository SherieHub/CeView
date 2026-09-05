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
import { CheckCircle2, Circle, Eye, FileEdit, ShieldCheck } from 'lucide-react';
import Modal from '../shared/Modal';
import { useToast } from '../shared/Toast';
import { useConnections } from '../../services/connectionsStore';
import type { PlatformId } from '../../types';

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

export default function PlatformsSettings() {
  const { connections, isConnected, connect, disconnect } = useConnections();
  const { showToast } = useToast();

  const [connectingPlatform, setConnectingPlatform] = useState<PlatformId | null>(null);
  const [modalStep, setModalStep] = useState<ModalStep>(null);

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

  if (connections === null) {
    return (
      <div className="card p-6">
        <div className="flex flex-col gap-3" aria-hidden="true">
          <div className="skel" style={{ height: 64 }} />
          <div className="skel" style={{ height: 64 }} />
          <div className="skel" style={{ height: 64 }} />
        </div>
      </div>
    );
  }

  return (
    <div className="card p-6">
      <h2 className="heading-lg mb-1">Connected platforms</h2>
      <p className="body-sm mb-5">
        Connection state here gates which platforms Content Studio can publish to.
      </p>

      <div className="flex flex-col gap-3">
        {(Object.keys(PLATFORM_LABELS) as PlatformId[]).map((platform) => {
          const connected = isConnected(platform);
          const handle = connections.find((c) => c.platform === platform)?.handle;
          return (
            <div
              key={platform}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--color-gray-light)] p-4"
            >
              <div className="flex items-center gap-3">
                {connected ? (
                  <CheckCircle2 className="text-[var(--color-mint-primary)]" aria-hidden="true" />
                ) : (
                  <Circle className="text-[var(--color-text-muted)]" aria-hidden="true" />
                )}
                <div>
                  <p className="font-semibold text-navy-dark">{PLATFORM_LABELS[platform]}</p>
                  <p className="body-xs text-[var(--color-text-muted)]">
                    {connected ? handle || 'Connected' : 'Not connected'}
                  </p>
                </div>
              </div>

              {connected ? (
                <div className="flex items-center gap-3">
                  <span className="badge badge--teal">Verified</span>
                  <button
                    type="button"
                    className="btn-outline--sm"
                    onClick={() => handleDisconnect(platform)}
                  >
                    Disconnect
                  </button>
                </div>
              ) : (
                <button type="button" className="btn-primary" onClick={() => startConnect(platform)}>
                  Connect
                </button>
              )}
            </div>
          );
        })}
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
    </div>
  );
}
