// ---- components/module-3/3.1-content-studio/VisualDirectionBoard.tsx ----
props: { platform, content }  // platform read from Card 15's shared state, not local

guide ← content.captions[platform].guide  // re-renders whenever `platform` changes; no own tab control
render: numbered list of guide's shot-composition instructions
