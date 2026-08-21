/**
 * CARD — Onboarding: Wizard Shell & Step 1 Basic Info
 * Depends on: Foundation — Shell & Routing
 * Prototype reference: view-onboarding / obRender() — ui-ux-prototype.html:962-1989
 * Plan: docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/02-module-1.md
 *
 * The 5-step wizard shell: side step rail, progress bar, active step panel,
 * Back/Continue footer. Only Step 1 (Basic Info) is real — Steps 2-5 render a
 * "coming in a later card" placeholder until Cards 5-8 land, matching those
 * steps' own still-unimplemented stub files. Styled with Tailwind utilities
 * plus the design tokens that already exist (.h-xl/.h-lg/.body-sm/.eyebrow/
 * .card/.empty) rather than the prototype's .ob-* classes, which aren't
 * defined in styles/index.css yet and are out of this card's file scope.
 */
import { useState } from 'react';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { ObDraftProvider, useObDraft, stepValid } from './obDraft';
import BasicInfoStep from './steps/BasicInfoStep';
import StructuredInputsStep from './steps/StructuredInputsStep';

const STEPS = [
  { title: 'Basic Info', sub: 'Name, industry, slogan' },
  { title: 'Brand Identity', sub: 'Vibe and core services' },
  { title: 'Structured Inputs', sub: 'Description and UVP' },
  { title: 'Assets & Links', sub: 'Socials, logo, website' },
  { title: 'Analysis', sub: 'Categories and uniqueness' },
];

function ComingLaterPanel({ title }: { title: string }) {
  return (
    <div className="empty flex h-full flex-col items-center justify-center gap-1 text-center">
      <h2 className="h-lg">{title}</h2>
      <p className="body-sm">Coming in a later card.</p>
    </div>
  );
}

function OnboardingWizardInner() {
  const [currentStep, setCurrentStep] = useState(2);
  const { draft } = useObDraft();
  const canContinue = stepValid(currentStep, draft);
  const isLastStep = currentStep === STEPS.length - 1;

  return (
    <div className="grid min-h-screen grid-cols-1 md:grid-cols-[290px_1fr]">
      <aside className="flex flex-col gap-8 border-r border-line bg-panel p-6">
        <div>
          <div className="eyebrow mb-3">Required steps</div>
          <div className="flex flex-col gap-0.5">
            {STEPS.map((step, i) => {
              const state = i < currentStep ? 'done' : i === currentStep ? 'current' : 'pending';
              return (
                <div
                  key={step.title}
                  className="flex items-center gap-3 rounded-md px-2.5 py-2.5"
                  style={state === 'current' ? { background: 'var(--color-gold-wash, rgba(244,162,22,.12))' } : undefined}
                  data-state={state}
                >
                  <div
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-bold"
                    style={
                      state === 'done'
                        ? { background: 'var(--color-success, #16a34a)', borderColor: 'var(--color-success, #16a34a)', color: '#fff' }
                        : state === 'current'
                          ? { background: 'var(--color-navy)', borderColor: 'var(--color-navy)', color: '#fff' }
                          : { borderColor: 'var(--color-line)' }
                    }
                  >
                    {state === 'done' ? <Check size={13} strokeWidth={3} /> : i + 1}
                  </div>
                  <div>
                    <b className={`block text-xs font-bold leading-tight ${state === 'pending' ? 'text-muted' : ''}`}>
                      {step.title}
                    </b>
                    <span className="body-xs text-muted">{step.sub}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </aside>

      <main className="flex flex-col p-6 md:p-10">
        <div className="mb-8 h-[3px] overflow-hidden rounded-full bg-line">
          <div
            className="h-full rounded-full bg-gold transition-all"
            style={{ width: `${((currentStep + 1) / STEPS.length) * 100}%` }}
          />
        </div>

        <div className="max-w-[640px] flex-1">
          {currentStep === 0 ? (
            <BasicInfoStep />
          ) : currentStep === 2 ? (
            <StructuredInputsStep />
          ) : (
            <ComingLaterPanel title={STEPS[currentStep].title} />
          )}
        </div>

        <div className="mt-8 flex items-center justify-between border-t border-line pt-6">
          <button
            type="button"
            onClick={() => setCurrentStep((s) => s - 1)}
            className="flex items-center gap-1.5 rounded-full px-3 py-2 body-sm"
            style={{ visibility: currentStep === 0 ? 'hidden' : 'visible' }}
          >
            <ArrowLeft size={15} /> Back
          </button>
          <div className="flex items-center gap-3">
            <span className="body-xs">
              Step {currentStep + 1} of {STEPS.length}
            </span>
            <button
              type="button"
              disabled={!canContinue}
              onClick={() => setCurrentStep((s) => s + 1)}
              className="flex items-center gap-1.5 rounded-full bg-gold px-4 py-2 font-bold text-navy disabled:opacity-60"
            >
              {isLastStep ? 'Confirm & Enter CeView' : 'Continue'} <ArrowRight size={15} />
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function OnboardingWizard() {
  return (
    <ObDraftProvider>
      <OnboardingWizardInner />
    </ObDraftProvider>
  );
}
