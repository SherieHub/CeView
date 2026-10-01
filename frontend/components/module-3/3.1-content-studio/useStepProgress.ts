/**
 * Scroll-spy for the step rail: reports which studio section currently owns
 * the viewport.
 *
 * IntersectionObserver rather than a scroll listener — a scroll handler would
 * run on every frame and still need getBoundingClientRect per section, which
 * is exactly the layout thrash the observer exists to avoid.
 *
 * `rootMargin` biases the "active" band to the upper third of the viewport:
 * without it the last section can never win, because a short final section is
 * never the most-visible one on screen.
 */
import { useEffect, useState } from 'react';
import { STUDIO_STEPS } from './studioSteps';
import type { StudioStep } from './studioSteps';

export function useStepProgress(): StudioStep['id'] {
  const [active, setActive] = useState<StudioStep['id']>(STUDIO_STEPS[0].id);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;

    const nodes = STUDIO_STEPS
      .map((step) => ({ step, el: document.getElementById(step.sectionId) }))
      .filter((entry): entry is { step: StudioStep; el: HTMLElement } => entry.el != null);

    if (nodes.length === 0) return;

    const ratios = new Map<string, number>();

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          ratios.set((entry.target as HTMLElement).id, entry.isIntersecting ? entry.intersectionRatio : 0);
        });

        // A plain for...of (rather than forEach mutating two outer
        // variables) so TS can narrow bestId to non-null right where it's
        // assigned instead of losing that fact by the time it's read below.
        let bestId: StudioStep['id'] | null = null;
        let bestRatio = 0;
        for (const { step } of nodes) {
          const ratio = ratios.get(step.sectionId) ?? 0;
          if (ratio > bestRatio) {
            bestRatio = ratio;
            bestId = step.id;
          }
        }
        if (bestId) setActive(bestId);
      },
      { rootMargin: '-10% 0px -55% 0px', threshold: [0, 0.25, 0.5, 0.75, 1] },
    );

    nodes.forEach(({ el }) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return active;
}
