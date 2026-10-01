// ---- components/module-1/onboarding/steps/AnalysisStep.tsx ----
imports: useEffect, useState, useNavigate, useObDraft, useProfile, useToast, apiClient,
         InferredCategoryBoard + InferredCategory type, OverallScoreCard, ActionableScoreCard,
         ComputeUniquenessButton

type Phase: 'idle' | 'analyzing' | 'categories' | 'computing' | 'scored'

function AnalysisStep():
  { draft } ← useObDraft(); { setProfile } ← useProfile(); { showToast } ← useToast()
  navigate ← useNavigate()
  state: phase ← 'idle', categories ← [], scores ← null

  on mount:
    phase ← 'analyzing'
    apiClient classify (combined description+UVP+core-services text)
      → on response: store categories (name/confidence/selected — top 2 pre-selected), phase ← 'categories'

  toggleCategory(name):
    if target is selected AND it's the only selected one → showToast(block message); no-op
    else → toggle its selected flag
    if scores already computed → phase reverts to 'categories' (stale score discarded)

  computeUniqueness():
    phase ← 'computing'
    apiClient uniqueness (current selection)
      → on response: store {overallScore, semanticsScore, categoryScore}, phase ← 'scored'

  finishWizard():
    setProfile({...draft, categories: selected names, uniquenessScore: scores.overallScore, ...})
    mark filled-in social handles as "connected"
    navigate('/dashboard')

  render:
    if phase === 'analyzing' → skeleton + embedding-pipeline banner
    if phase in [categories, computing, scored] → InferredCategoryBoard + ComputeUniquenessButton
    if phase === 'scored' → OverallScoreCard + 2x ActionableScoreCard +
      (overallScore >= 70 ? pass banner : warn banner with "Strengthen my UVP" link back to Step 3) +
      Finish button (calls finishWizard)
