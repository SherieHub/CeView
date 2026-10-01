import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useOverlayStackContext } from './useOverlayStack';

/**
 * Ported from ui-ux-prototype.html's #radar-drawer / .drawer / openDrawer()/
 * closeDrawer() (primitives.css `.drawer`, overlay semantics at
 * ui-ux-prototype.html:1584-1595). Registers itself with the shared overlay
 * stack ('drawer' kind) while open.
 */
export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
}

const Drawer: React.FC<DrawerProps> = ({ open, onClose, title, subtitle, children }) => {
  const { push, pop, isOpen } = useOverlayStackContext();

  useEffect(() => {
    if (!open) return;
    push('drawer');
    return () => pop('drawer');
  }, [open, push, pop]);

  const stillInStack = isOpen('drawer');
  useEffect(() => {
    if (open && !stillInStack) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, stillInStack]);

  if (!open) return null;

  return createPortal(
    <div className="drawer on" role="dialog" aria-modal="true" aria-label={title} aria-hidden="false">
      <div className="drawer-head">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div>
            {title && <h3 className="h-md">{title}</h3>}
            {subtitle && <p className="body-sm">{subtitle}</p>}
          </div>
          <button type="button" className="x-btn" aria-label="Close" onClick={() => pop('drawer')}>
            <X />
          </button>
        </div>
      </div>
      <div className="drawer-body">{children}</div>
    </div>,
    document.body,
  );
};

export default Drawer;
