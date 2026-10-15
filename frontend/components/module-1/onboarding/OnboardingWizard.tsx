/**
 * CARD — Onboarding: Wizard Shell & Step 1 Basic Info (shell portion)
 * Prototype reference: #view-onboarding / obRender() — ui-ux-prototype.html:962–996, 1928–1960
 * Plan: docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/02-module-1.md
 *
 * The 5-step wizard shell: horizontal step tracker, active step panel,
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
 *
 * Task 21 (Analysis + wizard completion): the Finish action on the terminal
 * step now persists the profile (POST via apiClient.businessProfile.save)
 * before navigating to /dashboard, instead of just advancing an index that
 * has nowhere further to go. It reads `draft.categories` /
 * `draft.uniquenessScore`, which AnalysisStep writes once it reaches its
 * 'scored' phase — see AnalysisStep.tsx's header comment for why the Finish
 * button stays here (single button, reusing stepValid's existing case 4)
 * rather than moving into AnalysisStep as the pseudocode's finishWizard()
 * sketches it. `onGoToStep` is threaded through only to AnalysisStep, whose
 * warn banner links back to Step 3 — every other step ignores the extra prop.
 *
 * Visual layer (styles/onboarding.css): a full-bleed Cebu waterfall photo
 * under a deep-teal wash with blurred palm shadows, the logo centred above
 * one white card. The card holds the step tracker, the active step and the
 * footer. The photo is decorative and
 * Unsplash-licensed (no on-screen credit needed); the taglines are
 * decorative too, so they are hidden from assistive tech.
 */
import { useState } from 'react';
import type { ComponentType } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import '@fontsource-variable/fraunces/opsz.css';
import '@fontsource/caveat/600.css';
import { OB_STEPS, stepValid, useObDraft } from './obDraft';
import BasicInfoStep from './steps/BasicInfoStep';
import BrandIdentityStep from './steps/BrandIdentityStep';
import StructuredInputsStep from './steps/StructuredInputsStep';
import AssetsLinksStep from './steps/AssetsLinksStep';
import AnalysisStep from './steps/AnalysisStep';
import { apiClient } from '../../../services/apiClient';
import { useProfile } from '../../../services/profileContext';
import { markJustOnboarded } from '../../../services/justOnboardedFlag';
import { useToast } from '../../shared/Toast';
import { LandingImage } from '../../landing/ui';
import { BrandMark } from '../../landing/LandingNav';
import { FROND } from '../../landing/ui/palmFrond';

interface StepPanelProps {
  onGoToStep?: (index: number) => void;
}

/** A small fan of fronds, blurred in CSS into a palm shadow (decorative). */
function PalmShadow({ className }: { className: string }) {
  return (
    <svg className={`ob-palm ${className}`} viewBox="-40 -60 380 380" aria-hidden="true" focusable="false">
      <path d={FROND} />
      <path d={FROND} transform="rotate(-38 18 232)" />
      <path d={FROND} transform="rotate(30 18 232) scale(0.85)" />
    </svg>
  );
}

const STEP_PANELS: ComponentType<StepPanelProps>[] = [
  BasicInfoStep,
  BrandIdentityStep,
  StructuredInputsStep,
  AssetsLinksStep,
  AnalysisStep,
];

export default function OnboardingWizard() {
  const { draft } = useObDraft();
  const { profile, setProfile } = useProfile();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const [finishing, setFinishing] = useState(false);

  const Panel = STEP_PANELS[index];
  const canContinue = stepValid(draft, index);
  const isLast = index === OB_STEPS.length - 1;

  async function handleFinish() {
    if (finishing) return;
    setFinishing(true);
    try {
      const saved = await apiClient.businessProfile.save({
        businessProfileId: profile.businessProfileId,
        businessName: draft.businessName,
        categories: draft.categories,
        coreServices: draft.coreServices,
        description: draft.description,
        uvp: draft.uvp,
        imagePreview: draft.logo ?? null,
        // The database stays canonical at 0-1; draft.uniquenessScore holds
        // the raw 0-100 API scale until this exact conversion point.
        uniquenessScore: (draft.uniquenessScore ?? 0) / 100,
      });
      setProfile({ ...profile, ...saved });
      // Marked before navigating, not carried as router navigation state:
      // ProfileGate reacts to the setProfile above and fires its own
      // redirect to /dashboard once uniquenessScore is set, which can win
      // the race against this navigate call and would strip any state
      // attached to it. See services/justOnboardedFlag.ts.
      markJustOnboarded();
      navigate('/dashboard');
    } catch {
      showToast('Could not save your profile — please try again.');
      setFinishing(false);
    }
  }

  return (
    <div className="ob-wrap">
      <div className="ob-bg" aria-hidden="true">
        <LandingImage slot="who-adventure" fill priority decorative sizes="100vw" />
      </div>
      <PalmShadow className="ob-palm--tl" />
      <PalmShadow className="ob-palm--br" />

      <p className="ob-tagline" aria-hidden="true">
        Cebu tourism
        <br />
        grows brighter
      </p>
      <div className="ob-script" aria-hidden="true">
        <span>Cebu</span>
        <p>
          Incredible places,
          <br />
          brighter businesses.
        </p>
      </div>

      <header className="ob-top">
        <BrandMark tone="light" />
        <h1 className="sr-only">Set up your profile</h1>
      </header>

      <main className="ob-card">
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
                  {state === 'done' ? <Check size={14} aria-hidden="true" /> : i + 1}
                </div>
                <div className="ob-step-text">
                  <b>{step.title}</b>
                  <span>{step.sub}</span>
                </div>
              </li>
            );
          })}
        </ol>

        <div className="ob-body">
          <div className="ob-panel">
            <Panel onGoToStep={setIndex} />
          </div>

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

          <span className="ob-foot-count">
            Step {index + 1} of {OB_STEPS.length}
          </span>

          <button
            type="button"
            className="btn-cta"
            onClick={() =>
              isLast ? handleFinish() : setIndex((i) => Math.min(OB_STEPS.length - 1, i + 1))
            }
            disabled={!canContinue || (isLast && finishing)}
          >
            {isLast ? (finishing ? 'Finishing…' : 'Finish') : 'Continue'}{' '}
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>
      </main>
    </div>
  );
}
