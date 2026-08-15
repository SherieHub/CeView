/**
 * CARD — Onboarding: Wizard Shell & Step 1 Basic Info
 * Prototype reference: view-onboarding / obRender() — ui-ux-prototype.html:962-1989
 * Screen doc: docs/module-1/screens/onboarding-wizard.md
 */
import { useState } from 'react';
import { ObDraftProvider, stepValid, useObDraft } from './obDraft';
import BasicInfoStep from './steps/BasicInfoStep';

const STEPS = ['Basic Info', 'Brand Identity', 'Structured Inputs', 'Assets & Links', 'Analysis'];

function OnboardingWizardInner() {
  const [currentStep, setCurrentStep] = useState(0);
  const { draft } = useObDraft();
  const canContinue = stepValid(currentStep, draft);

  return (
    <div className="grid min-h-screen grid-cols-1 md:grid-cols-[260px_1fr]">
      <aside className="flex flex-col gap-6 bg-navy p-8 text-white">
        <div>
          <b className="block">CeView</b>
          <span className="body-xs uppercase tracking-widest opacity-70">Set up your profile</span>
        </div>
        <p className="eyebrow">Required steps</p>
        <div className="flex flex-col gap-3">
          {STEPS.map((title, i) => {
            const state = i < currentStep ? 'done' : i === currentStep ? 'current' : 'pending';
            return (
              <div key={title} data-testid="ob-step" data-state={state} className="flex items-center gap-3">
                <div className="flex h-6 w-6 items-center justify-center rounded-full border border-white/40 text-xs">
                  {state === 'done' ? '✓' : i + 1}
                </div>
                <b className="body-sm">{title}</b>
              </div>
            );
          })}
        </div>
      </aside>

      <main className="flex flex-col gap-8 p-10">
        <div className="h-1.5 w-full rounded-full bg-panel-sunk">
          <div
            className="h-full rounded-full bg-gold"
            style={{ width: `${((currentStep + 1) / STEPS.length) * 100}%` }}
          />
        </div>

        <div className="flex-1">
          {currentStep === 0 ? (
            <BasicInfoStep />
          ) : (
            <p className="body-sm">This step lands in a later card.</p>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-line pt-6">
          <button
            type="button"
            className="body-sm rounded-full border border-line px-4 py-2"
            style={{ visibility: currentStep === 0 ? 'hidden' : 'visible' }}
            onClick={() => setCurrentStep((s) => s - 1)}
          >
            Back
          </button>
          <div className="flex items-center gap-4">
            <span className="body-xs">
              Step {currentStep + 1} of {STEPS.length}
            </span>
            <button
              type="button"
              className="rounded-full bg-gold px-4 py-2 font-bold text-navy disabled:opacity-60"
              disabled={!canContinue}
              onClick={() => setCurrentStep((s) => s + 1)}
            >
              Continue
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
