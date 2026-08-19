/**
 * Empty screen-shell placeholder for a route whose real screen hasn't
 * landed yet (later cards in 02-module-1.md … 05-module-4.md redistribute
 * these). Renders the NAV entry's title/sub so the shell is verifiably
 * wired end-to-end even before any screen exists.
 */
import { navItemById } from './nav';
import type { NavId } from './nav';
import Drawer from '../components/shared/Drawer';
import Modal from '../components/shared/Modal';
import { useOverlayStack } from '../components/shared/useOverlayStack';

interface RoutePlaceholderProps {
  navId?: NavId;
  title?: string;
  sub?: string;
}

export default function RoutePlaceholder({ navId, title, sub }: RoutePlaceholderProps) {
  const nav = navId ? navItemById(navId) : undefined;
  return (
    <div className="empty flex h-full flex-col items-center justify-center gap-1 text-center">
      <h2 className="h-lg">{title ?? nav?.title ?? 'Coming soon'}</h2>
      <p className="body-sm">{sub ?? nav?.sub ?? 'This screen has not been built yet.'}</p>
      {/* Foundation — Shell & Routing overlay-stack e2e coverage (login.spec.ts).
          Exercises the shared Drawer/Modal/scrim stack generically since no real
          screen exists yet to host it; relocate/remove once the real Dashboard
          card (03-module-2.md) lands. */}
      {navId === 'dashboard' && <OverlayStackTestScaffold />}
    </div>
  );
}

function OverlayStackTestScaffold() {
  // Open state is derived from the shared overlay stack itself (isOpen),
  // rather than tracked separately — Drawer/Modal push/pop themselves onto
  // that stack, but only sync one-way (prop -> stack) via their own effect,
  // so anything that mutates the stack from outside (Escape -> dismissTop)
  // wouldn't be reflected back into a separately-tracked local `open` state.
  const { isOpen, push, pop } = useOverlayStack();

  return (
    <>
      <button
        type="button"
        data-testid="test-open-drawer"
        onClick={() => push('drawer')}
        className="body-xs mt-4 rounded border border-line px-2 py-1 text-muted"
      >
        Open test drawer
      </button>
      <Drawer open={isOpen('drawer')} onClose={() => pop('drawer')}>
        <button
          type="button"
          data-testid="test-open-modal-from-drawer"
          onClick={() => push('modal')}
          className="body-xs mt-4 rounded border border-line px-2 py-1 text-muted"
        >
          Open test modal
        </button>
      </Drawer>
      <Modal open={isOpen('modal')} onClose={() => pop('modal')}>
        <p className="body-sm">Test modal</p>
      </Modal>
    </>
  );
}
