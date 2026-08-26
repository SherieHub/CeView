/**
 * CARD — Performance: Previously Published & Post Analytics Modal
 * Depends on: Foundation — Performance Shell & Ingestion (M4-F), Module 3's Foundation — Shared Stores (M3-F0)
 * Plan: docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/05-module-4.md (M4-6)
 *
 * TODO:
 * - All/TikTok/Instagram/Facebook filter tabs over published posts (reads the
 *   shared post store Content Studio's Publish Action writes to — usePosts(),
 *   not a shell prop)
 * - Each row opens PostAnalyticsModal.tsx on click
 *
 * PreviouslyPublished.test.tsx: cover the platform filter tabs.
 */
export default function PreviouslyPublished() {
  return (
    <div className="empty flex h-full flex-col items-center justify-center gap-1 text-center">
      <h2 className="heading-lg">Previously Published</h2>
      <p className="body-sm">
        Not implemented yet — see CARD — Performance: Previously Published &amp; Post
        Analytics Modal in 05-module-4.md.
      </p>
    </div>
  );
}
