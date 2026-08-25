// ---- components/module-3/3.1-content-studio/VisualDirectionBoard.tsx ----
props: VisualDirectionSlotProps from './contentStudioTypes'  // { activePlatform }
// activePlatform arrives from the shell (M3-F1), not from AIContentMatrixPanel — this card
// no longer depends on M3-1.

guide ← content.captions[platform].guide  // re-renders whenever `platform` changes; no own tab control
render: numbered list of guide's shot-composition instructions
