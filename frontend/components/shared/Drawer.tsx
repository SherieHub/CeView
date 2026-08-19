/**
 * Side drawer overlay (used by the Market Radar drawer, card 13/14) — pushes
 * itself onto the shared overlay stack under any modal opened above it.
 */
import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { useOverlayStack } from './useOverlayStack';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

export default function Drawer({ open, onClose, children }: DrawerProps) {
  const { push, pop } = useOverlayStack();

  useEffect(() => {
    if (open) push('drawer');
    else pop('drawer');
    return () => pop('drawer');
  }, [open, push, pop]);

  return (
    <div
      className={`drawer fixed inset-y-0 right-0 z-30 w-full max-w-md translate-x-full bg-panel shadow-3 transition-transform data-[open=true]:translate-x-0 ${open ? 'on' : ''}`}
      data-open={open}
      aria-hidden={!open}
    >
      <button onClick={onClose} aria-label="Close" className="absolute right-4 top-4 rounded-full p-1 hover:bg-panel-sunk">
        <X size={18} />
      </button>
      <div className="h-full overflow-y-auto p-6">{children}</div>
    </div>
  );
}
