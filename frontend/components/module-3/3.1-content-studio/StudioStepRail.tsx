/**
 * Draft -> Attach -> Validate progress for the Quick Post workspace.
 *
 * Two modes:
 *  - Controlled (`active` + `onSelect`): each step is a button that switches
 *    the workspace to that stage. Quick Post uses this — one stage shows at a
 *    time, and every stage stays reachable without losing what was entered.
 *  - Uncontrolled (no props): the original scroll-tracking rail, with anchor
 *    links and useStepProgress following the most visible section.
 */
import { STUDIO_STEPS } from './studioSteps';
import type { StudioStepId } from './studioSteps';
import { useStepProgress } from './useStepProgress';

interface StudioStepRailProps {
  active?: StudioStepId;
  onSelect?: (step: StudioStepId) => void;
  /** Steps that have what they need (shown with a tick). */
  complete?: Partial<Record<StudioStepId, boolean>>;
}

export default function StudioStepRail({ active, onSelect, complete }: StudioStepRailProps = {}) {
  const tracked = useStepProgress();
  const controlled = active !== undefined && onSelect !== undefined;
  const current = controlled ? active : tracked;
  const activeIndex = STUDIO_STEPS.findIndex((s) => s.id === current);

  return (
    <nav className="step-rail" aria-label="Studio progress">
      <ol>
        {STUDIO_STEPS.map((step, index) => {
          const state = controlled
            ? step.id === current
              ? 'current'
              : complete?.[step.id]
                ? 'done'
                : 'todo'
            : index < activeIndex
              ? 'done'
              : index === activeIndex
                ? 'current'
                : 'todo';
          const content = (
            <>
              <span className="step-rail-no" aria-hidden="true">{step.number}</span>
              <span className="step-rail-copy"><span className="step-rail-label">{step.label}</span><span className="step-rail-description">{step.id === 'draft' ? 'Choose and edit your caption' : step.id === 'attach' ? 'Add media, links and details' : 'Review and prepare to publish'}</span></span>
            </>
          );
          return (
            <li key={step.id}>
              {controlled ? (
                <button
                  type="button"
                  aria-label={step.label}
                  data-state={state}
                  aria-current={state === 'current' ? 'step' : undefined}
                  onClick={() => onSelect(step.id)}
                >
                  {content}
                </button>
              ) : (
                <a
                  href={`#${step.sectionId}`}
                  data-state={state}
                  aria-current={state === 'current' ? 'step' : undefined}
                >
                  {content}
                </a>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
