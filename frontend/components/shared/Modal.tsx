/**
 * Modal overlay — pushes/pops itself onto the shared overlay stack so
 * dismissTop() (Escape) closes it before any drawer beneath it.
 *
 * Two shapes. 'panel' is the default centred card with its own title row and
 * close button. 'full' is an edge-to-edge surface that owns ALL of its own
 * chrome, because a full-screen modal's header carries content of its own —
 * the publishing modal puts platform tabs up there — and a generic title row
 * bolted above it would be a second, competing header.
 */
import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { useOverlayStack } from './useOverlayStack';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  /** 'full' is an edge-to-edge surface that owns its own header. */
  variant?: 'panel' | 'full';
  /** Names the dialog when it has no visible `title`. */
  label?: string;
  children: ReactNode;
}

export default function Modal({ open, onClose, title, variant = 'panel', label, children }: ModalProps) {
  const { push, pop, isOpen } = useOverlayStack();

  useEffect(() => {
    if (open) push('modal');
    else pop('modal');
    return () => pop('modal');
  }, [open, push, pop]);

  if (!open) return null;

  return (
    <div
      className="modal on fixed inset-0 z-40 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={label ?? title}
      data-open={isOpen('modal')}
    >
      <div className={`modal-panel ${variant === 'full' ? 'modal-panel--full' : ''}`}>
        {variant === 'panel' && (
          <div className="mb-4 flex items-center justify-between">
            {title && <h2 className="heading-md">{title}</h2>}
            <button type="button" onClick={onClose} aria-label="Close" className="icon-btn">
              <X size={18} aria-hidden="true" />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
