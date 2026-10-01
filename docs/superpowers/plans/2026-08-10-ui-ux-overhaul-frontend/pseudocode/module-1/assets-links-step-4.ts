// ---- components/module-1/onboarding/steps/AssetsLinksStep.tsx ----
imports: useState, useObDraft

const PLATFORM_META: [{platform, icon, brandColor, label}] for each known platform

function AssetsLinksStep():
  { draft, setDraft } ← useObDraft()
  state: dragOver ← false

  handleFile(file):
    read file via FileReader → onload: setDraft({...draft, logo: dataURL})

  render: one text input per PLATFORM_META entry, bound to draft.socials[platform] +
          logo dropzone (click opens file picker; drag-over highlights; drop/pick calls
          handleFile; shows draft.logo preview if set, else empty-state prompt) +
          website text input

  // no validity gate — Continue always enabled regardless of field contents

// ---- components/module-1/onboarding/obDraft.ts (no change) ----
stepValid case 3 (Step 4): stays `true` — no gate
