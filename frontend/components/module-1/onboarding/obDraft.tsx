
/**
 * Onboarding draft state — the shared container every wizard step reads and
 * writes. Ports the prototype's `obDraft` object
 * (ui-ux-prototype.html:1904–1926) to React context.
 *
 * SCOPE NOTE: this file is listed as a deliverable of "CARD — Onboarding:
 * Wizard Shell & Step 1 Basic Info" in
 * docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/02-module-1.md.
 * It is implemented here only as far as Step 4 (Assets & Links) requires,
 * because that step cannot exist without it. Step navigation, the progress
 * bar, and the per-step `stepValid` gates still belong to Card 4 — do not
 * infer from this file that Card 4 is done.
 */
import { createContext, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { PlatformId } from "../../../types";


export interface ObDraft {
  /** Step 1 — Basic Info (Card 4) */
  businessName: string;
  industry: string;
  slogan: string;
  /** Step 2 — Brand Identity (Card 5) */
  vibes: string[];
  coreServices: string[];
  /** Step 3 — Structured Inputs (Card 6) */
  description: string;
  uvp: string;
  /** Step 4 — Assets & Links (this card) */
  socials: Record<PlatformId, string>;
  logo: string | null;
  website: string;
  /**
   * Step 5 — Analysis (Task 21). `categories` is the operator's selected
   * category names once classification runs; `uniquenessScore` is the raw
   * 0–100 API scale (UniquenessResult.overallScore), NOT the 0–1 scale the
   * backend persists — it exists here only so stepValid's case 4 can gate on
   * "has a score been computed", not as the value that gets saved.
   */
  categories: string[];
  uniquenessScore: number | null;
  /**
   * True when the API answered `sufficientCohort: false` — too few comparable
   * businesses on record to rank against. That is a VALID answer, not an error,
   * and it leaves no defensible number to put in `uniquenessScore`.
   *
   * Finish still has to be reachable, so `stepValid` case 4 accepts this flag as
   * the other way of having finished Step 5. The alternatives were both worse:
   * leaving the score null strands the operator on Step 5 with no way forward,
   * and writing the unranked score persists a number that was never computed —
   * the exact failure the backend's own cohort floor exists to prevent.
   */
  cohortInsufficient: boolean;
}

export const EMPTY_OB_DRAFT: ObDraft = {
  businessName: '',
  industry: '',
  slogan: '',
  vibes: [],
  coreServices: [],
  description: '',
  uvp: '',
  socials: { instagram: '', tiktok: '', facebook: '' },
  logo: null,
  website: '',
  categories: [],
  uniquenessScore: null,
  cohortInsufficient: false,
};

/**
 * Demo business. Kept under this name so existing call sites (App.tsx's preview
 * route, OnboardingWizard.test.tsx) are unaffected; the data itself lives with
 * every other fixture, in services/fixtures/demoBusiness.ts, so it can be
 * deleted with them at deploy.
 */
export { DEMO_BUSINESS as DEMO_OB_DRAFT } from '../../../services/fixtures/demoBusiness';

interface ObDraftValue {
  draft: ObDraft;
  setDraft: (next: ObDraft) => void;
}

const ObDraftContext = createContext<ObDraftValue | null>(null);

export function ObDraftProvider({
  children,
  initial = EMPTY_OB_DRAFT,
}: {
  children: ReactNode;
  initial?: ObDraft;
}) {
  const [draft, setDraft] = useState<ObDraft>(initial);
  const value = useMemo(() => ({ draft, setDraft }), [draft]);
  return <ObDraftContext.Provider value={value}>{children}</ObDraftContext.Provider>;
}

export function useObDraft(): ObDraftValue {
  const ctx = useContext(ObDraftContext);
  if (!ctx) throw new Error('useObDraft must be used within an ObDraftProvider');
  return ctx;
}

/** Transcribed from ui-ux-prototype.html:1902-1908 (OB_STEPS). */
export const OB_STEPS = [
  { key: 'basic', title: 'Basic Info', sub: 'Name, industry, slogan' },
  { key: 'brand', title: 'Brand Identity', sub: 'Vibe and core services' },
  { key: 'structured', title: 'Structured Inputs', sub: 'Description and UVP' },
  { key: 'assets', title: 'Assets & Links', sub: 'Socials, logo, website' },
  { key: 'analysis', title: 'Analysis', sub: 'Categories and uniqueness' },
] as const;

/**
 * Step 3 — Structured Inputs (Card 6) word-count thresholds. Exported (not
 * kept private) since StructuredInputsStep.tsx imports these same constants
 * for its live word-count hints, and stepValid's case 2 below needs them too
 * — single source of truth rather than two independent copies.
 */
export type StructuredField = 'description' | 'uvp';

export const MIN_WORDS: Record<StructuredField, number> = {
  description: 50,
  uvp: 30,
};

export function wordCount(text: string): number {
  const trimmed = String(text ?? '').trim();
  return trimmed === '' ? 0 : trimmed.split(/\s+/).length;
}

/**
 * Per-step Continue gate — ports obValid() (ui-ux-prototype.html:1931-1939).
 *
 * Step 5 (index 4) is gated on `obPhase === 'scored'` in the prototype, which
 * is AnalysisStep's internal phase state rather than draft data. AnalysisStep
 * writes `categories`/`uniquenessScore` back into the draft the moment it
 * reaches 'scored' (and clears `uniquenessScore` back to null if the operator
 * reopens category selection afterward), so gating on
 * `draft.uniquenessScore != null` here is equivalent without threading
 * AnalysisStep's phase enum through the wizard shell.
 *
 * The one exception is a cohort too small to rank against: the API answers
 * successfully but there is no defensible number, so 'scored' is reached with
 * `uniquenessScore` still null. `cohortInsufficient` carries that case — see its
 * docblock on ObDraft above.
 */
export function stepValid(draft: ObDraft, index: number): boolean {
  switch (index) {
    case 0:
      return draft.businessName.trim().length > 1 && !!draft.industry;
    case 1:
      return draft.vibes.length > 0 && draft.coreServices.length > 0;
    case 2:
      return wordCount(draft.description) >= MIN_WORDS.description
          && wordCount(draft.uvp) >= MIN_WORDS.uvp; // Card 6 — Structured Inputs
    case 3:
      return true; // Assets & Links — every field optional
    case 4:
      // Either a real score, or an explicit "no rankable cohort" answer. Both
      // mean the operator has finished Step 5; only one of them has a number.
      return draft.uniquenessScore != null || draft.cohortInsufficient;
    default:
      return true;
  }
}