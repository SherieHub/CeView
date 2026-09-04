/**
 * CARD — Foundation: Performance Shell & Ingestion
 * Depends on: Foundation — Shell & Routing, Foundation — Fixture Data Layer
 * Plan: docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/05-module-4.md (M4-F)
 * Pseudocode: pseudocode/module-4/foundation-performance-shell.ts
 *
 * The 9 slot prop contracts every sibling card (M4-1 through M4-6) implements
 * against. metrics/flagged/score/label arrive pre-computed by
 * campaignMetrics.ts — slot components only render them.
 */
import type { CampaignInput, CampaignHistoryEntry, PrescriptiveReport } from '@/types';

export interface Metrics {
  ctr: number;
  cpc: number;
  convRate: number;
  roas: number;
  cac: number;
}

export type FlaggedMetric = 'CTR' | 'CPC' | 'Conversion rate' | 'ROAS' | 'CAC';

/** M4-1 — KPI Cards & Flagged Metrics */
export interface KpiSlotProps {
  metrics: Metrics;
  flagged: FlaggedMetric[];
}

/** M4-2 — PES Gauge */
export interface PesGaugeSlotProps {
  score: number;
  label: string;
  metrics: Metrics;
}

/** M4-3 — Customer Journey Funnel */
export interface FunnelSlotProps {
  input: CampaignInput;
}

/** M4-4 — Trend Charts */
export interface TrendSlotProps {
  window: CampaignHistoryEntry[];
  weeks: 4 | 8;
  onWeeksChange: (weeks: 4 | 8) => void;
}

/** M4-5 — AI Action Plan */
export interface ActionPlanSlotProps {
  report: PrescriptiveReport;
}
