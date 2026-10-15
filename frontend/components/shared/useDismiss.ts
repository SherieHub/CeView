/**
 * Closes a popup (menu, popover) on a click outside `ref` or on Escape.
 * Escape also returns focus to `returnFocus`, the control that opened it.
 */
import { useEffect } from 'react';
import type { RefObject } from 'react';

export function useDismiss(
  ref: RefObject<HTMLElement | null>,
  open: boolean,
  close: () => void,
  returnFocus?: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    if (!open) return;
    function onPointer(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      close();
      returnFocus?.current?.focus();
    }
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [ref, open, close, returnFocus]);
}
