/**
 * CARD — Content Studio: Content Board & Publish Action
 * Depends on: Card 17 (Publish Composer), Card 18 (Compliance Audit Panel)
 * Plan: docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/04-module-3.md
 *
 * TODO:
 * - All/Draft/Published tabs, cards show platform dot, status chip, date, caption
 *   excerpt, reach/likes footer if published
 * - Publish action — appends one post per selected platform to the shared post store
 *   (today's date, status: 'published'), clears composer transient state
 *   (publishPlatforms, agreed, omcs) while leaving each platform's approved caption intact
 * - The shared post store this writes to is also read by Calendar (Card 20) and
 *   Performance (Card 27)
 *
 * ContentBoard.test.tsx: the filter tabs and the publish-appends-N-posts behavior.
 */
export default function ContentBoard() {
  return (
    <div className="card empty flex h-full flex-col items-center justify-center gap-1 text-center">
      <h2 className="h-lg">Content Board</h2>
      <p className="body-sm">
        Not implemented yet — see CARD — Content Studio: Content Board &amp; Publish
        Action in 04-module-3.md.
      </p>
    </div>
  );
}
