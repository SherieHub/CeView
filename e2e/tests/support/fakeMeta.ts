import http from 'node:http';
import { URL } from 'node:url';

/**
 * A stand-in for Meta (OAuth dialog + Graph API) on :4510 — the only thing faked in the e2e stack.
 * docker-compose.e2e.yml points the real backend at it (META_GRAPH_BASE_URL, META_DIALOG_URL), so
 * the backend's own Meta clients (MetaAdsClient, MetaGraphClient, MetaOrganicDeliveryClient,
 * MetaAdDeliveryClient) run unchanged against it.
 *
 * Scenarios are per connection, so parallel tests never see each other's switches: a test registers
 * a scenario for an OAuth `state` (POST /__e2e/scenario), the dialog bakes the scenario id into the
 * `code`, and every token minted from it — user, long-lived, Page — carries the id too.
 */

export const FAKE_META_PORT = Number(process.env.E2E_FAKE_META_PORT || 4510);
export const FAKE_META_URL = `http://localhost:${FAKE_META_PORT}`;

export interface FakePage {
  id: string;
  name: string;
  instagram?: { id: string; username: string };
}

export interface MetaScenario {
  /** The consent dialog answers ?error=access_denied instead of a code. */
  deny?: boolean;
  /** Code → token exchange fails (Graph 400). */
  exchangeFails?: boolean;
  /** Permissions reported as granted by /me/permissions. Defaults to everything CeView requests. */
  scopes?: string[];
  pages?: FakePage[];
  adAccounts?: { id: string; name: string; currency: string }[];
  campaigns?: { id: string; name: string; status: string }[];
  /** Account-level insights; null = Meta returns no rows. */
  insights?: { impressions: number; clicks: number; spend: string; leads: number } | null;
  /** Every publish call (Page photo/video, Instagram container, ad objects) fails with this message. */
  publishError?: string | null;
  /** Instagram container status_code. */
  instagramStatus?: 'FINISHED' | 'IN_PROGRESS' | 'ERROR';
  /** Graph code 190 on every token-bearing call (revoked token). */
  tokenRevoked?: boolean;
}

export const ALL_SCOPES = [
  'ads_read', 'ads_management', 'business_management',
  'pages_show_list', 'pages_read_engagement', 'pages_manage_posts', 'read_insights',
  'instagram_basic', 'instagram_content_publish', 'instagram_manage_insights',
];

export const DEFAULT_PAGES: FakePage[] = [
  { id: '1110001', name: 'E2E Reef Divers', instagram: { id: '1780001', username: 'e2e_reef_divers' } },
  { id: '1110002', name: 'E2E Beach Shack', },
];

const DEFAULT_SCENARIO: Required<Omit<MetaScenario, 'insights' | 'publishError'>> &
  Pick<MetaScenario, 'insights' | 'publishError'> = {
  deny: false,
  exchangeFails: false,
  scopes: ALL_SCOPES,
  pages: DEFAULT_PAGES,
  adAccounts: [{ id: 'act_5550001', name: 'E2E Reef Ads', currency: 'PHP' }],
  campaigns: [
    { id: '6660001', name: 'E2E Korea Winter Push', status: 'ACTIVE' },
    { id: '6660002', name: 'E2E Japan Spring', status: 'PAUSED' },
  ],
  insights: { impressions: 12000, clicks: 340, spend: '1500.50', leads: 12 },
  publishError: null,
  instagramStatus: 'FINISHED',
  tokenRevoked: false,
};

const scenarios = new Map<string, MetaScenario>();
const stateToScenario = new Map<string, string>();
let seq = 0;

function scenarioFor(sid: string | undefined) {
  return { ...DEFAULT_SCENARIO, ...(sid ? scenarios.get(sid) : {}) };
}

/** Scenario id carried by any token or code this server minted: `<kind>.<sid>[.<extra>]`. */
function sidOf(token: string | null | undefined): string | undefined {
  const m = token?.match(/^[a-z]+\.(s\d+)/);
  return m?.[1];
}

function send(res: http.ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

function graphError(res: http.ServerResponse, status: number, message: string, code = 100) {
  send(res, status, { error: { message, type: 'OAuthException', code } });
}

async function readBody(req: http.IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  return Buffer.concat(chunks).toString('utf8');
}

let nextId = 9000000;
const id = () => String(++nextId);

async function handle(req: http.IncomingMessage, res: http.ServerResponse) {
  const url = new URL(req.url ?? '/', FAKE_META_URL);
  const path = url.pathname.replace(/^\/v\d+\.\d+/, '');
  const method = req.method ?? 'GET';

  // ── test control ───────────────────────────────────────────────────────────
  if (path === '/__e2e/health') return send(res, 200, { ok: true });
  if (path === '/__e2e/scenario' && method === 'POST') {
    const { state, scenario } = JSON.parse((await readBody(req)) || '{}') as { state: string; scenario: MetaScenario };
    const sid = `s${++seq}`;
    scenarios.set(sid, scenario ?? {});
    stateToScenario.set(state, sid);
    return send(res, 200, { sid });
  }

  // ── consent dialog (browser-facing) ────────────────────────────────────────
  if (path === '/dialog/oauth') {
    const redirect = url.searchParams.get('redirect_uri');
    const state = url.searchParams.get('state') ?? '';
    if (!redirect) return send(res, 400, { error: 'redirect_uri required' });
    const sid = stateToScenario.get(state) ?? `s${++seq}`;
    if (!scenarios.has(sid)) scenarios.set(sid, {});
    const back = new URL(redirect);
    if (scenarioFor(sid).deny) {
      back.searchParams.set('error', 'access_denied');
      back.searchParams.set('error_reason', 'user_denied');
    } else {
      back.searchParams.set('code', `code.${sid}.${id()}`);
    }
    back.searchParams.set('state', state);
    res.writeHead(302, { Location: back.toString() });
    return res.end();
  }

  // ── Graph API ──────────────────────────────────────────────────────────────
  const bearer = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  const token = url.searchParams.get('access_token') ?? url.searchParams.get('fb_exchange_token') ?? bearer;

  if (path === '/oauth/access_token') {
    const code = url.searchParams.get('code');
    const sid = sidOf(code ?? token);
    const sc = scenarioFor(sid);
    if (sc.exchangeFails || (code && !sid)) return graphError(res, 400, 'Invalid verification code format.');
    const kind = code ? 'short' : 'long';
    return send(res, 200, { access_token: `${kind}.${sid}`, token_type: 'bearer', expires_in: 5184000 });
  }

  const sid = sidOf(token);
  const sc = scenarioFor(sid);
  if (!sid) return graphError(res, 400, 'An active access token must be used to query information.', 2500);
  if (sc.tokenRevoked) return graphError(res, 400, 'Error validating access token: The session has been invalidated.', 190);

  if (path === '/me/permissions') {
    return send(res, 200, { data: sc.scopes.map((permission) => ({ permission, status: 'granted' })) });
  }
  if (path === '/me/accounts') {
    return send(res, 200, {
      data: sc.pages.map((p) => ({
        id: p.id,
        name: p.name,
        access_token: `page.${sid}.${p.id}`,
        ...(p.instagram ? { instagram_business_account: p.instagram } : {}),
      })),
    });
  }
  if (path === '/me/adaccounts') return send(res, 200, { data: sc.adAccounts });

  const acctMatch = path.match(/^\/(act_\d+)\/(campaigns|insights|adsets|adimages|advideos|adcreatives|ads)$/);
  if (acctMatch) {
    const [, , edge] = acctMatch;
    if (method === 'GET' && edge === 'campaigns') return send(res, 200, { data: sc.campaigns });
    if (method === 'GET' && edge === 'insights') {
      if (!sc.insights) return send(res, 200, { data: [] });
      const i = sc.insights;
      return send(res, 200, {
        data: [{
          impressions: String(i.impressions), clicks: String(i.clicks), spend: i.spend,
          actions: [{ action_type: 'lead', value: String(i.leads) }],
        }],
      });
    }
    if (method === 'POST') {
      await readBody(req);
      if (sc.publishError) return graphError(res, 400, sc.publishError);
      if (edge === 'adimages') return send(res, 200, { images: { 'e2e.jpg': { hash: `hash${id()}` } } });
      return send(res, 200, { id: id() });
    }
  }

  const edgeMatch = path.match(/^\/(\d+)\/(photos|videos|media|media_publish|insights)$/);
  if (edgeMatch && method === 'POST') {
    const [, , edge] = edgeMatch;
    await readBody(req);
    if (sc.publishError) return graphError(res, 400, sc.publishError);
    if (edge === 'photos') {
      const photoId = id();
      return send(res, 200, { id: photoId, post_id: `${edgeMatch[1]}_${photoId}` });
    }
    return send(res, 200, { id: id() });
  }

  const nodeMatch = path.match(/^\/([\w]+)$/);
  if (nodeMatch && method === 'DELETE') return send(res, 200, { success: true });
  if (nodeMatch && method === 'GET') {
    const fields = url.searchParams.get('fields') ?? '';
    const nodeId = nodeMatch[1];
    const body: Record<string, unknown> = { id: nodeId };
    if (fields.includes('status_code')) body.status_code = sc.instagramStatus;
    if (fields.includes('is_published')) body.is_published = true;
    if (fields.includes('permalink_url')) body.permalink_url = `https://www.facebook.com/${nodeId}`;
    if (fields.includes('permalink')) body.permalink = `https://www.instagram.com/p/${nodeId}/`;
    if (fields.includes('page_story_id')) body.page_story_id = `story_${nodeId}`;
    if (fields.includes('status')) body.status = { publishing_phase: { status: 'complete' }, video_status: 'ready' };
    return send(res, 200, body);
  }

  return graphError(res, 404, `fake Meta: unhandled ${method} ${path}`);
}

let server: http.Server | null = null;

/** Starts the fake on FAKE_META_PORT. Resolves false (and leaves it alone) if one is already up. */
export function startFakeMeta(): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const s = http.createServer((req, res) => {
      handle(req, res).catch((e) => graphError(res, 500, String(e)));
    });
    s.once('error', (e: NodeJS.ErrnoException) => (e.code === 'EADDRINUSE' ? resolve(false) : reject(e)));
    s.listen(FAKE_META_PORT, '0.0.0.0', () => {
      server = s;
      resolve(true);
    });
  });
}

export function stopFakeMeta(): Promise<void> {
  return new Promise((resolve) => (server ? server.close(() => resolve()) : resolve()));
}

/** Registers `scenario` for the OAuth `state` about to be sent to the dialog. */
export async function setScenario(state: string, scenario: MetaScenario): Promise<void> {
  const res = await fetch(`${FAKE_META_URL}/__e2e/scenario`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ state, scenario }),
  });
  if (!res.ok) throw new Error(`fake Meta scenario: HTTP ${res.status}`);
}

export async function fakeMetaUp(): Promise<boolean> {
  try {
    return (await fetch(`${FAKE_META_URL}/__e2e/health`, { signal: AbortSignal.timeout(2000) })).ok;
  } catch {
    return false;
  }
}
