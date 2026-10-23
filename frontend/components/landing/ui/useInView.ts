/**
 * True once the element has scrolled into view (and stays true). With reduced
 * motion, or without IntersectionObserver, it is true from the start, so
 * entrance animations simply don't run.
 */
import { useEffect, useRef, useState, type RefObject } from 'react';

function startsInView(): boolean {
  if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') return true;
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

export default function useInView<T extends Element>(threshold = 0.3): [RefObject<T | null>, boolean] {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(startsInView);

  useEffect(() => {
    if (inView) return;
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [inView, threshold]);

  return [ref, inView];
}
