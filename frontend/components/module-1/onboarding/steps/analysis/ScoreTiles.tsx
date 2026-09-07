/**
 * Onboarding Step 5 — the three score tiles.
 *
 * OWNERSHIP: Task 15 / 04-frontend-copy.md (Dev D).
 * Dev E owns AnalysisStep.tsx and CategoryPicker.tsx; do not edit those here.
 *
 * Extracted verbatim from AnalysisStep.tsx by 01-prerequisites.md Task 5 so
 * the two frontend work streams own separate files. The extraction changed no
 * behaviour, markup or copy — AnalysisStep.test.tsx passes against it without
 * edits.
 *
 * KNOWN WRONG, and Task 15's job to fix — deliberately left intact here so the
 * extraction stays reviewable as a pure move:
 *
 *   - "Description strength" renders `semanticsScore`, which is a
 *     corpus-relative position, NOT a judgment of the operator's writing. An
 *     operator with an excellent description in a crowded category reads this
 *     as "my writing is bad", which is the opposite of what it measures.
 *   - "Category fit" renders a normalised share that is not comparable across
 *     different numbers of selected categories, and after Task 9 is not part
 *     of the headline at all.
 *   - Three equal tiles imply three components of one number. Task 18 fixes
 *     the hierarchy; Task 15 fixes the words.
 */
import type { UniquenessResult } from '../../../../../types';

interface Props {
  scores: UniquenessResult;
}

export default function ScoreTiles({ scores }: Props) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <div className="card">
        <p className="eyebrow">Overall uniqueness</p>
        <p className="heading-xl mt-2">{Math.round(scores.overallScore)}</p>
      </div>
      <div className="card">
        <p className="eyebrow">Description strength</p>
        <p className="heading-xl mt-2">{Math.round(scores.semanticsScore)}</p>
        {scores.descriptionFeedback && (
          <p className="body-xs mt-2 text-[var(--color-text-muted)]">{scores.descriptionFeedback}</p>
        )}
      </div>
      <div className="card">
        <p className="eyebrow">Category fit</p>
        <p className="heading-xl mt-2">{Math.round(scores.categoryScore)}</p>
        {scores.categoryFeedback && (
          <p className="body-xs mt-2 text-[var(--color-text-muted)]">{scores.categoryFeedback}</p>
        )}
      </div>
    </div>
  );
}
