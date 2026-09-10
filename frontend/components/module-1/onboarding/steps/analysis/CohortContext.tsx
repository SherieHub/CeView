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
 * Discloses the comparison cohort and provides always-visible context driven
 * by its measured density, independent of whether the percentile is high or low.
 */
import type { UniquenessResult } from '../../../../../types';

interface Props {
  scores: UniquenessResult;
  /** Retained while AnalysisStep's navigation contract is updated by its owner. */
  onGoToStep?: (index: number) => void;
}

export default function CohortContext({ scores }: Props) {
  const cohortSize = scores.cohortSize ?? 0;
  const categories = scores.cohortCategories?.join(', ') || 'your selected categories';
  const businessLabel = cohortSize === 1 ? 'business' : 'businesses';

  const densityCopy = {
    dense: `${categories} is one of Cebu's most crowded categories (${cohortSize} ${businessLabel} on record). Scores here cluster lower than in quieter categories, because you are being compared against many similar operators. A ${Math.round(scores.overallScore)} here is not the same as a ${Math.round(scores.overallScore)} in a sparse category.`,
    moderate: `${categories} has a mid-sized cohort (${cohortSize} ${businessLabel} on record), so scores here spread fairly evenly.`,
    sparse: `${categories} has few businesses on record (${cohortSize}), so scores here run high and will settle as more operators join.`,
  } as const;

  return (
    <div className="banner banner--info mt-4" role="status" data-testid="cohort-context">
      <div>
        {scores.sufficientCohort === true ? (
          <>
            <p>
              Compared against {cohortSize} {categories} {businessLabel} in Cebu. The median
              score in this group is {Math.round(scores.cohortMedianScore)}.
            </p>
            {scores.categoryDensity && <p className="mt-2">{densityCopy[scores.categoryDensity]}</p>}
          </>
        ) : (
          <p>
            Only {cohortSize} comparable {businessLabel} {cohortSize === 1 ? 'is' : 'are'} on
            record, too few to rank against. Your score will sharpen as more operators in your category join.
          </p>
        )}
        <p className="mt-2">
          This score does not gate anything. You can finish setting up and refine your profile later
          from Settings.
        </p>
      </div>
    </div>
  );
}
