import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useOverlayStackContext } from './useOverlayStack';

/**
 * Ported from ui-ux-prototype.html's #modal / .modal / openModal()/closeModal()
 * (primitives.css `.modal`, overlay semantics at ui-ux-prototype.html:1573-1583).
 * Registers itself with the shared overlay stack ('modal' kind) while open, so
 * the scrim and Escape/dismissTop behavior stay in sync with any Drawer open
 * at the same time.
 */
export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({ open, onClose, title, children, footer }) => {
  const { push, pop, isOpen } = useOverlayStackContext();

  useEffect(() => {
    if (!open) return;
    push('modal');
    return () => pop('modal');
  }, [open, push, pop]);

  // Escape (dismissTop) pops 'modal' out of the shared stack directly; when
  // that happens while the caller still thinks it's open, tell it to close.
  const stillInStack = isOpen('modal');
  useEffect(() => {
    if (open && !stillInStack) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, stillInStack]);

  if (!open) return null;

  return createPortal(
    <div className="modal on" role="dialog" aria-modal="true" aria-label={title}>
      <div className="modal-head">
        {title && <h3 className="h-md">{title}</h3>}
        <button type="button" className="x-btn" aria-label="Close" onClick={() => pop('modal')}>
          <X />
        </button>
      </div>
      <div className="modal-body">{children}</div>
      {footer && <div className="modal-foot">{footer}</div>}
    </div>,
    document.body,
  );
};

export default Modal;
