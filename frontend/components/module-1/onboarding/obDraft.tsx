/**
 * CARD — Onboarding: Wizard Shell & Step 1 Basic Info
 * Depends on: Foundation — Shell & Routing
 * Plan: docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/02-module-1.md
 * Pseudocode: pseudocode/module-1/wizard-shell-step-1.ts
 *
 * The wizard-wide draft state — a subset of types.ts's BusinessProfile covering
 * only the fields the 5-step onboarding wizard collects. Mirrors
 * services/profileContext.tsx's ProfileProvider pattern (plain useState +
 * context), kept as its own module since the draft is scratch state local to
 * the wizard, not the operator's committed BusinessProfile — Step 5 (a later
 * card) is what eventually merges a finished draft into useProfile()'s
 * setProfile(). Named .tsx (not .ts, despite the card text) since
 * ObDraftProvider renders JSX.
 */
import { createContext, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

export type StructuredField = 'description' | 'uvp';

export const MIN_WORDS: Record<StructuredField, number> = {
  description: 50,
  uvp: 30,
};

export function wordCount(text: string): number {
  const trimmed = String(text ?? '').trim();
  return trimmed === '' ? 0 : trimmed.split(/\s+/).length;
}

export interface ObDraft {
  businessName: string;
  industry: string;
  slogan: string;
  /** Step 2 — Brand Identity (Card 5). */
  vibes: string[];
  coreServices: string[];
  /** Step 3 — Structured Inputs (Card 6). */
  description: string;
  uvp: string;
  /** Step 4 — Assets & Links (Card 7). */
  socials: Record<string, string>;
  logo: string | null;
  website: string;
}

export const EMPTY_DRAFT: ObDraft = {
  businessName: '',
  industry: '',
  slogan: '',
  vibes: [],
  coreServices: [],
  description: '',
  uvp: '',
  socials: {},
  logo: null,
  website: '',
};

interface ObDraftContextValue {
  draft: ObDraft;
  setDraft: (draft: ObDraft) => void;
}

const ObDraftContext = createContext<ObDraftContextValue | null>(null);

export function ObDraftProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<ObDraft>(EMPTY_DRAFT);
  const value = useMemo(() => ({ draft, setDraft }), [draft]);
  return <ObDraftContext.Provider value={value}>{children}</ObDraftContext.Provider>;
}

export function useObDraft(): ObDraftContextValue {
  const ctx = useContext(ObDraftContext);
  if (!ctx) throw new Error('useObDraft must be used within an ObDraftProvider');
  return ctx;
}

/**
 * Per-step Continue gate. Only step 0 (Basic Info) is implemented by this
 * card — steps 1/2/4 are hardcoded false placeholders until Cards 5/6/8 land
 * with their own real validity rules; step 3 (Assets & Links) has no gate at
 * all per the prototype (obValid(3) === true — every field there is optional).
 */
export function stepValid(step: number, draft: ObDraft): boolean {
  switch (step) {
    case 0:
      return draft.businessName.trim().length > 1 && !!draft.industry;
    case 1:
      return false; // Card 5 — Brand Identity
    case 2:
      return wordCount(draft.description) >= MIN_WORDS.description
          && wordCount(draft.uvp) >= MIN_WORDS.uvp; // Card 6 — Structured Inputs
    case 3:
      return true; // Card 7 — Assets & Links, no gate
    case 4:
      return false; // Card 8 — Analysis
    default:
      return false;
  }
}