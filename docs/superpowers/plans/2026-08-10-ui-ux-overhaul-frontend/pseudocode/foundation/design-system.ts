// ---- styles/index.css ---- (CSS, not TS — kept in this file per 00-index.md's field guide)
import "tailwindcss"

@theme block: transcribed 1:1 from ui-ux-prototype.html:15-67's :root block
  brand/surface/ink/line/state/platform colors → --color-*
  radii → --radius-*
  shadows → --shadow-*
  spacing scale → --spacing-*

bare custom properties (outside @theme — Tailwind v4 has no "easing"/"sidebar width" namespace):
  --sidebar-w, --ease-brand

reset + typography helpers (ui-ux-prototype.html:70-110):
  .eyebrow, .h-xl/.h-lg/.h-md/.h-sm, .body-sm/.body-xs, .num, .mono, .sr
  focus-visible / selection styles

primitive component classes (.btn/.card/form primitives/.chip/.tabs/.bar/.switch/.check/.skel/
.toast/.modal/.drawer/.banner/.empty — ui-ux-prototype.html:112-302):
  added incrementally — each consuming screen card adds what it needs, as @layer components
  or inlined Tailwind utilities; decide per-primitive at implementation time

excluded entirely: .cs2-*, .prev-*, #devbar/.devbar-* (dropped v2 Content Studio / dev-only jump bar)

// ---- constants.ts (later card, noted here for the Design System decision it inherits) ----
COLORS: kept as resolved hex (Recharts needs hex, not CSS vars)
  // must match styles/index.css's @theme block — diff against it in review
