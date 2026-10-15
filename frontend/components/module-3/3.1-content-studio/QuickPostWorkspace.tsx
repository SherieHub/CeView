/**
 * Quick Post — one stage of the Draft -> Attach -> Validate workflow at a
 * time, with clickable progress and Back / Continue at the foot.
 *
 * Purely presentational: ContentStudioView still owns every piece of state
 * (draft, audit, generated content, selection) and passes each stage in as a
 * slot, so moving between stages — or between Content Studio's tabs — never
 * resets anything. Stages that are not current stay mounted, just hidden.
 */
import type { ReactNode } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import StudioStepRail from './StudioStepRail';
import { STUDIO_STEPS } from './studioSteps';
import type { StudioStepId } from './studioSteps';

interface QuickPostWorkspaceProps {
  step: StudioStepId;
  onStepChange: (step: StudioStepId) => void;
  complete: Partial<Record<StudioStepId, boolean>>;
  /** Shown above the stages, e.g. "Drafting a post for campaign X". */
  context?: ReactNode;
  draftStage: ReactNode;
  attachStage: ReactNode;
  validateStage: ReactNode;
}

const STAGE_COPY: Record<StudioStepId, { title: string; sub: string }> = {
  draft: { title: 'Choose your caption', sub: 'Pick a generated option for each platform, then edit it as you like.' },
  attach: { title: 'Add your media', sub: 'Attach the image this post publishes with.' },
  validate: { title: 'Review and publish', sub: 'Check your post against the review criteria before it goes live.' },
};

export default function QuickPostWorkspace({
  step,
  onStepChange,
  complete,
  context,
  draftStage,
  attachStage,
  validateStage,
}: QuickPostWorkspaceProps) {
  const index = STUDIO_STEPS.findIndex((s) => s.id === step);
  const prev = STUDIO_STEPS[index - 1];
  const next = STUDIO_STEPS[index + 1];
  const stages: Record<StudioStepId, ReactNode> = { draft: draftStage, attach: attachStage, validate: validateStage };

  return (
    <div className="qp">
      <div className="qp-intro">
        <div>
          <h2 className="qp-title">Quick Post</h2>
          <p className="qp-sub">Create a single market-ready post, from your own idea or a demand opportunity.</p>
        </div>
        <StudioStepRail active={step} onSelect={onStepChange} complete={complete} />
      </div>

      {context}

      {STUDIO_STEPS.map((s) => (
        <section
          key={s.id}
          id={s.sectionId}
          className="qp-stage"
          aria-labelledby={`${s.sectionId}-title`}
          hidden={s.id !== step}
        >
          <header className="qp-stage-head">
            <span className="qp-stage-no" aria-hidden="true">{s.number}</span>
            <div>
              <h3 id={`${s.sectionId}-title`} className="qp-stage-title">{STAGE_COPY[s.id].title}</h3>
              <p className="qp-stage-sub">{STAGE_COPY[s.id].sub}</p>
            </div>
          </header>
          {stages[s.id]}
        </section>
      ))}

      <div className="qp-foot">
        {prev ? (
          <button type="button" className="btn-outline btn-outline--sm" onClick={() => onStepChange(prev.id)}>
            <ArrowLeft size={15} aria-hidden="true" /> Back to {prev.label}
          </button>
        ) : <span />}
        {next && (
          <button type="button" className="btn-primary btn-primary--sm qp-next" onClick={() => onStepChange(next.id)}>
            Continue to {next.label} <ArrowRight size={15} aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}
