// ---- components/module-1/onboarding/steps/StructuredInputsStep.tsx ----
imports: useObDraft

const MIN_WORDS: { description: 50, uvp: 30 }

function wordCount(text): number   // 0 if blank, else trimmed whitespace-split length

function WordCountHint({field, count}):
  min ← MIN_WORDS[field]
  if count === 0 → neutral "Min N words" hint
  else if count < min → red "N / min words — X more needed" hint
  else → green "N words — threshold met" hint

function StructuredInputsStep():
  { draft, setDraft } ← useObDraft()
  on description textarea change → setDraft({...draft, description})
  on uvp textarea change → setDraft({...draft, uvp})
  render: description textarea + its WordCountHint, uvp textarea + its WordCountHint

// ---- components/module-1/onboarding/obDraft.ts (extension) ----
stepValid case 2 (Step 3): wordCount(draft.description) >= 50 AND wordCount(draft.uvp) >= 30
  // both fields independently meet their minimum
