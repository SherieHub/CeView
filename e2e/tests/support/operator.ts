import type { Page } from '@playwright/test';
import { api } from './api';
import { seedDemandWindow, type DemandWindow, type DemandWindowOptions } from './demandWindow';
import { E2E_PASSWORD, latestEmailCode, registerViaApi } from './stack';

export type Stage = 'unverified' | 'verified' | 'onboarded';

export interface Operator {
  email: string;
  password: string;
  token: string;
  emailVerified: boolean;
  businessProfileId: string | null;
  businessName: string;
  categories: string[];
  uniquenessScore: number | null;
  /** Set when provisioned with `demandWindow`. */
  window?: DemandWindow;
}

export interface ProvisionOptions {
  stage?: Stage;
  categories?: string[];
  /** 0–1, as stored. `null` keeps the profile un-scored, so ProfileGate sends it to /onboarding. */
  uniquenessScore?: number | null;
  businessName?: string;
  firstName?: string;
  lastName?: string;
  coreServices?: string[];
  description?: string;
  uvp?: string;
  /** Profile photo / logo as a data URL (stored as `imagePreview`). */
  imagePreview?: string | null;
  /**
   * Seeds a ranked forecast + demand alert + attribution code/link (onboarded stage only). Without
   * one a new operator has no forecast, and every /dashboard visit would start the live pipeline.
   */
  demandWindow?: boolean | DemandWindowOptions;
}

/** 60 words — clears the onboarding / settings 50-word description floor. */
export const PROFILE_DESCRIPTION =
  'Family-run dive shop on Panagsama Beach in Moalboal offering guided reef dives, sardine run snorkel ' +
  'trips and open water courses for small groups. Our instructors are local and have dived these walls ' +
  'for over fifteen years, so every trip is planned around tides, currents and the turtles that rest ' +
  'along the house reef each morning before the boats arrive from town.';

/** 40 words — clears the 30-word UVP floor. */
export const PROFILE_UVP =
  'The only Moalboal shop that caps every boat at four divers and pairs each group with a marine ' +
  'biologist guide, so guests learn to read the reef, spot frogfish and nudibranchs, and leave with ' +
  'their own logged species list.';

let counter = 0;

/** `e2e-<screen>-<ts>-<n><rand>@ceview.local` — unique across workers and reruns. */
export function uniqueEmail(screen: string): string {
  counter += 1;
  const rand = Math.random().toString(36).slice(2, 6);
  return `e2e-${screen}-${Date.now()}-${process.pid}${counter}${rand}@ceview.local`;
}

/**
 * Creates a brand-new operator through the real API and walks it to `stage`:
 *  - unverified: registered only (lands on /verify-email)
 *  - verified:   email verified, no business profile (lands on /onboarding)
 *  - onboarded:  plus a saved, scored business profile (ProfileGate lets it into the app); written
 *                through the test-support hook so no Hugging Face embedding run is spent
 */
export async function provisionOperator(screen: string, opts: ProvisionOptions = {}): Promise<Operator> {
  const stage = opts.stage ?? 'onboarded';
  const email = uniqueEmail(screen);
  const password = E2E_PASSWORD;
  const token = await registerViaApi(email, password, { firstName: opts.firstName, lastName: opts.lastName });
  const client = api(token);
  const op: Operator = {
    email,
    password,
    token,
    emailVerified: false,
    businessProfileId: null,
    businessName: opts.businessName ?? `E2E ${screen} Dive Co`,
    categories: opts.categories ?? ['Coastal & Island'],
    uniquenessScore: null,
  };
  if (stage === 'unverified') return op;

  // Registration already emailed a code; a 429 here is the resend cooldown and the hook still
  // returns that first code.
  const send = await client.post('/api/auth/email-verification/send');
  if (send.status !== 202 && send.status !== 429) throw new Error(`send code: HTTP ${send.status}`);
  await client.postOrThrow('/api/auth/email-verification/verify', { code: await latestEmailCode(email) });
  op.emailVerified = true;
  if (stage === 'verified') return op;

  const score = opts.uniquenessScore === undefined ? 0.62 : opts.uniquenessScore;
  // Seeded through the test-support hook, NOT PUT /api/business-profile: that endpoint embeds the
  // profile through the Hugging Face Space, spending a ZeroGPU run per operator.
  const saved = await api().postOrThrow<{ businessProfileId: string }>('/api/test-support/business-profile', {
    email,
    businessName: op.businessName,
    categories: op.categories,
    coreServices: opts.coreServices ?? ['Guided reef dives', 'Sardine run snorkel trips'],
    description: opts.description ?? PROFILE_DESCRIPTION,
    uvp: opts.uvp ?? PROFILE_UVP,
    imagePreview: opts.imagePreview ?? null,
    uniquenessScore: score,
  });
  op.businessProfileId = saved.businessProfileId;
  op.uniquenessScore = score;
  if (opts.demandWindow) {
    op.window = await seedDemandWindow(op, opts.demandWindow === true ? {} : opts.demandWindow);
  }
  return op;
}

/** What AuthProvider persists after a successful login (services/authStorage.ts). */
export function storedSession(op: Operator, overrides: Record<string, unknown> = {}) {
  const session: Record<string, unknown> = {
    accessToken: op.token,
    profileCompleted: true,
    emailVerified: op.emailVerified,
    email: op.email,
    ...overrides,
  };
  // An explicit undefined means "leave the key out" (a session stored before the field existed).
  for (const k of Object.keys(session)) if (session[k] === undefined) delete session[k];
  return session;
}

/**
 * Puts `op`'s session into localStorage the way a real sign-in does, then opens `path`. Seeds from
 * /terms because it is public and not redirect-guarded, so nothing navigates away mid-write. Uses a
 * one-off write rather than addInitScript so a later sign-out in the test really sticks.
 */
export async function signIn(
  page: Page,
  op: Operator,
  path = '/dashboard',
  sessionOverrides: Record<string, unknown> = {},
) {
  await page.goto('/terms');
  await page.evaluate((s) => localStorage.setItem('ceview.auth', JSON.stringify(s)), storedSession(op, sessionOverrides));
  await page.goto(path);
}

/** Signs in through the real login form. */
export async function signInViaUi(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}

/**
 * Rewrites an onboarded operator's saved business profile through the test-support hook (merging
 * `patch` over what is stored), without the embedding call a normal save would make.
 */
export async function updateProfile(
  op: Operator,
  patch: Partial<{
    businessName: string;
    categories: string[];
    coreServices: string[];
    description: string;
    uvp: string;
    imagePreview: string | null;
    uniquenessScore: number | null;
  }>,
) {
  const current = await api(op.token).getOrThrow('/api/business-profile');
  const next = { ...current, ...patch };
  await api().postOrThrow('/api/test-support/business-profile', {
    email: op.email,
    businessName: next.businessName,
    categories: next.categories,
    coreServices: next.coreServices,
    description: next.description,
    uvp: next.uvp,
    imagePreview: next.imagePreview,
    uniquenessScore: next.uniquenessScore,
  });
  if (patch.categories) op.categories = patch.categories;
  if (patch.businessName) op.businessName = patch.businessName;
}
