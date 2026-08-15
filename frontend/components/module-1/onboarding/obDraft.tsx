/**
 * CARD — Onboarding: Wizard Shell & Step 1 Basic Info
 * Wizard-wide draft state: the full obDraft shape carried across all five
 * onboarding steps, plus the step-validity gate. Only the Step 1 branch
 * (case 0) is implemented this card — cases 1/2/4 are placeholders until
 * Cards 5/6/8 (02-module-1.md) land.
 */
import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

export interface ObDraft {
  businessName: string;
  industry: string;
  slogan: string;
  vibes: string[];
  coreServices: string[];
  description: string;
  uvp: string;
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
  return <ObDraftContext.Provider value={{ draft, setDraft }}>{children}</ObDraftContext.Provider>;
}

export function useObDraft(): ObDraftContextValue {
  const ctx = useContext(ObDraftContext);
  if (!ctx) throw new Error('useObDraft must be used within an ObDraftProvider');
  return ctx;
}

/** Per-step Continue gate. Steps 2, 3, 5 are placeholders until their own cards land. */
export function stepValid(step: number, draft: ObDraft): boolean {
  switch (step) {
    case 0: // Step 1 — Basic Info (this card)
      return draft.businessName.trim().length > 1 && !!draft.industry;
    case 1: // Step 2 — Brand Identity (Card 5)
      return false;
    case 2: // Step 3 — Structured Inputs (Card 6)
      return false;
    case 3: // Step 4 — Assets & Links (Card 7) — no gate
      return true;
    case 4: // Step 5 — Analysis (Card 8)
      return false;
    default:
      return false;
  }
}
