import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { API_BASE } from './stack';
import { api } from './api';
import type { DemandWindow } from './demandWindow';
import type { Operator } from './operator';

/** A normal desktop browser UA — BotFilter drops headless / curl / Playwright signatures. */
export const DESKTOP_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

let ipCounter = 0;
/** A unique documentation-range IP, so BotFilter's 60 s same-link-same-IP debounce never fires. */
export function uniqueIp(): string {
  ipCounter += 1;
  const n = (Date.now() + ipCounter) % 250000;
  return `198.51.${Math.floor(n / 250) % 250}.${(n % 250) + 1}`;
}

export interface RecordedClick {
  status: number;
  /** Where the tracked link redirected the traveller. */
  location: string | null;
  /** The click id appended as `?cv=` — null for a suppressed (bot / repeat) click. */
  clickId: string | null;
}

/**
 * Follows a tracked ad link the way a traveller's browser would: GET /r/{slug} with ad macros.
 * Done from Node (not the test browser) because a headless browser UA is filtered as a bot.
 */
export async function recordClick(
  slug: string,
  opts: { ua?: string; ip?: string; params?: Record<string, string> } = {},
): Promise<RecordedClick> {
  const query = new URLSearchParams(opts.params ?? { cmp: '120210000000001', set: '120210000000002', ad: '120210000000003' });
  const res = await fetch(`${API_BASE}/r/${slug}?${query}`, {
    redirect: 'manual',
    headers: { 'User-Agent': opts.ua ?? DESKTOP_UA, 'X-Forwarded-For': opts.ip ?? uniqueIp() },
  });
  const location = res.headers.get('location');
  let clickId: string | null = null;
  if (location) {
    try {
      clickId = new URL(location).searchParams.get('cv');
    } catch {
      clickId = null;
    }
  }
  return { status: res.status, location, clickId };
}

/** A real click on `window`'s tracked link → the SPA enquiry URL (`/enquiry?cv=…`). */
export async function enquiryPath(window: Pick<DemandWindow, 'slug'>): Promise<{ path: string; clickId: string }> {
  const click = await recordClick(window.slug);
  if (!click.clickId) throw new Error(`click was not recorded (HTTP ${click.status}, location ${click.location})`);
  return { path: `/enquiry?cv=${click.clickId}`, clickId: click.clickId };
}

export interface EnquiryFields {
  contactName?: string;
  contactValue?: string;
  partySize?: number;
  requestedStart?: string;
  requestedEnd?: string;
  message?: string;
}

/** POST /api/public/attribution/enquiries (the traveller's side — no login). */
export async function submitEnquiry(clickId: string, fields: EnquiryFields = {}) {
  await reserveEnquiryCalls(1);
  return api().post('/api/public/attribution/enquiries', {
    clickId,
    contactName: fields.contactName ?? 'Test Traveller',
    contactValue: fields.contactValue ?? 'traveller@example.com',
    ...fields,
  });
}

// The traveller-facing enquiry endpoints (GET …/context and POST …/enquiries) share a hard-coded
// 30-requests-per-clock-minute limit per remote address (AttributionRateLimiter), and every test
// worker reaches the backend from the same address. This is a cross-process budget so parallel specs
// never trip it: reserve before calling, and the call waits for the next minute if the budget is spent.
const ENQUIRY_BUDGET_PER_MINUTE = 22;
const BUDGET_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '.cache');
const BUDGET_FILE = join(BUDGET_DIR, 'enquiry-budget.json');
const BUDGET_LOCK = join(BUDGET_DIR, 'enquiry-budget.lock');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function withBudgetLock<T>(fn: () => T): Promise<T> {
  mkdirSync(BUDGET_DIR, { recursive: true });
  for (let i = 0; i < 600; i++) {
    try {
      mkdirSync(BUDGET_LOCK);
      try {
        return fn();
      } finally {
        rmSync(BUDGET_LOCK, { recursive: true, force: true });
      }
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e;
      try {
        if (Date.now() - statSync(BUDGET_LOCK).mtimeMs > 10_000) rmSync(BUDGET_LOCK, { recursive: true, force: true });
      } catch {
        /* released meanwhile */
      }
      await sleep(25 + Math.random() * 50);
    }
  }
  throw new Error('could not take the enquiry-budget lock');
}

/** Reserves `n` requests against the shared enquiry rate limit, waiting for the next minute if needed. */
export async function reserveEnquiryCalls(n = 1): Promise<void> {
  for (;;) {
    const waitMs = await withBudgetLock(() => {
      const minute = Math.floor(Date.now() / 60_000);
      const state = existsSync(BUDGET_FILE) ? (JSON.parse(readFileSync(BUDGET_FILE, 'utf8')) as { minute: number; used: number }) : { minute, used: 0 };
      if (state.minute !== minute) {
        state.minute = minute;
        state.used = 0;
      }
      if (state.used + n <= ENQUIRY_BUDGET_PER_MINUTE) {
        state.used += n;
        writeFileSync(BUDGET_FILE, JSON.stringify(state));
        return 0;
      }
      return (minute + 1) * 60_000 - Date.now() + 1500;
    });
    if (waitMs === 0) return;
    await sleep(waitMs);
  }
}

/** A fresh random UUID that no click carries. */
export const unknownClickId = () => randomUUID();

/** GET /api/attribution/enquiries as the operator. */
export async function listEnquiries(op: Operator) {
  return api(op.token).getOrThrow<
    { enquiryId: string; contactName: string; contactValue: string; partySize: number | null; message: string | null }[]
  >('/api/attribution/enquiries');
}

// ── bookings / attribution codes ──────────────────────────────────────────────

export interface CodeSummary {
  attributionCodeId: string;
  code: string;
  category: string;
  targetMarket: string;
  windowStart: string;
  windowEnd: string;
  status: 'UPCOMING' | 'LIVE' | 'ENDED';
  totalBookings: number;
  totalRevenue: number;
  byKind: { kind: string; bookings: number; revenue: number }[];
}

export const codesOf = (op: Operator) => api(op.token).getOrThrow<CodeSummary[]>('/api/attribution/codes');

/** POST /api/attribution/redemptions — the operator logging a booking against a code (or a click). */
export function logRedemption(
  op: Operator,
  body: { attributionCodeId?: string; clickId?: string; bookings?: number; revenue?: number; eventAt?: string },
) {
  return api(op.token).post('/api/attribution/redemptions', body);
}

export const redemptionsOf = (op: Operator) =>
  api(op.token).getOrThrow<
    { redemptionId: string; code: string | null; bookings: number; revenue: number; kind: string; source?: string }[]
  >('/api/attribution/redemptions');
