import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

/**
 * React port of the prototype's overlay stack semantics
 * (ui-ux-prototype.html:1565-1613: overlayStack / syncScrim / dismissTop /
 * openModal / closeModal / openDrawer / closeDrawer).
 *
 * The stack tracks which overlay *kinds* are currently open, in push order.
 * A kind can only appear once. The scrim is visible whenever the stack is
 * non-empty. `dismissTop` (wired to the Escape key by callers) closes only
 * the most-recently-pushed overlay, leaving anything underneath it open —
 * e.g. drawer open, then modal opened over it: first Escape closes the
 * modal only, second Escape closes the drawer.
 */
export type OverlayKind = 'modal' | 'drawer' | 'toast' | (string & {});

export interface OverlayStack {
  stack: OverlayKind[];
  isScrimVisible: boolean;
  push: (kind: OverlayKind) => void;
  pop: (kind: OverlayKind) => void;
  dismissTop: () => void;
  isOpen: (kind: OverlayKind) => boolean;
}

export function useOverlayStack(): OverlayStack {
  const [stack, setStack] = useState<OverlayKind[]>([]);

  const push = useCallback((kind: OverlayKind) => {
    setStack(prev => (prev.includes(kind) ? prev : [...prev, kind]));
  }, []);

  const pop = useCallback((kind: OverlayKind) => {
    setStack(prev => prev.filter(o => o !== kind));
  }, []);

  const dismissTop = useCallback(() => {
    setStack(prev => (prev.length === 0 ? prev : prev.slice(0, -1)));
  }, []);

  const isOpen = useCallback((kind: OverlayKind) => stack.includes(kind), [stack]);

  const isScrimVisible = stack.length > 0;

  return useMemo(
    () => ({ stack, isScrimVisible, push, pop, dismissTop, isOpen }),
    [stack, isScrimVisible, push, pop, dismissTop, isOpen],
  );
}

/**
 * App-wide overlay stack context — one instance shared by every Modal/Drawer
 * so they all push/pop the same stack and a single Escape listener (wired
 * here) always dismisses only the top-most overlay, matching
 * ui-ux-prototype.html:1604 (`document.addEventListener('keydown', ...)`).
 */
const OverlayStackContext = createContext<OverlayStack | undefined>(undefined);

export const OverlayStackProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const overlay = useOverlayStack();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') overlay.dismissTop();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [overlay.dismissTop]);

  return (
    <OverlayStackContext.Provider value={overlay}>
      {children}
    </OverlayStackContext.Provider>
  );
};

export function useOverlayStackContext(): OverlayStack {
  const ctx = useContext(OverlayStackContext);
  if (!ctx) {
    throw new Error('useOverlayStackContext must be used within an OverlayStackProvider');
  }
  return ctx;
}
