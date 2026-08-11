import React, { useState } from 'react';
import { NAV_ITEMS } from './nav';
import Drawer from '../components/shared/Drawer';
import Modal from '../components/shared/Modal';
import { useToast } from '../components/shared/Toast';

interface RoutePlaceholderProps {
  /** NAV item id (see layout/nav.ts). 'onboarding' has no NAV entry — pass title/sub directly. */
  navId?: string;
  title?: string;
  sub?: string;
}

/**
 * Minimal empty screen shell for a route whose real content ships in a
 * later card (see 01-foundation.md's scope boundary). Renders the route's
 * title/subtitle from the shared NAV table so the milestone's "every route
 * renders an empty screen shell with correct topbar title" holds even
 * before the real screen exists.
 */
const RoutePlaceholder: React.FC<RoutePlaceholderProps> = ({ navId, title, sub }) => {
  const navItem = navId ? NAV_ITEMS.find(i => i.id === navId) : undefined;
  const resolvedTitle = title ?? navItem?.title ?? navId ?? 'Screen';
  const resolvedSub = sub ?? navItem?.sub;

  return (
    <div className="screen on">
      <div className="page-head">
        <h2>{resolvedTitle}</h2>
        {resolvedSub && <p>{resolvedSub}</p>}
      </div>
      <div className="empty">
        <div className="empty-glyph" />
        <h3>Coming soon</h3>
        <p>This screen is built in a later card of the UI/UX overhaul plan.</p>
      </div>
      {navId === 'dashboard' && <OverlayStackVerification />}
    </div>
  );
};

/**
 * Foundation-card verification affordance: exercises the shared
 * Drawer/Modal/Toast overlay infrastructure end to end (push/pop stacking,
 * scrim, Escape-closes-only-the-top) ahead of the real Dashboard screen
 * that later cards build. Safe to remove once that screen ships real
 * drawer/modal usage of its own.
 */
const OverlayStackVerification: React.FC = () => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const { showToast } = useToast();

  return (
    <div className="card card-pad" style={{ marginTop: 'var(--sp-6)' }}>
      <p className="eyebrow">Foundation check</p>
      <p className="body-sm" style={{ marginTop: 6 }}>Overlay stack verification (drawer, modal, toast).</p>
      <div style={{ display: 'flex', gap: 10, marginTop: 'var(--sp-4)' }}>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          data-testid="test-open-drawer"
          onClick={() => setDrawerOpen(true)}
        >
          Open test drawer
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          data-testid="test-open-modal"
          onClick={() => setModalOpen(true)}
        >
          Open test modal
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          data-testid="test-show-toast"
          onClick={() => showToast('Toast fired')}
        >
          Show test toast
        </button>
      </div>

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Test drawer" subtitle="Foundation overlay check">
        <p className="body-sm">This drawer is part of the shared overlay stack. Opening the test modal below stacks it on top; the first Escape closes only the modal.</p>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          data-testid="test-open-modal-from-drawer"
          onClick={() => setModalOpen(true)}
        >
          Open test modal over this drawer
        </button>
      </Drawer>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Test modal">
        <p className="body-sm">Press Escape — this modal should close first, leaving the drawer (if open) behind it.</p>
      </Modal>
    </div>
  );
};

export default RoutePlaceholder;
