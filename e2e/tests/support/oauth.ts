import type { Page } from '@playwright/test';
import { api } from './api';
import { FAKE_META_URL, setScenario, type MetaScenario } from './fakeMeta';
import type { Operator } from './operator';

/** POST /api/ad-connections/{provider}/authorize → the consent URL and its one-time state. */
export async function authorize(op: Operator, provider: 'meta' | 'tiktok') {
  const { authorizeUrl } = await api(op.token).postOrThrow<{ authorizeUrl: string }>(
    `/api/ad-connections/${provider}/authorize`,
  );
  const state = new URL(authorizeUrl).searchParams.get('state');
  if (!state) throw new Error(`no state in ${authorizeUrl}`);
  return { authorizeUrl, state };
}

/**
 * Runs Meta's consent dialog (the fake) for `authorizeUrl` without a browser and returns where Meta
 * sends the user back — the backend callback URL with `code`/`state`, or `error`.
 */
export async function runMetaDialog(authorizeUrl: string): Promise<URL> {
  const res = await fetch(authorizeUrl, { redirect: 'manual' });
  const location = res.headers.get('location');
  if (res.status !== 302 || !location) throw new Error(`dialog answered HTTP ${res.status}`);
  return new URL(location);
}

export interface MetaConnectOptions {
  scenario?: MetaScenario;
  /** Facebook Page to select for publishing (fake page id); omit to stop at "choose a Page". */
  pageId?: string | null;
  /** Ad account to select (fake `act_…` id); omit to leave the ads connection pending. */
  adAccountId?: string | null;
}

/**
 * Connects `op` to (fake) Meta through the real backend API — authorize, consent, code exchange,
 * then the optional Page and ad-account selections — exactly the calls the Settings UI makes.
 */
export async function connectMetaViaApi(op: Operator, opts: MetaConnectOptions = {}) {
  const client = api(op.token);
  const { authorizeUrl, state } = await authorize(op, 'meta');
  await setScenario(state, opts.scenario ?? {});
  const back = await runMetaDialog(authorizeUrl);
  const code = back.searchParams.get('code');
  if (!code) throw new Error(`Meta consent returned no code: ${back}`);
  await client.postOrThrow('/api/ad-connections/meta/complete', { code, state });
  if (opts.pageId) await client.putOrThrow('/api/social-connections/meta/page', { pageId: opts.pageId });
  if (opts.adAccountId) {
    await client.postOrThrow('/api/ad-connections/meta/account', { externalAccountId: opts.adAccountId });
  }
}

/**
 * Lets the browser walk the real consent redirect chain, registering `scenario` for whatever state
 * the backend minted. Only the provider's own dialog is intercepted (to read the state); the request
 * still goes to the fake Meta server.
 */
export async function routeMetaDialog(page: Page, scenario: MetaScenario = {}) {
  await page.route(`${FAKE_META_URL}/**/dialog/oauth**`, async (route) => {
    const state = new URL(route.request().url()).searchParams.get('state');
    if (state) await setScenario(state, scenario);
    await route.continue();
  });
}

/** Opens Settings → Platforms with the query an OAuth return would carry. */
export async function gotoPlatformsReturn(page: Page, params: Record<string, string>) {
  await page.goto(`/settings/platforms?${new URLSearchParams(params)}`);
}
