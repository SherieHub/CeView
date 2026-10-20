/**
 * CARD — Content Studio must not open without an explicit surge + target
 * market pick. Covers: the gate itself (no target -> picker, never an
 * inferred market), the generate request built once a target IS picked, the
 * known-500 error surface, and "Change target market" clearing the pick.
 *
 * A 'fallback' content source is no longer a state the backend can send (Spring's
 * ContentSource enum and FastAPI's response model both admit only "groq"), so the
 * test that fed the screen a fabricated 'fallback' response was removed; the
 * cross-stack check lives in tests/integration/contentSourceContract.test.ts.
 */
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ContentStudioView from './ContentStudioView';
import { buildContentResponse } from './testFixtures';
import { MOCK_MARKETS } from '../../../services/fixtures/markets';
import { MOCK_NOTIFICATIONS } from '../../../services/fixtures/notifications';
import { MOCK_OMCS } from '../../../services/fixtures/omcs';
import { ApiError } from '../../../services/apiError';
import { OverlayStackProvider } from '../../shared/useOverlayStack';
import type { AttributionLink, BusinessProfile, DemandAlert, Market, PlatformId } from '../../../types';
import type { PublishDraftState } from './contentStudioTypes';

const BASE_PROFILE: BusinessProfile = {
  businessProfileId: 'bp-1',
  businessName: 'Sunset Cove Beach Resort',
  categories: ['Coastal & Island'],
  coreServices: ['Scuba Diving'],
  description: 'A twelve-room beachfront property above the reef wall.',
  uvp: 'The only eco-certified resort on this stretch of coast.',
  imagePreview: null,
  uniquenessScore: 0.82,
  slogan: '',
  industry: '',
  vibes: [],
  website: '',
  logo: null,
  socials: {},
};

/**
 * These cases mount the WHOLE screen — five panels, the step rail, the brief
 * drawer and a board of posts — and then query it by role, which walks the tree
 * computing accessible names. Testing Library's default 1000ms budget is
 * marginal for a tree this size once vitest is running files in parallel: the
 * suite passed in isolation and flaked in a directory run, with the failure
 * moving between cases from run to run. A longer budget, not a smaller tree.
 */
const SLOW = { timeout: 8000 } as const;

/**
 * The surge + market a case is "arriving with", standing in for the pick the
 * Dashboard hand-off or ContentTargetPicker would have made. Taken from the
 * fixtures rather than hand-built so the category really is one of
 * BASE_PROFILE's — the picker filters alerts by exactly that.
 */
const ALERT: DemandAlert = MOCK_NOTIFICATIONS.find((n) => n.category === 'Coastal & Island')!;
const MARKET: Market = MOCK_MARKETS[0];
const ATTRIBUTION_LINK: AttributionLink = {
  linkId: 'link-1', slug: 'k3f9dqmt', category: 'Coastal & Island', targetMarket: 'korea',
  destinationUrl: null, hosted: true,
  windowStart: '2026-10-19T00:00:00+08:00', windowEnd: '2026-11-02T00:00:00+08:00',
  urls: {
    linkUrl: 'https://ceview.example/r/k3f9dqmt',
    metaAdUrl: 'https://ceview.example/r/k3f9dqmt?ad={{ad.id}}',
    tiktokAdUrl: 'https://ceview.example/r/k3f9dqmt?ad=__CID__',
  },
};

vi.mock('../../../services/profileContext', () => ({
  useProfile: () => ({ profile: BASE_PROFILE, setProfile: vi.fn(), isLoading: false }),
}));

const generateMock = vi.fn();
const creativeDirectionMock = vi.fn();
const approveMock = vi.fn();
const notificationsListMock = vi.fn();
const marketsForCategoryMock = vi.fn();
const omcsAnalyzeMock = vi.fn();
const attributionLinksListMock = vi.fn();

vi.mock('../../../services/apiClient', () => ({
  apiClient: {
    notifications: { list: (...args: unknown[]) => notificationsListMock(...args) },
    markets: { forCategory: (...args: unknown[]) => marketsForCategoryMock(...args) },
    content: {
      generate: (...args: unknown[]) => generateMock(...args),
      approve: (...args: unknown[]) => approveMock(...args),
    },
    creativeDirection: {
      generate: (...args: unknown[]) => creativeDirectionMock(...args),
    },
    compliance: { omcsAnalyze: (...args: unknown[]) => omcsAnalyzeMock(...args) },
    posts: { list: () => Promise.resolve([]), publish: vi.fn((req) => Promise.resolve(req.platforms.map((platform: string) => ({ id: `server-${platform}`, date: '2026-10-19', platform, caption: req.captionsByPlatform[platform], status: 'published', reach: 0, likes: 0, comments: 0, shares: 0, engagementRate: 0, series: [] })))) },
    attributionLinks: {
      list: (...args: unknown[]) => attributionLinksListMock(...args),
    },
  },
}));

// A mutable, mockable stand-in for the target-selection store, matching its
// real hook name — lets each test control whether a target is pre-picked
// (arriving from Dashboard's "Target this market") without exercising the
// picker's own fetches.
let mockTarget: { alert: DemandAlert; market: Market } | null = null;
const setTargetMock = vi.fn();
const clearTargetMock = vi.fn();

vi.mock('../../../services/targetSelectionStore', () => ({
  useTargetSelection: () => ({ target: mockTarget, setTarget: setTargetMock, clearTarget: clearTargetMock }),
}));

// PublishComposer also reads useConnections() (Settings -> Platforms gates
// its "Publish to" checkboxes). Mutable so the cross-screen disconnect test
// below can flip a platform "connected" and fire the disconnect callback
// Settings -> Platforms would fire for real.
let mockIsConnected = (_platform: PlatformId): boolean => false;
let disconnectCallback: ((platform: PlatformId) => void) | null = null;

vi.mock('../../../services/connectionsStore', () => ({
  useConnections: () => ({
    connections: [],
    isConnected: (platform: PlatformId) => mockIsConnected(platform),
    connect: vi.fn(),
    disconnect: vi.fn(),
    onDisconnect: (cb: (platform: PlatformId) => void) => {
      disconnectCallback = cb;
      return () => { disconnectCallback = null; };
    },
  }),
}));

beforeEach(() => {
  // The brief drawer auto-opens on a first visit and writes a flag on close.
  // Clearing keeps each case independent of the order they run in.
  localStorage.clear();
  generateMock.mockReset();
  creativeDirectionMock.mockReset();
  approveMock.mockReset().mockResolvedValue({ approvedIds: ['c1'], market: MARKET.id, count: 1 });
  setTargetMock.mockReset();
  clearTargetMock.mockReset();
  notificationsListMock.mockReset().mockResolvedValue([]);
  marketsForCategoryMock.mockReset().mockResolvedValue(MOCK_MARKETS);
  omcsAnalyzeMock.mockReset().mockResolvedValue(MOCK_OMCS);
  attributionLinksListMock.mockReset().mockResolvedValue([]);
  // Explicit per-case rather than inherited: `mockTarget` is module-level, and
  // leaving it set by whichever case ran last made every assertion below
  // depend on file order. Cases that want the picker set it back to null.
  mockTarget = { alert: ALERT, market: MARKET };
  creativeDirectionMock.mockResolvedValue({ visualGuide: [], shots: [], moodboard: { palette: '', references: [] } });
  mockIsConnected = () => false;
  disconnectCallback = null;
});

describe('ContentStudioView — gating', () => {
  it('does not call generate() and shows the picker when no target is picked', async () => {
    mockTarget = null;
    render(<ContentStudioView />);

    expect(await screen.findByText(/pick a surge alert/i)).toBeInTheDocument();
    expect(generateMock).not.toHaveBeenCalled();
  });

  it('shows the empty-alerts state instead of a picker when the operator has no surges', async () => {
    mockTarget = null;
    notificationsListMock.mockResolvedValue([]);

    render(<ContentStudioView />);

    expect(await screen.findByText(/no surge alerts for your categories yet/i)).toBeInTheDocument();
    expect(generateMock).not.toHaveBeenCalled();
  });
});

/**
 * The view mounts CampaignBriefDrawer, which joins the shared overlay stack —
 * so it needs the provider that App/AppShell supply in the real tree. Without
 * it every case here dies on "useOverlayStack must be used within an
 * OverlayStackProvider" before reaching its own assertion.
 */
function renderStudio() {
  return render(
    <OverlayStackProvider>
      <ContentStudioView />
    </OverlayStackProvider>,
  );
}

describe('ContentStudioView — generate request', () => {
  it('shows the Ad URL block only for the matching alert window tuple', async () => {
    mockTarget = {
      alert: { ...ALERT, windowOpenDate: ATTRIBUTION_LINK.windowStart },
      market: { ...MARKET, id: 'korea' },
    };
    generateMock.mockResolvedValue(buildContentResponse('groq'));
    attributionLinksListMock.mockResolvedValue([
      { ...ATTRIBUTION_LINK, windowStart: '2026-09-01T00:00:00+08:00' },
      ATTRIBUTION_LINK,
    ]);

    renderStudio();
    await waitFor(() => expect(generateMock).toHaveBeenCalled(), SLOW);
    // Quick Post shows one stage at a time; the Ad URL block is in Validate.
    await userEvent.click(screen.getByRole('button', { name: 'Validate' }));

    expect(await screen.findByRole('heading', { name: 'Ad URL' }, SLOW)).toBeInTheDocument();
    expect(screen.getByText(ATTRIBUTION_LINK.urls.metaAdUrl)).toBeInTheDocument();
  });

  it('builds the generate request from profile + the picked target market', async () => {
    mockTarget = { alert: ALERT, market: MARKET };
    generateMock.mockResolvedValue(buildContentResponse('groq'));

    renderStudio();

    await waitFor(() => expect(generateMock).toHaveBeenCalled(), SLOW);

    expect(generateMock).toHaveBeenCalledWith({
      market: MARKET.id,
      businessName: BASE_PROFILE.businessName,
      description: BASE_PROFILE.description,
      categories: BASE_PROFILE.categories,
      trend: MARKET.spikeIndicator ? 'surging' : 'steady',
    });
  });

  // The header selector is scoped to the PICKED ALERT's category, not to the
  // operator's overall market ranking — so it can only ever offer markets that
  // surge actually reaches. Asking for the category is the assertion; a call
  // to markets.list() here would mean the screen had gone back to inferring.
  it('offers only the markets for the picked alert’s category', async () => {
    generateMock.mockResolvedValue(buildContentResponse('groq'));

    renderStudio();

    await waitFor(() => expect(generateMock).toHaveBeenCalled(), SLOW);
    expect(marketsForCategoryMock).toHaveBeenCalledWith(ALERT.category);

    const select = screen.getByLabelText('Target market') as HTMLSelectElement;
    expect(select.value).toBe(MARKET.id);
    expect(Array.from(select.options).map((o) => o.textContent))
      .toEqual(MOCK_MARKETS.map((m) => m.name));
  });

  // The selector writes through the shared store rather than into local state.
  // Bound to a private value it would look identical and do nothing, because
  // generation reads target.market.id — so what it CALLS is the whole point.
  it('switches market through the shared store, keeping the same alert', async () => {
    generateMock.mockResolvedValue(buildContentResponse('groq'));

    renderStudio();
    await waitFor(() => expect(generateMock).toHaveBeenCalled(), SLOW);

    const other = MOCK_MARKETS[1];
    await userEvent.selectOptions(screen.getByLabelText('Target market'), other.id);

    expect(setTargetMock).toHaveBeenCalledWith(ALERT, other);
  });

  it('renders ApiErrorPanel naming the dependency when generate() is rejected as a missing dependency', async () => {
    mockTarget = { alert: ALERT, market: MARKET };
    generateMock.mockRejectedValue(
      new ApiError({ status: 503, method: 'POST', path: '/api/content/generate', body: { error: 'ai_service_unreachable', dependency: 'fastapi-sbert' } }),
    );

    renderStudio();

    await waitFor(() => expect(screen.getByText('fastapi-sbert is unavailable')).toBeInTheDocument(), SLOW);
  });

  // The Draft -> Attach handoff: choosing an option in the grid is what fills
  // the single editable caption below it. The cards are no longer editable, so
  // this is the only path from a generated option to a publishable draft.
  it('stages a selected option into the composer', async () => {
    generateMock.mockResolvedValue(buildContentResponse('groq'));

    renderStudio();

    const select = await screen.findAllByRole('button', { name: 'Select' }, SLOW);
    await userEvent.click(select[0]);

    expect((screen.getByLabelText('Your caption') as HTMLTextAreaElement).value)
      .toBe('Instagram caption text');
  });

  // The shot list lives only in the drawer now, so the composer must still
  // offer a way in at the moment the operator is choosing media. This replaced
  // an inline accordion that duplicated the drawer wholesale.
  it('opens the visual guide from the link beside the upload control', async () => {
    generateMock.mockResolvedValue(buildContentResponse('groq'));

    renderStudio();
    await waitFor(() => expect(generateMock).toHaveBeenCalled(), SLOW);

    // The media control, and the link beside it, live in the Attach stage.
    await userEvent.click(screen.getByRole('button', { name: 'Attach' }));

    // Dismiss the first-run auto-open so the assertion below is about the link.
    // The shared Drawer keeps its children mounted when closed — it slides
    // off-canvas so the transition can run — so "is the content in the DOM" is
    // not the signal. It sets aria-hidden while closed, which takes the dialog
    // out of the accessibility tree, and getByRole honours that.
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Visual Guide' })).toBeNull(), SLOW);

    await userEvent.click(screen.getByRole('button', { name: 'Review Visual Guide' }));

    const drawer = await screen.findByRole('dialog', { name: 'Visual Guide' });
    // No caption chosen yet, so the drawer explains the next step instead of sitting blank.
    expect(within(drawer).getByText(/Choose a caption in Draft/i)).toBeTruthy();
    // Media guidance only — the moodboard and caption rationale were removed.
    expect(within(drawer).queryByText('Moodboard')).toBeNull();
  });

  // The guide's shots come from the chosen caption. The approve-and-generate
  // AI shot list was removed, so nothing is approved or generated from here.
  it('generates the caption’s shots on request, with the why-box, and approves nothing', async () => {
    generateMock.mockResolvedValue(buildContentResponse('groq'));
    renderStudio();
    const select = await screen.findAllByRole('button', { name: 'Select' }, SLOW);
    await userEvent.click(select[0]);
    // The guide is media guidance, so it first auto-opens at Attach — and
    // before the shots are generated it says where to get them.
    await userEvent.click(screen.getByRole('button', { name: 'Attach' }));
    const drawer = await screen.findByRole('dialog', { name: 'Visual Guide' });
    expect(within(drawer).getByText(/Generate the AI shots/)).toBeTruthy();
    await userEvent.click(within(drawer).getAllByRole('button', { name: 'Close' })[0]);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Visual Guide' })).toBeNull(), SLOW);

    // Neither the shots nor "Why this matters" before generating.
    expect(screen.queryByRole('heading', { name: 'Why this matters' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Generate AI shots' }));
    expect(screen.getByText('Generating shots for your caption…')).toBeTruthy();

    // Both arrive together.
    expect(await screen.findByRole('region', { name: 'Shots for your caption' }, SLOW)).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Why this matters' })).toBeTruthy();
    expect(creativeDirectionMock).not.toHaveBeenCalled();
    expect(approveMock).not.toHaveBeenCalled();
    // Includes the mock generation delay: past vitest's 5s default under a full run.
  }, 20000);

  // The sidebar's active row already says Content Studio; repeating it above
  // the title pushed the market selector up level with a label rather than
  // with the heading it scopes.
  it('shows no eyebrow above the page title', async () => {
    generateMock.mockResolvedValue(buildContentResponse('groq'));
    const { container } = renderStudio();
    await waitFor(() => expect(generateMock).toHaveBeenCalled(), SLOW);

    expect(container.querySelector('.page-head .eyebrow')).toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: 'Content Studio' })).toBeTruthy();
    // The market selector still lives in the head's actions slot.
    expect(container.querySelector('.page-head-actions .studio-select')).not.toBeNull();
  });

  // The floating trigger was removed; the guide opens from the link beside
  // the upload control (tested above). Draft is caption-only, so the
  // first-run auto-open waits until Attach.
  it('has no floating visual-guide trigger, and no guide on Draft', async () => {
    generateMock.mockResolvedValue(buildContentResponse('groq'));
    const { container } = renderStudio();
    await waitFor(() => expect(generateMock).toHaveBeenCalled(), SLOW);

    expect(screen.queryByRole('dialog', { name: 'Visual Guide' })).toBeNull();
    expect(container.querySelector('.brief-trigger')).toBeNull();

    await userEvent.click(screen.getByRole('tab', { name: 'Campaigns' }));
    expect(screen.queryByRole('dialog', { name: 'Visual Guide' })).toBeNull();
    await userEvent.click(screen.getByRole('tab', { name: 'Quick Post' }));

    await userEvent.click(screen.getByRole('button', { name: 'Attach' }));
    expect(await screen.findByRole('dialog', { name: 'Visual Guide' })).toBeTruthy();
    expect(container.querySelector('.brief-trigger')).toBeNull();
  });

  // Progressive disclosure, end to end: nothing on the screen offers Publish
  // until the audit has returned a pass.
  it('keeps Publish hidden before the audit has run', async () => {
    generateMock.mockResolvedValue(buildContentResponse('groq'));

    renderStudio();

    await waitFor(() => expect(generateMock).toHaveBeenCalled(), SLOW);
    expect(screen.queryByRole('button', { name: /^Publish/ })).toBeNull();
  });

  it('explains why Publish is locked while media uploads or after the upload fails', async () => {
    generateMock.mockResolvedValue(buildContentResponse('groq'));
    const base: PublishDraftState = {
      caption: 'A staged caption', mediaDataUrl: 'data:image/png;base64,x', platforms: ['instagram'],
      visibility: 'public', commentsEnabled: true, paidPartnership: false, agreementChecked: false,
    };

    const { unmount } = render(
      <OverlayStackProvider>
        <ContentStudioView initialDraft={{ ...base, mediaUpload: { status: 'uploading' } }} />
      </OverlayStackProvider>,
    );
    await waitFor(() => expect(generateMock).toHaveBeenCalled(), SLOW);
    await userEvent.click(screen.getByRole('button', { name: 'Validate' }));
    expect(screen.getByText('Uploading your media… Publish unlocks when it finishes.')).toBeTruthy();
    unmount();

    render(
      <OverlayStackProvider>
        <ContentStudioView initialDraft={{ ...base, mediaUpload: { status: 'failed', message: 'nope' } }} />
      </OverlayStackProvider>,
    );
    await waitFor(() => expect(generateMock).toHaveBeenCalledTimes(2), SLOW);
    await userEvent.click(screen.getByRole('button', { name: 'Validate' }));
    expect(await screen.findByText('Media upload failed — go back to Attach to retry.')).toBeTruthy();
  });
});

describe('ContentStudioView — Settings -> Platforms disconnect rule', () => {
  /** A draft far enough along that the audit's own gate (caption + media) opens. */
  const STAGED: PublishDraftState = {
    caption: 'A staged caption', mediaDataUrl: 'data:image/png;base64,x', platforms: ['instagram'],
    visibility: 'public', commentsEnabled: true, paidPartnership: false, agreementChecked: false,
  };

  /**
   * Observed through Publish rather than through a checkbox. Destinations moved
   * into the publish modal in the studio rebuild, so there is no platform
   * checkbox on the screen itself any more — but the rule the disconnect
   * enforces is bigger than the tick anyway: a draft bound for a platform the
   * operator has just disconnected must not stay publishable. The audit pass is
   * what reveals Publish, and the disconnect handler resets it.
   */
  it('withdraws a passed audit when a selected platform is disconnected elsewhere', async () => {
    generateMock.mockResolvedValue(buildContentResponse('groq'));
    mockIsConnected = () => true;

    render(
      <OverlayStackProvider>
        <ContentStudioView initialDraft={{ ...STAGED, mediaUpload: { status: 'ready', mediaId: 'media', publicUrl: 'https://example.test/media.jpg' } }} />
      </OverlayStackProvider>,
    );
    await waitFor(() => expect(generateMock).toHaveBeenCalled(), SLOW);

    await userEvent.click(screen.getByRole('button', { name: 'Validate' }));
    await userEvent.click(screen.getByRole('button', { name: /Run Compliance Audit/i }));
    // Six 420ms stepper ticks stand between the click and the verdict.
    const publish = await screen.findByRole('button', { name: /^Publish/ }, SLOW);
    expect(publish).toBeTruthy();

    // Settings -> Platforms fires this when the operator disconnects Instagram
    // there — no reload, no re-render of Content Studio itself.
    act(() => disconnectCallback?.('instagram'));

    await waitFor(() => expect(screen.queryByRole('button', { name: /^Publish/ })).toBeNull(), SLOW);
    // Six real 420ms stepper ticks put this past vitest's 5s default before the
    // waitFor budgets above are even reached — it timed out in the full-suite
    // run and passed alone, which is the tell.
  }, 30000);
});

describe('ContentStudioView — after publishing', () => {
  const STAGED: PublishDraftState = {
    caption: 'A staged caption', mediaDataUrl: 'data:image/png;base64,x', platforms: ['instagram'],
    visibility: 'public', commentsEnabled: true, paidPartnership: false, agreementChecked: true,
  };

  it('lands on the Content Library with the published post open', async () => {
    generateMock.mockResolvedValue(buildContentResponse('groq'));
    mockIsConnected = () => true;
    render(
      <OverlayStackProvider>
        <ContentStudioView initialDraft={{ ...STAGED, mediaUpload: { status: 'ready', mediaId: 'media', publicUrl: 'https://example.test/media.jpg' } }} />
      </OverlayStackProvider>,
    );
    await waitFor(() => expect(generateMock).toHaveBeenCalled(), SLOW);

    await userEvent.click(screen.getByRole('button', { name: 'Validate' }));
    await userEvent.click(screen.getByRole('button', { name: /Run Compliance Audit/i }));
    await userEvent.click(await screen.findByRole('button', { name: /^Publish/ }, SLOW));
    await userEvent.click(screen.getByRole('button', { name: /Confirm & Publish/ }));

    expect(screen.getByRole('tab', { name: /Content Library/ })).toHaveAttribute('aria-selected', 'true');
    const detail = await screen.findByRole('dialog', { name: 'Published to Instagram' });
    expect(within(detail).getByText('A staged caption')).toBeTruthy();
    expect(screen.getByText('Just published')).toBeTruthy();
    // Six real 420ms audit steps come first.
  }, 30000);
});
