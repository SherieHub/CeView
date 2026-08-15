// ---- components/module-1/onboarding/steps/BrandIdentityStep.tsx ----
imports: useRef, useState, useObDraft

const VIBES: [8 fixed vibe options]

function BrandIdentityStep():
  { draft, setDraft } ← useObDraft()
  state: tagInput ← '', inputRef

  toggleVibe(vibe):
    // multi-select, no minimum enforced by the chip itself — stepValid() enforces >=1
    vibes ← draft.vibes includes vibe ? remove it : append it
    setDraft({...draft, vibes})

  on tag input Enter key:
    value ← tagInput.trim()
    if empty or already in coreServices → skip
    else → setDraft({...draft, coreServices: [...coreServices, value]}); clear tagInput; refocus input

  removeService(service):
    setDraft({...draft, coreServices: coreServices without service})

  render: chip grid (8 VIBES, each toggle-pressed per draft.vibes) +
          tag input (Enter to add) +
          tag list (each with a ✕ remove button)

// ---- components/module-1/onboarding/obDraft.ts (extension) ----
stepValid case 1 (Step 2): draft.vibes.length >= 1 AND draft.coreServices.length >= 1
