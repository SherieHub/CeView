/**
 * CARD — Content Studio must not open without an explicit surge + target
 * market pick. Covers: the gate itself (no target -> picker, never an
 * inferred market), the generate request built once a target IS picked, the
 * known-500 error surface, the stubbed-content banner (source: 'fallback' —
 * the single most misleading state in the app if it silently renders as real
 * content), and "Change target market" clearing the pick.
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ContentStudioView from './ContentStudioView';
import { buildContentResponse } from './testFixtures';
import { MOCK_MARKETS } from '../../../services/fixtures/markets';
import { MOCK_NOTIFICATIONS } from '../../../services/fixtures/notifications';
import { ApiError } from '../../../services/apiError';
import type { BusinessProfile, DemandAlert, Market, PlatformId } from '../../../types';

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

const ALERT: DemandAlert = MOCK_NOTIFICATIONS.find((n) => n.category === 'Coastal & Island')!;
const MARKET: Market = MOCK_MARKETS[0];

vi.mock('../../../services/profileContext', () => ({
  useProfile: () => ({ profile: BASE_PROFILE, setProfile: vi.fn(), isLoading: false }),
}));

const generateMock = vi.fn();
const creativeDirectionMock = vi.fn();
const notificationsListMock = vi.fn();
const marketsForCategoryMock = vi.fn();

vi.mock('../../../services/apiClient', () => ({
  apiClient: {
    notifications: { list: (...args: unknown[]) => notificationsListMock(...args) },
    markets: { forCategory: (...args: unknown[]) => marketsForCategoryMock(...args) },
    content: { generate: (...args: unknown[]) => generateMock(...args) },
    creativeDirection: {
      generate: (...args: unknown[]) => creativeDirectionMock(...args),
    },
    compliance: { omcsAnalyze: vi.fn(() => Promise.reject(new Error('not used in this test'))) },
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
  mockTarget = null;
  generateMock.mockReset();
  creativeDirectionMock.mockReset();
  setTargetMock.mockReset();
  clearTargetMock.mockReset();
  notificationsListMock.mockReset().mockResolvedValue([]);
  marketsForCategoryMock.mockReset().mockResolvedValue([]);
  creativeDirectionMock.mockResolvedValue({ visualGuide: [], shots: [], moodboard: { palette: '', references: [] } });
  mockIsConnected = () => false;
  disconnectCallback = null;
});

describe('ContentStudioView — gating', () => {
  it('does not call generate() and shows the picker when no target is picked', async () => {
    render(<ContentStudioView />);

    expect(await screen.findByText(/pick a surge alert/i)).toBeInTheDocument();
    expect(generateMock).not.toHaveBeenCalled();
  });

  it('shows the empty-alerts state instead of a picker when the operator has no surges', async () => {
    notificationsListMock.mockResolvedValue([]);

    render(<ContentStudioView />);

    expect(await screen.findByText(/no surge alerts for your categories yet/i)).toBeInTheDocument();
    expect(generateMock).not.toHaveBeenCalled();
  });
});

describe('ContentStudioView — generate request', () => {
  it('builds the generate request from profile + the picked target market', async () => {
    mockTarget = { alert: ALERT, market: MARKET };
    generateMock.mockResolvedValue(buildContentResponse('groq'));

    render(<ContentStudioView />);

    await waitFor(() => expect(generateMock).toHaveBeenCalled());

    expect(generateMock).toHaveBeenCalledWith({
      market: MARKET.id,
      businessName: BASE_PROFILE.businessName,
      description: BASE_PROFILE.description,
      categories: BASE_PROFILE.categories,
      trend: MARKET.spikeIndicator ? 'surging' : 'steady',
    });
  });

  it('shows the picked market and category in the header, not a free-choice selector', async () => {
    mockTarget = { alert: ALERT, market: MARKET };
    generateMock.mockResolvedValue(buildContentResponse('groq'));

    render(<ContentStudioView />);

    await waitFor(() => expect(generateMock).toHaveBeenCalled());
    expect(screen.getByText(new RegExp(`${MARKET.name} — ${ALERT.category}`))).toBeInTheDocument();
    expect(screen.queryByText('Target market')).not.toBeInTheDocument();
  });

  it('"Change target market" clears the pick', async () => {
    mockTarget = { alert: ALERT, market: MARKET };
    generateMock.mockResolvedValue(buildContentResponse('groq'));

    render(<ContentStudioView />);
    await waitFor(() => expect(generateMock).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: /change target market/i }));
    expect(clearTargetMock).toHaveBeenCalled();
  });

  it('renders ApiErrorPanel naming the dependency when generate() is rejected as a missing dependency', async () => {
    mockTarget = { alert: ALERT, market: MARKET };
    generateMock.mockRejectedValue(
      new ApiError({ status: 503, method: 'POST', path: '/api/content/generate', body: { error: 'ai_service_unreachable', dependency: 'fastapi-sbert' } }),
    );

    render(<ContentStudioView />);

    await waitFor(() => expect(screen.getByText('fastapi-sbert is unavailable')).toBeInTheDocument());
  });

  it('shows the stubbed-content banner when source is "fallback"', async () => {
    mockTarget = { alert: ALERT, market: MARKET };
    generateMock.mockResolvedValue(buildContentResponse('fallback'));

    render(<ContentStudioView />);

    await waitFor(() => expect(screen.getByText(/showing stubbed content/i)).toBeInTheDocument());
  });

  it('does not show the stubbed-content banner for real ("groq") content', async () => {
    mockTarget = { alert: ALERT, market: MARKET };
    generateMock.mockResolvedValue(buildContentResponse('groq'));

    render(<ContentStudioView />);

    await waitFor(() => expect(generateMock).toHaveBeenCalled());
    expect(screen.queryByText(/showing stubbed content/i)).not.toBeInTheDocument();
  });
});

describe('ContentStudioView — Settings -> Platforms disconnect rule', () => {
  it('removes a platform from the in-progress "Publish to" selection when it is disconnected elsewhere', async () => {
    mockTarget = { alert: ALERT, market: MARKET };
    generateMock.mockResolvedValue(buildContentResponse('groq'));
    mockIsConnected = () => true; // every platform "connected" so its checkbox is enabled

    render(<ContentStudioView />);
    await waitFor(() => expect(generateMock).toHaveBeenCalled());

    const instagram = screen.getByRole('checkbox', { name: /instagram/i });
    fireEvent.click(instagram);
    expect(instagram).toBeChecked();

    // Settings -> Platforms fires this when the operator disconnects
    // Instagram there — no reload, no re-render of Content Studio itself.
    act(() => disconnectCallback?.('instagram'));

    expect(instagram).not.toBeChecked();
  });
});
