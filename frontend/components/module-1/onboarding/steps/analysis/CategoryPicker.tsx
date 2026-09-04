/**
 * Onboarding Step 5 — inferred-category chips.
 *
 * OWNERSHIP: Task 18–21 / 05-frontend-shell.md (Dev E).
 * Dev D owns ScoreTiles.tsx and CohortContext.tsx; do not edit those here.
 *
 * Extracted verbatim from AnalysisStep.tsx by 01-prerequisites.md Task 5 so
 * the two frontend work streams own separate files. Behaviour, markup and
 * copy are unchanged by that extraction — AnalysisStep.test.tsx passes against
 * it without edits.
 *
 * Presentational only: the ">=1 category must stay selected" rule lives in
 * AnalysisStep's toggleCategory, because deselecting the last chip also has to
 * invalidate a computed score, which is phase state this component does not own.
 */
import { Check, Plus, Sparkles } from 'lucide-react';
import type { CategoryAllocation } from '../../../../../types';

interface Props {
  categories: CategoryAllocation[];
  selected: string[];
  onToggle: (name: string) => void;
}

export default function CategoryPicker({ categories, selected, onToggle }: Props) {
  return (
    <div className="card mb-4">
      <p className="body-xs font-semibold mb-3 flex items-center gap-1.5">
        <Sparkles size={14} aria-hidden="true" />
        Inferred categories
      </p>
      <div className="flex flex-wrap gap-2">
        {categories.map((c) => {
          const isSelected = selected.includes(c.name);
          return (
            <button
              key={c.name}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onToggle(c.name)}
              className="flex items-center gap-1.5 rounded-full border border-[var(--color-gray-light)] px-3 py-1.5 body-sm aria-pressed:border-[var(--color-mint-primary)] aria-pressed:bg-[var(--color-mint-pale)] aria-pressed:font-semibold"
            >
              {isSelected ? <Check size={12} aria-hidden="true" /> : <Plus size={12} aria-hidden="true" />}
              {c.name}
              <span className="badge badge--teal">{Math.round(c.percentage)}%</span>
            </button>
          );
        })}
      </div>
      {selected.length === 0 && (
        <p className="body-xs mt-3 text-[var(--color-text-muted)]">Select at least one category to proceed.</p>
      )}
    </div>
  );
}
