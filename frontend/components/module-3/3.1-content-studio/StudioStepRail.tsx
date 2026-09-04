/**
 * The floating numbered progress indicators in the left margin.
 *
 * Anchors, not buttons: each step IS a place in the document, so the browser's
 * own fragment navigation (plus scroll-margin-top on .studio-section) does the
 * scrolling, and the steps are reachable and announced as links.
 */
import { STUDIO_STEPS } from './studioSteps';
import { useStepProgress } from './useStepProgress';

export default function StudioStepRail() {
  const active = useStepProgress();
  const activeIndex = STUDIO_STEPS.findIndex((s) => s.id === active);

  return (
    <nav className="step-rail" aria-label="Studio progress">
      <ol>
        {STUDIO_STEPS.map((step, index) => {
          const state = index < activeIndex ? 'done' : index === activeIndex ? 'current' : 'todo';
          return (
            <li key={step.id}>
              <a
                href={`#${step.sectionId}`}
                data-state={state}
                aria-current={state === 'current' ? 'step' : undefined}
              >
                <span className="step-rail-no" aria-hidden="true">{step.number}</span>
                <span className="step-rail-label">{step.label}</span>
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
