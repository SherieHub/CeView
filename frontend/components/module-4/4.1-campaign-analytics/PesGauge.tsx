/**
 * CARD — Performance: PES Gauge
 * Depends on: Foundation — Performance Shell & Ingestion (M4-F)
 * Plan: docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/05-module-4.md (M4-2)
 *
 * TODO:
 * - Radial gauge (0.00-1.00), qualitative label band
 * - Per-metric contribution-breakdown bars, derived from `metrics` (weights:
 *   ROAS 35% / convRate 30% / CAC 15% / CTR 15% / CPC 5%)
 * - Formula footer shown verbatim
 *
 * PesGauge.test.tsx: cover all 4 label bands and the contribution-bar weights.
 */
import type { PesGaugeSlotProps } from './campaignTypes';

export default function PesGauge(_props: PesGaugeSlotProps) {
  return (
    <div className="empty flex h-full flex-col items-center justify-center gap-1 text-center">
      <h2 className="heading-lg">PES Gauge</h2>
      <p className="body-sm">
        Not implemented yet — see CARD — Performance: PES Gauge in 05-module-4.md.
      </p>
    </div>
  );
}
