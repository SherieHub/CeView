/**
 * CARD — Task 25: wire Content Studio to the real backend.
 *
 * Covers the generate request built from profile + selected market, the
 * known-500 error surface, and the stubbed-content banner (source: 'fallback'
 * — the single most misleading state in the app if it silently renders as
 * real content).
 */
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ContentStudioView from './ContentStudioView';
import { buildContentResponse } from './testFixtures';
import { MOCK_MARKETS } from '../../../services/fixtures/markets';
import { ApiError } from '../../../services/apiError';
import type { BusinessProfile } from '../../../types';

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

vi.mock('../../../services/profileContext', () => ({
  useProfile: () => ({ profile: BASE_PROFILE, setProfile: vi.fn(), isLoading: false }),
}));

const generateMock = vi.fn();
const creativeDirectionMock = vi.fn();

vi.mock('../../../services/apiClient', () => ({
  apiClient: {
    markets: { list: vi.fn(() => Promise.resolve(MOCK_MARKETS)) },
    content: { generate: (...args: unknown[]) => generateMock(...args) },
    creativeDirection: {
      generate: (...args: unknown[]) => creativeDirectionMock(...args),
    },
    compliance: { omcsAnalyze: vi.fn(() => Promise.reject(new Error('not used in this test'))) },
  },
}));

beforeEach(() => {
  generateMock.mockReset();
  creativeDirectionMock.mockReset();
  creativeDirectionMock.mockResolvedValue({ visualGuide: [], shots: [], moodboard: { palette: '', references: [] } });
});

describe('ContentStudioView — generate request', () => {
  it('builds the generate request from profile + selected market once markets load', async () => {
    generateMock.mockResolvedValue(buildContentResponse('groq'));

    render(<ContentStudioView />);

    await waitFor(() => expect(generateMock).toHaveBeenCalled());

    expect(generateMock).toHaveBeenCalledWith({
      market: MOCK_MARKETS[0].id,
      businessName: BASE_PROFILE.businessName,
      description: BASE_PROFILE.description,
      categories: BASE_PROFILE.categories,
      trend: MOCK_MARKETS[0].spikeIndicator ? 'surging' : 'steady',
    });
  });

  it('renders ApiErrorPanel naming the dependency when generate() is rejected as a missing dependency', async () => {
    generateMock.mockRejectedValue(
      new ApiError({ status: 503, method: 'POST', path: '/api/content/generate', body: { error: 'ai_service_unreachable', dependency: 'fastapi-sbert' } }),
    );

    render(<ContentStudioView />);

    await waitFor(() => expect(screen.getByText('fastapi-sbert is unavailable')).toBeInTheDocument());
  });

  it('shows the stubbed-content banner when source is "fallback"', async () => {
    generateMock.mockResolvedValue(buildContentResponse('fallback'));

    render(<ContentStudioView />);

    await waitFor(() => expect(screen.getByText(/showing stubbed content/i)).toBeInTheDocument());
  });

  it('does not show the stubbed-content banner for real ("groq") content', async () => {
    generateMock.mockResolvedValue(buildContentResponse('groq'));

    render(<ContentStudioView />);

    await waitFor(() => expect(generateMock).toHaveBeenCalled());
    expect(screen.queryByText(/showing stubbed content/i)).not.toBeInTheDocument();
  });
});
