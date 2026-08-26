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

  /**
   * Lock the page behind any open overlay. Without this the drawer and the page
   * scroll independently, showing two scrollbars side by side, and a wheel
   * gesture past the end of the drawer scrolls the page underneath it.
   *
   * Lives here rather than in Drawer/Modal so nested overlays cannot fight over
   * it — the lock follows "is anything open", and the last one to close
   * restores the page.
   *
   * Removing the scrollbar frees its width, so the layout would jump right by
   * ~15px as the overlay opens. Padding the body by the width that vanished
   * holds everything still. Guarded on the scrollbar actually taking up space:
   * it is zero on overlay-scrollbar platforms (macOS, mobile), where padding
   * would itself be the jump.
   */
  useEffect(() => {
    if (stack.length === 0) return;

    const { body } = document;
    const gutter = window.innerWidth - document.documentElement.clientWidth;
    const prevOverflow = body.style.overflow;
    const prevPadding = body.style.paddingRight;

    body.style.overflow = 'hidden';
    if (gutter > 0) body.style.paddingRight = `${gutter}px`;

    return () => {
      body.style.overflow = prevOverflow;
      body.style.paddingRight = prevPadding;
    };
  }, [stack.length]);

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
