import { api } from './api';
import type { Operator } from './operator';

export interface DemandWindow {
  businessProfileId: string;
  demandAlertId: string;
  marketScoreId: string;
  attributionCodeId: string;
  code: string;
  linkId: string;
  slug: string;
  windowStart: string;
  windowEnd: string;
}

export interface DemandWindowOptions {
  category?: string;
  market?: 'korea' | 'japan' | 'usa';
  level?: 'WARNING' | 'CRITICAL';
  upliftPct?: number;
  /** Window open date. Defaults to 2 days ago, so the attribution code and link are LIVE now. */
  windowStart?: Date;
  /** Backdates the forecast (and its alert) by this many days — drives the stale-data banner. */
  staleDays?: number;
  yoyRatio?: number;
}

const DAY = 24 * 60 * 60 * 1000;

export function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * DAY);
}

/**
 * Seeds a demand window for `op` through POST /api/test-support/demand-window: ranked forecasts for
 * every market in one category, an alert on `market`, and that window's real attribution code and
 * tracked link (minted by the same services the forecast pipeline calls).
 */
export async function seedDemandWindow(op: Operator, opts: DemandWindowOptions = {}): Promise<DemandWindow> {
  return api().postOrThrow<DemandWindow>('/api/test-support/demand-window', {
    email: op.email,
    category: opts.category ?? op.categories[0],
    market: opts.market ?? 'korea',
    level: opts.level ?? 'WARNING',
    upliftPct: opts.upliftPct ?? 38,
    windowStart: (opts.windowStart ?? daysFromNow(-2)).toISOString(),
    staleDays: opts.staleDays ?? null,
    yoyRatio: opts.yoyRatio ?? null,
  });
}
