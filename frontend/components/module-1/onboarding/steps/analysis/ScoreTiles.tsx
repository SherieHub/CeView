/**
 * Onboarding Step 5 — the score tiles.
 *
 * OWNERSHIP: Task 15 / 04-frontend-copy.md (Dev D) owns every label, number and
 * subtitle in this file. Task 18 / 05-frontend-shell.md (Dev E) owns where they
 * sit relative to each other, which is why the pieces are exported separately
 * and AnalysisStep does the composing — see "Composition" below.
 *
 * Extracted from AnalysisStep.tsx by 01-prerequisites.md Task 5 so the two
 * frontend work streams own separate files.
 *
 * ── Composition (Task 18) ───────────────────────────────────────────────────
 * This file used to render all three tiles in one `md:grid-cols-3`, which said
 * "three components of one number" — the exact misreading the plan exists to
 * fix. The truth is one score and two things that explain it, so the percentile
 * is now its own export that the parent places ABOVE the diagnostics.
 *
 * Split as two exports rather than a `variant` prop on one component: with a
 * single consumer, a prop would have left the unused branch as dead code, and
 * Task 15 would have relabelled a percentile tile that no longer rendered.
 * Every tile's markup and copy still lives here; only placement moved out.
 *
 * KNOWN WRONG, and Task 15's job to fix — deliberately left intact here so the
 * hierarchy change stays reviewable as pure structure:
 *
 *   - "Description strength" renders `semanticsScore`, which is a
 *     corpus-relative position, NOT a judgment of the operator's writing. An
 *     operator with an excellent description in a crowded category reads this
 *     as "my writing is bad", which is the opposite of what it measures.
 *   - "Category fit" renders a normalised share that is not comparable across
 *     different numbers of selected categories, and after Task 9 is not part
 *     of the headline at all.
 *   - "Overall uniqueness" is specifically a percentile, which is far more
 *     interpretable than the label admits.
 */
import type { UniquenessResult } from '../../../../../types';

interface Props {
  scores: UniquenessResult;
}

/**
 * The headline score. Rendered by the parent above ScoreTiles, at .heading-xl —
 * the largest type on the screen, so a reader who never reads a label still
 * sees one dominant number.
 *
 * `role="img"` + `aria-label`: the bare digits announce as "72" with no scale,
 * no direction and no clue which of the three numbers it is. `describedBy`
 * points at the scale sentence, which the parent owns (Task 20).
 */
export function PercentileTile({ scores, describedBy }: Props & { describedBy?: string }) {
  return (
    <div className="card">
      <p className="eyebrow">Overall uniqueness</p>
      <p
        className="heading-xl mt-2"
        role="img"
        aria-label={`Overall uniqueness ${Math.round(scores.overallScore)}`}
        aria-describedby={describedBy}
      >
        {Math.round(scores.overallScore)}
      </p>
    </div>
  );
}

/**
 * The two diagnostics, subordinate to the percentile above them: .heading-md
 * rather than .heading-xl, and one column on narrow screens so a feedback line
 * is never cramped.
 */
export default function ScoreTiles({ scores }: Props) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="card">
        <p className="eyebrow">Description strength</p>
        <p className="heading-md mt-2">{Math.round(scores.semanticsScore)}</p>
        {scores.descriptionFeedback && (
          <p className="body-xs mt-2 text-[var(--color-text-muted)]">{scores.descriptionFeedback}</p>
        )}
      </div>
      <div className="card">
        <p className="eyebrow">Category fit</p>
        <p className="heading-md mt-2">{Math.round(scores.categoryScore)}</p>
        {scores.categoryFeedback && (
          <p className="body-xs mt-2 text-[var(--color-text-muted)]">{scores.categoryFeedback}</p>
        )}
      </div>
    </div>
  );
}
