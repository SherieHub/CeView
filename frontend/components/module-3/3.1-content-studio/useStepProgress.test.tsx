import { render, screen, act } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useStepProgress } from './useStepProgress';
import { STUDIO_STEPS } from './studioSteps';

// jsdom has no IntersectionObserver. Capture the callback so the test can
// drive intersection directly — this is the only way to assert scroll-spy
// behaviour without a real layout engine.
let trigger: (entries: Partial<IntersectionObserverEntry>[]) => void;

beforeEach(() => {
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(cb: (e: IntersectionObserverEntry[]) => void) {
        trigger = (entries) => cb(entries as IntersectionObserverEntry[]);
      }
      observe() {}
      disconnect() {}
      unobserve() {}
    },
  );
});

function Probe() {
  const active = useStepProgress();
  return <span data-testid="active">{active}</span>;
}

describe('useStepProgress', () => {
  it('starts on the first step and follows the most-visible section', () => {
    STUDIO_STEPS.forEach((s) => {
      const el = document.createElement('section');
      el.id = s.sectionId;
      document.body.appendChild(el);
    });

    render(<Probe />);
    expect(screen.getByTestId('active')).toHaveTextContent('draft');

    act(() => {
      trigger([
        { target: document.getElementById('studio-step-draft')!, isIntersecting: false, intersectionRatio: 0 },
        { target: document.getElementById('studio-step-attach')!, isIntersecting: true, intersectionRatio: 0.9 },
      ]);
    });
    expect(screen.getByTestId('active')).toHaveTextContent('attach');
  });
});
