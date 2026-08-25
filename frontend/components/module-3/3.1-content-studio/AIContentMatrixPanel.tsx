/**
 * CARD — Content Studio: AI Copywriting Matrix (incl. Naver)
 * Depends on: Foundation — Content Studio Shell (M3-F1)
 * Screen doc: docs/module-3/screens/content-studio.md
 * Plan: docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/04-module-3.md (M3-1)
 *
 * Reminder: builds prototype v1 (screen-content / renderContent) only.
 * screen-content2 is a superseded draft — not built, not referenced here.
 *
 * TODO:
 * - Platform tabs (Instagram/TikTok/Facebook/Naver), gold dot on any tab with an
 *   approved option
 * - 3 archetype option cards per platform (Witty/Formal/Storytelling), except Naver —
 *   exactly 2 curated long-form Korean editorial templates + info banner
 *   (ui-ux-prototype.html:2953–2956) — this Naver branch is new work, doesn't exist yet
 * - Per-option: editable textarea (inline edits persist per option), live char counter
 *   against PLATFORM_CHAR_LIMITS (red over limit), "Why this caption" disclosure (5
 *   metadata dimensions), Approve button
 * - Approving stages the text into the composer's `staged` field and clears any existing
 *   audit result
 *
 * AIContentMatrixPanel.test.tsx: per-platform independence and the Naver 2-option branch.
 */
export default function AIContentMatrixPanel() {
  return (
    <div className="card empty flex h-full flex-col items-center justify-center gap-1 text-center">
      <h2 className="heading-lg">AI Copywriting Matrix</h2>
      <p className="body-sm">
        Not implemented yet — see CARD — Content Studio: AI Copywriting Matrix (incl.
        Naver) in 04-module-3.md.
      </p>
    </div>
  );
}
