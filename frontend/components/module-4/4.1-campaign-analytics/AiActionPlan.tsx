/**
 * CARD — Performance: AI Action Plan
 * Depends on: Foundation — Performance Shell & Ingestion (M4-F)
 * Plan: docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/05-module-4.md (M4-5)
 *
 * TODO:
 * - Executive summary card
 * - 3 funnel diagnostics rendered in report order (Weakest/Moderate/Alright — not
 *   re-sorted by raw drop-size)
 * - Each diagnostic paired with a recommendation card + urgency chip
 *
 * AiActionPlan.test.tsx: cover diagnostics rendered in report order and the
 * diagnostic<->recommendation pairing.
 */
import type { ActionPlanSlotProps } from './campaignTypes';

export default function AiActionPlan(_props: ActionPlanSlotProps) {
  return (
    <div className="empty flex h-full flex-col items-center justify-center gap-1 text-center">
      <h2 className="heading-lg">AI Action Plan</h2>
      <p className="body-sm">
        Not implemented yet — see CARD — Performance: AI Action Plan in 05-module-4.md.
      </p>
    </div>
  );
}
