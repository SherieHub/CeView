/**
 * CARD — Onboarding: Wizard Shell & Step 1 Basic Info (shell portion)
 * Prototype reference: #view-onboarding / obRender() — ui-ux-prototype.html:962–996, 1928–1960
 * Plan: docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/02-module-1.md
 *
 * The 5-step wizard shell: side step rail, progress bar, active step panel,
 * Back/Continue footer. Styled with Tailwind utilities plus the design tokens
 * that already exist (.heading-xl/.heading-lg/.body-sm/.eyebrow/.card/.empty) rather than
 * the prototype's .ob-* classes, which aren't defined in styles/index.css yet
 * and are out of this card's file scope.
 *
 * SCOPE NOTE: rendering is a STEP_PANELS[currentStep] lookup rather than a
 * single-step ternary, so Step 2 (Brand Identity, Card 5 — committed
 * 0c36ede3) actually mounts instead of a generic placeholder. Steps 3-5 still
 * import their own not-yet-implemented stub components (Cards 6-8) and render
 * unchanged. This lookup touches a Card 4 file from a later card, same
 * precedent as feat/assets-and-links's identical fix for its own step.
 */
import { useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Info } from 'lucide-react';
import { OB_STEPS, stepValid, useObDraft } from './obDraft';
import BasicInfoStep from './steps/BasicInfoStep';
import BrandIdentityStep from './steps/BrandIdentityStep';
import StructuredInputsStep from './steps/StructuredInputsStep';
import AssetsLinksStep from './steps/AssetsLinksStep';
import AnalysisStep from './steps/AnalysisStep';

const STEP_PANELS = [
  BasicInfoStep,
  BrandIdentityStep,
  StructuredInputsStep,
  AssetsLinksStep,
  AnalysisStep,
];

export default function OnboardingWizard() {
  const { draft } = useObDraft();
  const [index, setIndex] = useState(0);

  const Panel = STEP_PANELS[index];
  const canContinue = stepValid(draft, index);
  const isLast = index === OB_STEPS.length - 1;

  return (
    <div className="ob-wrap">
      <aside className="ob-rail">
        <div className="ob-rail-mark">
          <div className="g">Ce</div>
          <div>
            <b className="heading-sm block leading-tight">CeView</b>
            <span className="text-meta">Set up your profile</span>
          </div>
        </div>

        <p className="eyebrow mb-2">Required steps</p>

        <ol className="ob-steps" aria-label="Onboarding progress">
          {OB_STEPS.map((step, i) => {
            const state = i < index ? 'done' : i === index ? 'current' : 'pending';
            return (
              <li
                key={step.key}
                data-state={state}
                className="ob-step"
                aria-current={state === 'current' ? 'step' : undefined}
              >
                <div className="ob-dot">
                  {state === 'done' ? <Check size={13} aria-hidden="true" /> : i + 1}
                </div>
                <div>
                  <b>{step.title}</b>
                  <span>{step.sub}</span>
                </div>
              </li>
            );
          })}
        </ol>

        <div className="ob-note">
          <Info size={16} aria-hidden="true" />
          <div>
            Every field feeds the AI. Complete answers produce sharper forecasts and better
            captions.
          </div>
        </div>
      </aside>

      <main className="ob-main">
        <div className="ob-progress">
          <i style={{ width: `${((index + 1) / OB_STEPS.length) * 100}%` }} />
        </div>

        <div className="ob-panel">
          <Panel />
        </div>

        <div className="ob-foot">
          <button
            type="button"
            className="btn-outline"
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            disabled={index === 0}
          >
            <ArrowLeft size={16} aria-hidden="true" /> Back
          </button>

          <div className="flex items-center gap-4">
            <span className="text-meta">
              Step {index + 1} of {OB_STEPS.length}
            </span>
            <button
              type="button"
              className="btn-cta"
              onClick={() => setIndex((i) => Math.min(OB_STEPS.length - 1, i + 1))}
              disabled={!canContinue}
            >
              {isLast ? 'Finish' : 'Continue'} <ArrowRight size={16} aria-hidden="true" />
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
