/**
 * Side drawer overlay — used by the Market Radar drawer (03-module-2.md,
 * cards M2-F/M2-4/M2-5). Pushes itself onto the shared overlay stack so
 * dismissTop() (Escape) closes it, and any modal opened above it closes first.
 *
 * Surface is the brand card treatment rather than the legacy panel tokens this
 * used to carry (bg-panel / shadow-3 / bg-panel-sunk), so it does not clash
 * with the branded screen behind it.
 */
import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { useOverlayStack } from './useOverlayStack';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  /** Names the dialog for assistive tech — usually the drawer's own heading. */
  label?: string;
  /**
   * Pinned below the scrolling body. For a primary action that must stay
   * reachable however far down the content the reader has gone.
   */
  footer?: ReactNode;
  children: ReactNode;
}

export default function Drawer({ open, onClose, label, footer, children }: DrawerProps) {
  const { push, pop, isOpen } = useOverlayStack();
  const inStack = isOpen('drawer');
  const wasInStack = useRef(false);

  useEffect(() => {
    if (open) push('drawer');
    else pop('drawer');
    return () => pop('drawer');
  }, [open, push, pop]);

  // The stack only synced one way: this pushed itself on open, but Escape and
  // the scrim call dismissTop(), which pops the stack and nothing else. An
  // owner whose `open` comes from elsewhere — the radar drawer reads it from
  // ?market= — never heard about it, so Escape did nothing. Mirror the pop back
  // to the owner.
  //
  // `wasInStack` exists because `inStack` is false for the render between
  // `open` flipping true and the push landing; without it, that render looks
  // identical to a dismissal and would slam the drawer shut as it opened.
  useEffect(() => {
    if (inStack) {
      // From here on, leaving the stack means something dismissed us.
      wasInStack.current = true;
    } else if (!open) {
      // Closed by the owner instead — its own control, or a route change.
      // Stack and owner already agree, so there is nothing to mirror. Clearing
      // the flag is the whole point: leaving it set made the next open read
      // its own pre-push render as a dismissal and close itself immediately,
      // so the drawer could never be reopened after the X was used. Escape hid
      // this by clearing the flag on its way through the branch below.
      wasInStack.current = false;
    } else if (wasInStack.current) {
      // Popped while still open: Escape, or the scrim.
      wasInStack.current = false;
      onClose();
    }
  }, [inStack, open, onClose]);

  return (
    <div
      className={`drawer ${open ? 'on' : ''}`}
      data-open={open}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      aria-hidden={!open}
    >
      <button type="button" onClick={onClose} aria-label="Close" className="drawer-close icon-btn">
        <X size={18} aria-hidden="true" />
      </button>
      <div className="drawer-body">{children}</div>
      {footer && <div className="drawer-foot">{footer}</div>}
    </div>
  );
}
