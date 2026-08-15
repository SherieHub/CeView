/**
 * CARD — Content Studio: Publish Composer (connection-gated)
 * Depends on: Card 15 (AI Copywriting Matrix), Settings — Platforms (Card 22)
 * Plan: docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/04-module-3.md
 *
 * TODO:
 * - Staged caption textarea (editable independently of approved options), char count
 * - Pubmat dropzone (drag/click, PNG/JPG/WEBP <=20MB, preview + remove)
 * - Publish-to platform picker — deviation from prototype v1: platforms not connected
 *   in Settings -> Platforms render disabled with an inline "Connect" affordance, not
 *   freely selectable
 * - 3 post-config switches (visibility/comments/paid)
 * - Authorization checkbox — checking it (with caption + media staged) triggers the
 *   audit (CompliancePanel.tsx, Card 18)
 * - Publish button — disabled tooltip always shows the first unmet reason, in order:
 *   caption staged -> media uploaded -> >=1 platform selected AND connected -> agreement
 *   checked -> audit not running -> audit has run -> audit passed
 *
 * PublishComposer.test.tsx: full block-reason ladder, one case per rung.
 */
export default function PublishComposer() {
  return (
    <div className="card empty flex h-full flex-col items-center justify-center gap-1 text-center">
      <h2 className="h-lg">Publish Composer</h2>
      <p className="body-sm">
        Not implemented yet — see CARD — Content Studio: Publish Composer
        (connection-gated) in 04-module-3.md.
      </p>
    </div>
  );
}
