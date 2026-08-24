/**
 * CARD — Onboarding: Step 3 Structured Inputs
 * Depends on: Card 4 (Wizard Shell & Step 1)
 * Prototype reference: obStepStructured() + obCount() — ui-ux-prototype.html:2074–2107
 * Plan: docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/02-module-1.md
 * Pseudocode: pseudocode/module-1/structured-inputs-step-3.ts
 *
 * wordCount/MIN_WORDS/StructuredField now live in obDraft.tsx (single source
 * of truth, since stepValid's case 2 needs them too) — imported here rather
 * than redefined.
 */
import { CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { useObDraft, wordCount, MIN_WORDS } from '../obDraft';
import type { ObDraft, StructuredField } from '../obDraft';

interface WordCountHintProps {
  field: StructuredField;
  count: number;
}

function WordCountHint({ field, count }: WordCountHintProps) {
  const min = MIN_WORDS[field];

  if (count === 0) {
    return (
      <div className="field-hint" data-testid={`hint-${field}`}>
        <Info size={14} />
        <span>Min {min} words</span>
      </div>
    );
  }

  if (count < min) {
    return (
      <div className="field-hint bad" data-testid={`hint-${field}`}>
        <AlertCircle size={14} />
        <span>
          {count} / {min} words — {min - count} more needed
        </span>
      </div>
    );
  }

  return (
    <div className="field-hint good" data-testid={`hint-${field}`}>
      <CheckCircle2 size={14} />
      <span>{count} words — threshold met</span>
    </div>
  );
}

export default function StructuredInputsStep() {
  const { draft, setDraft } = useObDraft();

  const descCount = wordCount(draft.description);
  const uvpCount = wordCount(draft.uvp);

  function handleChange(field: StructuredField, value: string) {
    const next: ObDraft = { ...draft, [field]: value };
    setDraft(next);
  }

  return (
    <div>
      <p className="eyebrow">Step 3 — Required</p>
      <h2 className="h-xl" style={{ margin: '6px 0 8px' }}>
        The two fields the AI leans on hardest
      </h2>
      <p className="body-sm" style={{ marginBottom: 'var(--sp-8)', maxWidth: '56ch' }}>
        These are embedded into a 768-dimension vector and compared against
        every other Cebu MSME in the corpus. Thin answers produce a thin
        uniqueness score — the thresholds below are enforced, not advisory.
      </p>

      <div className="field">
        <span className="field-label">
          Full description <span className="opt">Minimum {MIN_WORDS.description} words</span>
        </span>
        <textarea
          className="textarea"
          style={{ minHeight: 170 }}
          placeholder="What is the property, where exactly is it, what does a guest actually experience?"
          value={draft.description}
          onChange={(e) => handleChange('description', e.target.value)}
        />
        <WordCountHint field="description" count={descCount} />
      </div>

      <div className="field">
        <span className="field-label">
          Unique value proposition <span className="opt">Minimum {MIN_WORDS.uvp} words</span>
        </span>
        <textarea
          className="textarea"
          placeholder="What can a guest get here that they genuinely cannot get from the business next door?"
          value={draft.uvp}
          onChange={(e) => handleChange('uvp', e.target.value)}
        />
        <WordCountHint field="uvp" count={uvpCount} />
      </div>
    </div>
  );
}