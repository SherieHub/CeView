/**
 * Modal overlay — pushes/pops itself onto the shared overlay stack so
 * dismissTop() (Escape) closes it before any drawer beneath it.
 */
import { useEffect } from 'react';
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
      data-open={isOpen('modal')}
    >
      <div className="w-full max-w-lg rounded-lg bg-panel p-6 shadow-3">
        <div className="mb-4 flex items-center justify-between">
          {title && <h2 className="heading-md">{title}</h2>}
          <button onClick={onClose} aria-label="Close" className="rounded-full p-1 hover:bg-panel-sunk">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
