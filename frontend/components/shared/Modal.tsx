/**
 * Modal overlay — pushes/pops itself onto the shared overlay stack so
 * dismissTop() (Escape) closes it before any drawer beneath it.
 */
import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { useOverlayStack } from './useOverlayStack';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

export default function Modal({ open, onClose, title, children }: ModalProps) {
  const { push, pop, isOpen } = useOverlayStack();
  const inStack = isOpen('modal');
  const wasInStack = useRef(false);

  useEffect(() => {
    if (open) push('modal');
    else pop('modal');
    return () => pop('modal');
  }, [open, push, pop]);

  // The stack only synced one way: this pushed itself on open, but Escape and
  // the scrim call dismissTop(), which pops the stack and nothing else. An
  // owner whose `open` never itself flips false in response — e.g. it's a
  // static `true` and the owner instead relies on `onClose` to unmount this
  // component entirely (PostAnalyticsModal) — never heard about it, so Escape
  // did nothing. Mirror the pop back to the owner. Ported verbatim from
  // Drawer.tsx, which carries this same fix for the same reason.
  //
  // `wasInStack` exists because `inStack` is false for the render between
  // `open` flipping true and the push landing; without it, that render looks
  // identical to a dismissal and would close the modal as it opened.
  useEffect(() => {
    if (inStack) {
      // From here on, leaving the stack means something dismissed us.
      wasInStack.current = true;
    } else if (!open) {
      // Closed by the owner instead — its own control. Stack and owner
      // already agree, so there is nothing to mirror.
      wasInStack.current = false;
    } else if (wasInStack.current) {
      // Popped while still open: Escape, or the scrim.
      wasInStack.current = false;
      onClose();
    }
  }, [inStack, open, onClose]);

  if (!open) return null;

  return (
    <div
      className="modal on fixed inset-0 z-40 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      data-open={isOpen('modal')}
    >
      <div className="modal-panel">
        <div className="mb-4 flex items-center justify-between">
          {title && <h2 className="heading-md">{title}</h2>}
          <button type="button" onClick={onClose} aria-label="Close" className="icon-btn">
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
