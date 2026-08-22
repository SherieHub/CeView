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
}

export const EMPTY_OB_DRAFT: ObDraft = {
  businessName: '',
  industry: '',
  slogan: '',
  vibes: [],
  coreServices: [],
  description: '',
  uvp: '',
  socials: { instagram: '', tiktok: '', facebook: '', naver: '' },
  logo: null,
  website: '',
};

/**
 * Demo business — ports obPrefill() (ui-ux-prototype.html:2023–2035). Used by
 * the dev preview route and by tests that need steps 1–3 to already satisfy
 * stepValid() so later steps are reachable.
 */
export const DEMO_OB_DRAFT: ObDraft = {
  businessName: 'Sunset Cove Beach Resort',
  industry: 'Accommodation & Staycation',
  slogan: 'Rest, thirty metres from the sardine run.',
  vibes: ['Serene & Restorative', 'Eco-Conscious'],
  coreServices: ['Scuba Diving', 'Island Hopping', 'Snorkeling', 'Beachfront Villas'],
  description:
    'Sunset Cove Beach Resort sits on the quiet southern stretch of Moalboal, a short walk from ' +
    'the sardine run that draws divers from across the world. We run a small beachfront property ' +
    'of twelve villas, a dive shop staffed entirely by local guides, and a kitchen that sources ' +
    'its fish and produce from the municipality every morning. Guests come for the reef and stay ' +
    'for the pace: no crowds, no scheduled entertainment, just clear water and long evenings.',
  uvp:
    'The only Moalboal resort where every dive guide is a Moalboal native, house reef access is ' +
    'thirty metres from the villa door, and the entire kitchen is sourced within the municipality ' +
    'each morning rather than trucked in from Cebu City.',
  socials: {
    instagram: '@sunsetcove.ph',
    tiktok: '@sunsetcove',
    facebook: 'SunsetCoveMoalboal',
    naver: '',
  },
  logo: null,
  website: 'https://sunsetcove.ph',
};

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
 * Step 5 (index 4) is gated in the prototype on `obPhase === 'scored'`, which
 * is AnalysisStep's internal state rather than draft data. AnalysisStep is
 * still a stub, so this returns false there: the wizard correctly refuses to
 * finish until the analysis card lands.
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
      return false; // TODO(AnalysisStep): true once obPhase === 'scored'
    default:
      return true;
  }
}