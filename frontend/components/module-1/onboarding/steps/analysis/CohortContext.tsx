/**
 * Onboarding Step 5 — the banner beneath the score.
 *
 * OWNERSHIP: Tasks 16–17 / 04-frontend-copy.md (Dev D).
 * Dev E owns AnalysisStep.tsx and CategoryPicker.tsx; do not edit those here.
 *
 * Extracted verbatim from AnalysisStep.tsx by 01-prerequisites.md Task 5 so
 * the two frontend work streams own separate files. The extraction changed no
 * behaviour, markup or copy — AnalysisStep.test.tsx passes against it without
 * edits.
 *
 * KNOWN WRONG, and Tasks 16–17's job to fix — deliberately left intact here so
 * the extraction stays reviewable as a pure move:
 *
 *   - "A more specific UVP usually raises this score" is unactionable advice.
 *     The score is corpus-relative and compressed; rewriting the UVP moves it
 *     very little. An operator who sharpens their UVP three times and sees a
 *     flat number learns to distrust the product.
 *   - The message appears only below the threshold, so it reads as a
 *     reprimand. Task 17 replaces it with an always-visible, data-driven
 *     density explainer sourced from `categoryDensity` and `cohortSize`.
 *   - Nothing discloses the comparison set. A percentile without its cohort
 *     size is unreadable — Task 16 adds that line.
 *   - Nothing says a low score does not gate anything, though `stepValid`
 *     case 4 only checks that a score exists. Task 17 says it out loud.
 *
 * The `scores` prop is already the full UniquenessResult, so Tasks 16–17 need
 * no signature change to reach the cohort fields.
 */
import { ThumbsUp, X } from 'lucide-react';
import type { UniquenessResult } from '../../../../../types';

/** Kept here with the banner it gates; Task 18 may relocate it with the hierarchy work. */
export const PASS_THRESHOLD = 70;

interface Props {
  scores: UniquenessResult;
  /** Wired by OnboardingWizard so the banner's link can jump back to Step 3. */
  onGoToStep?: (index: number) => void;
}

export default function CohortContext({ scores, onGoToStep }: Props) {
  if (scores.overallScore >= PASS_THRESHOLD) {
    return (
      <div className="banner banner--info mt-4" role="status">
        <ThumbsUp aria-hidden="true" />
        <div>
          <b>Strong differentiation.</b> Your profile stands out clearly against the local cohort in
          these categories.
        </div>
      </div>
    );
  }

  return (
    <div className="banner banner--warn mt-4" role="status">
      <X aria-hidden="true" />
      <div>
        <b>Room to sharpen your positioning.</b> A more specific UVP usually raises this score.{' '}
        {onGoToStep && (
          <button type="button" className="underline font-semibold" onClick={() => onGoToStep(2)}>
            Strengthen my UVP
          </button>
        )}
      </div>
    </div>
  );
}
