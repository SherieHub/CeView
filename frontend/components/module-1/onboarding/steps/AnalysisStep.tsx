/**
 * CARD — Onboarding: Step 5 Analysis
 * Depends on: Cards 5, 6 (Brand Identity + Structured Inputs data feeds this step),
 *   Foundation — Fixture Data Layer
 * Spec: docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/pseudocode/module-1/analysis-step-5.ts
 * Plan: docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/02-module-1.md, Task 21
 *
 * Five phases: idle -> analyzing -> categories -> computing -> scored.
 * `analyzing` calls POST /api/classification/analyze on mount; `categories`
 * lets the operator adjust the AI's pick (>=1 category must always stay
 * selected — blocked with a toast, never a disabled control) before
 * triggering POST /api/classification/uniqueness; `scored` renders the three
 * score cards plus a pass/warn banner.
 *
 * Wizard completion (persisting the profile + navigating to /dashboard) is
 * NOT done here — it lives in OnboardingWizard's Finish handler, which reads
 * `draft.categories` / `draft.uniquenessScore` once this step writes them in.
 * See OnboardingWizard.tsx for why: a single Finish button, gated by
 * stepValid's existing case 4, needed fewer moving parts than this step
 * owning a second one. The "mark filled-in social handles as connected" part
 * of the spec's finishWizard() is skipped — connectionsStore is fixture-only
 * and platform connections have no backend, so faking that state would lie
 * about what actually happened.
 *
 * Ports (structure/behaviour, not styling — ceview/ predates the current
 * design system): ceview/components/module-1/1.1-business-input/components/
 * InferredCategoryBoard.tsx + AdjustableCategoryItem.tsx, and
 * ceview/components/module-1/1.2-uniqueness-scoring/components/
 * OverallScoreCard.tsx + ActionableScoreCard.tsx + ComputeUniquenessButton.tsx.
 */
import { useEffect, useState } from 'react';
import { Check, Loader2, Plus, Sparkles, ThumbsUp, X } from 'lucide-react';
import { useObDraft } from '../obDraft';
import { useToast } from '../../../shared/Toast';
import { ApiErrorPanel } from '../../../shared/ApiErrorPanel';
import { apiClient } from '../../../../services/apiClient';
import type { CategoryAllocation, UniquenessResult } from '../../../../types';

type Phase = 'idle' | 'analyzing' | 'categories' | 'computing' | 'scored';

interface Props {
  /** Wired by OnboardingWizard so the warn banner's link can jump back to Step 3. */
  onGoToStep?: (index: number) => void;
}

const PASS_THRESHOLD = 70;

export default function AnalysisStep({ onGoToStep }: Props) {
  const { draft, setDraft } = useObDraft();
  const { showToast } = useToast();

  const [phase, setPhase] = useState<Phase>('idle');
  const [categories, setCategories] = useState<CategoryAllocation[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [scores, setScores] = useState<UniquenessResult | null>(null);
  const [error, setError] = useState<unknown | null>(null);

  useEffect(() => {
    let cancelled = false;
    setPhase('analyzing');
    setError(null);

    apiClient.classification
      .analyze({
        businessName: draft.businessName,
        description: draft.description,
        coreServices: draft.coreServices,
        uvp: draft.uvp,
      })
      .then((allocations) => {
        if (cancelled) return;
        // analyze() returns every category including zero-percentage ones —
        // only ones the model actually found evidence for are worth showing.
        const found = allocations
          .filter((c) => c.percentage > 0)
          .sort((a, b) => b.percentage - a.percentage);
        setCategories(found);
        setSelected(found.slice(0, 2).map((c) => c.name));
        setPhase('categories');
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e);
        setPhase('idle');
      });

    return () => {
      cancelled = true;
    };
    // Intentionally run once on mount only — this step analyzes the draft as
    // it stood when the operator reached Step 5, not on every keystroke back
    // on Steps 2/3.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleCategory(name: string) {
    const isSelected = selected.includes(name);
    if (isSelected && selected.length <= 1) {
      showToast('At least one category must stay selected.');
      return;
    }
    const next = isSelected ? selected.filter((n) => n !== name) : [...selected, name];
    setSelected(next);
    // A stale score no longer matches the current selection — discard it and
    // fall back to the picker rather than showing a number that lies.
    if (phase === 'scored') {
      setScores(null);
      setDraft({ ...draft, categories: next, uniquenessScore: null });
      setPhase('categories');
    }
  }

  function computeUniqueness() {
    setPhase('computing');
    setError(null);

    apiClient.classification
      .uniqueness({
        businessName: draft.businessName,
        description: draft.description,
        coreServices: draft.coreServices,
        uvp: draft.uvp,
        categories: selected,
      })
      .then((result) => {
        setScores(result);
        setPhase('scored');
        // Written into the draft immediately so OnboardingWizard's Finish
        // button (gated on stepValid case 4 -> draft.uniquenessScore != null)
        // enables the moment this resolves.
        setDraft({ ...draft, categories: selected, uniquenessScore: result.overallScore });
      })
      .catch((e) => {
        setError(e);
        setPhase('categories');
      });
  }

  if (error != null) {
    return (
      <div>
        <p className="ob-step-eyebrow">Step 5 — Required</p>
        <h2 className="heading-lg" style={{ margin: '6px 0 8px' }}>
          Categories and uniqueness
        </h2>
        <ApiErrorPanel error={error} label="Business analysis" />
      </div>
    );
  }

  return (
    <div>
      <p className="ob-step-eyebrow">Step 5 — Required</p>
      <h2 className="heading-lg" style={{ margin: '6px 0 8px' }}>
        Categories and uniqueness
      </h2>
      <p className="body-sm" style={{ marginBottom: 24, maxWidth: '56ch' }}>
        The AI reads your description and UVP to infer which tourism categories fit your business,
        then scores how differentiated you are against the local cohort in those categories.
      </p>

      {phase === 'analyzing' && (
        <div className="banner banner--info" role="status">
          <Loader2 className="animate-spin" aria-hidden="true" />
          <div>
            <b>Running your profile through the embedding pipeline…</b> This takes a few seconds.
          </div>
        </div>
      )}

      {phase === 'analyzing' && (
        <div className="mt-4 flex flex-col gap-3" aria-hidden="true">
          <div className="skel" style={{ height: 56 }} />
          <div className="skel" style={{ height: 56 }} />
          <div className="skel" style={{ height: 56 }} />
        </div>
      )}

      {(phase === 'categories' || phase === 'computing' || phase === 'scored') && (
        <>
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
                    onClick={() => toggleCategory(c.name)}
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

          <button
            type="button"
            className="btn-primary"
            disabled={selected.length === 0 || phase === 'computing'}
            onClick={computeUniqueness}
          >
            {phase === 'computing' ? (
              <>
                <span className="spinner spinner--inverse" aria-hidden="true" /> Computing…
              </>
            ) : (
              <>
                <Sparkles size={16} aria-hidden="true" /> Compute uniqueness score
              </>
            )}
          </button>
        </>
      )}

      {phase === 'scored' && scores && (
        <div className="mt-6">
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

          {scores.overallScore >= PASS_THRESHOLD ? (
            <div className="banner banner--info mt-4" role="status">
              <ThumbsUp aria-hidden="true" />
              <div>
                <b>Strong differentiation.</b> Your profile stands out clearly against the local
                cohort in these categories.
              </div>
            </div>
          ) : (
            <div className="banner banner--warn mt-4" role="status">
              <X aria-hidden="true" />
              <div>
                <b>Room to sharpen your positioning.</b> A more specific UVP usually raises this
                score.{' '}
                {onGoToStep && (
                  <button
                    type="button"
                    className="underline font-semibold"
                    onClick={() => onGoToStep(2)}
                  >
                    Strengthen my UVP
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
