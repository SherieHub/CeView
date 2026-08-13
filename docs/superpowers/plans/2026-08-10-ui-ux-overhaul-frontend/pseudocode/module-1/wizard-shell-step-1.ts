// ---- components/module-1/onboarding/obDraft.ts ----
imports: createContext/useContext/useState, ReactNode from 'react'

interface ObDraft { businessName, industry, slogan, vibes: string[] (Card 5),
  coreServices: string[] (Card 5), description (Card 6), uvp (Card 6),
  socials: Record<string,string> (Card 7), logo: string|null (Card 7, data URL), website (Card 7) }
const EMPTY_DRAFT: ObDraft   // all fields empty

interface ObDraftContextValue { draft, setDraft }
function ObDraftProvider({children}):
  state: draft ← EMPTY_DRAFT
  render: children wrapped in context provider

function useObDraft(): ObDraftContextValue   // useContext + null-check

function stepValid(step, draft): boolean
  // one branch per step index — Steps 2-5's branches land with Cards 5-8;
  // this card only implements the Step 1 branch
  case 0 (Step 1, this card): businessName.length > 1 AND industry set
  case 1 (Step 2, Card 5): false — placeholder until that card lands
  case 2 (Step 3, Card 6): false — placeholder
  case 3 (Step 4, Card 7): true — no gate
  case 4 (Step 5, Card 8): false — placeholder
  default: false

// ---- components/module-1/onboarding/OnboardingWizard.tsx ----
imports: useState, {ObDraftProvider, stepValid, useObDraft}, BasicInfoStep
// later cards import BrandIdentityStep, StructuredInputsStep, AssetsLinksStep, AnalysisStep

const STEPS: ['Basic Info','Brand Identity','Structured Inputs','Assets & Links','Analysis']

function OnboardingWizardInner():
  state: currentStep ← 0
  { draft } ← useObDraft()
  canContinue ← stepValid(currentStep, draft)
  render: side list of STEPS (each marked done/current/pending vs currentStep) +
          progress bar sized to (currentStep+1)/STEPS.length +
          active step's panel (only BasicInfoStep implemented; others show a placeholder) +
          footer: Back button (hidden on step 1), Continue button (disabled unless canContinue)
  on Back click → currentStep - 1
  on Continue click → currentStep + 1

function OnboardingWizard():
  render: <ObDraftProvider><OnboardingWizardInner/></ObDraftProvider>

// ---- components/module-1/onboarding/steps/BasicInfoStep.tsx ----
imports: useObDraft

const BUSINESS_CATEGORIES: [7 fixed categories]
const DEMO_BUSINESS: fixed demo values for every obDraft field

function BasicInfoStep():
  { draft, setDraft } ← useObDraft()
  on businessName input change → setDraft({...draft, businessName})
  on industry select change → setDraft({...draft, industry})
  on slogan input change → setDraft({...draft, slogan})
  on "Fill with demo business" click → setDraft({...draft, ...DEMO_BUSINESS})
  render: business name input (required), industry select (required, BUSINESS_CATEGORIES),
          slogan input (optional), demo-fill button
