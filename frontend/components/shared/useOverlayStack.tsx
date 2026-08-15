/**
 * Overlay stack — ports the prototype's push/pop/dismissTop semantics
 * (ui-ux-prototype.html:1563–1600) to React state: a scrim is visible
 * whenever the stack is non-empty, and Escape/`dismissTop()` closes only
 * the top-most overlay (modal before drawer before sidebar).
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

export type OverlayKind = 'modal' | 'drawer' | 'sidebar';

interface OverlayStackValue {
  stack: OverlayKind[];
  isOpen: (kind: OverlayKind) => boolean;
  push: (kind: OverlayKind) => void;
  pop: (kind: OverlayKind) => void;
  dismissTop: () => void;
  scrimVisible: boolean;
}

const OverlayStackContext = createContext<OverlayStackValue | null>(null);

export function OverlayStackProvider({ children }: { children: ReactNode }) {
  const [stack, setStack] = useState<OverlayKind[]>([]);

  const push = useCallback((kind: OverlayKind) => {
    setStack((s) => (s.includes(kind) ? s : [...s, kind]));
  }, []);

  const pop = useCallback((kind: OverlayKind) => {
    setStack((s) => s.filter((o) => o !== kind));
  }, []);

  const dismissTop = useCallback(() => {
    setStack((s) => (s.length === 0 ? s : s.slice(0, -1)));
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') dismissTop();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [dismissTop]);

  const value = useMemo<OverlayStackValue>(
    () => ({
      stack,
      isOpen: (kind) => stack.includes(kind),
      push,
      pop,
      dismissTop,
      scrimVisible: stack.length > 0,
    }),
    [stack, push, pop, dismissTop]
  );

  return <OverlayStackContext.Provider value={value}>{children}</OverlayStackContext.Provider>;
}

export function useOverlayStack(): OverlayStackValue {
  const ctx = useContext(OverlayStackContext);
  if (!ctx) throw new Error('useOverlayStack must be used within an OverlayStackProvider');
  return ctx;
}
