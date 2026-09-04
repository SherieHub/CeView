/**
 * The two-step surge -> target-market picker that gates Content Studio.
 * Ports docs/superpowers/specs/2026-08-13-content-studio-alert-market-picker-design.md
 * (written against the frozen prototype) to real frontend data.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ContentTargetPicker from './ContentTargetPicker';
import { MOCK_MARKETS } from '../../../services/fixtures/markets';
import { MOCK_NOTIFICATIONS } from '../../../services/fixtures/notifications';
import type { BusinessProfile } from '../../../types';

const PROFILE: BusinessProfile = {
  businessProfileId: 'bp-1',
  businessName: 'Sunset Cove Beach Resort',
  categories: ['Coastal & Island', 'Accommodation & Staycation'],
  coreServices: [],
  description: '',
  uvp: '',
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
  useProfile: () => ({ profile: PROFILE, setProfile: vi.fn(), isLoading: false }),
}));

const notificationsListMock = vi.fn();
const marketsForCategoryMock = vi.fn();

vi.mock('../../../services/apiClient', () => ({
  apiClient: {
    notifications: { list: (...args: unknown[]) => notificationsListMock(...args) },
    markets: { forCategory: (...args: unknown[]) => marketsForCategoryMock(...args) },
  },
}));

const COASTAL_ALERT = MOCK_NOTIFICATIONS.find((n) => n.category === 'Coastal & Island')!;
const COASTAL_MARKETS = MOCK_MARKETS; // stand-in; forCategory is mocked directly per-test

beforeEach(() => {
  notificationsListMock.mockReset();
  marketsForCategoryMock.mockReset();
});

describe('ContentTargetPicker', () => {
  it('lists only surge alerts matching the operator\'s own categories', async () => {
    notificationsListMock.mockResolvedValue(MOCK_NOTIFICATIONS);

    render(<ContentTargetPicker onPicked={vi.fn()} />);

    expect(await screen.findByRole('heading', { name: COASTAL_ALERT.title })).toBeInTheDocument();
    // n3's category ('Adventure & Nature') is not one of PROFILE.categories.
    expect(screen.queryByText('Summer Planning Window — United States')).not.toBeInTheDocument();
  });

  it('shows the "no surge alerts" empty state, naming the profile\'s categories, when none match', async () => {
    notificationsListMock.mockResolvedValue([]);

    render(<ContentTargetPicker onPicked={vi.fn()} />);

    expect(await screen.findByText(/no surge alerts for your categories yet/i)).toBeInTheDocument();
    expect(screen.getByText(/Coastal & Island, Accommodation & Staycation/)).toBeInTheDocument();
  });

  it('picking an alert advances to the market step, scoped to that alert\'s category', async () => {
    notificationsListMock.mockResolvedValue([COASTAL_ALERT]);
    marketsForCategoryMock.mockResolvedValue(COASTAL_MARKETS);

    render(<ContentTargetPicker onPicked={vi.fn()} />);

    fireEvent.click(await screen.findByRole('heading', { name: COASTAL_ALERT.title }));

    await waitFor(() => expect(marketsForCategoryMock).toHaveBeenCalledWith(COASTAL_ALERT.category));
    expect(await screen.findByText(new RegExp(`target market for ${COASTAL_ALERT.category}`, 'i'))).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: COASTAL_MARKETS[0].name })).toBeInTheDocument();
  });

  it('"Back to alerts" returns to step 1 without calling onPicked', async () => {
    notificationsListMock.mockResolvedValue([COASTAL_ALERT]);
    marketsForCategoryMock.mockResolvedValue(COASTAL_MARKETS);
    const onPicked = vi.fn();

    render(<ContentTargetPicker onPicked={onPicked} />);

    fireEvent.click(await screen.findByRole('heading', { name: COASTAL_ALERT.title }));
    await screen.findByRole('heading', { name: COASTAL_MARKETS[0].name });

    fireEvent.click(screen.getByRole('button', { name: /back to alerts/i }));

    expect(await screen.findByRole('heading', { name: COASTAL_ALERT.title })).toBeInTheDocument();
    expect(onPicked).not.toHaveBeenCalled();
  });

  it('picking a market calls onPicked with both the alert and the market', async () => {
    notificationsListMock.mockResolvedValue([COASTAL_ALERT]);
    marketsForCategoryMock.mockResolvedValue(COASTAL_MARKETS);
    const onPicked = vi.fn();

    render(<ContentTargetPicker onPicked={onPicked} />);

    fireEvent.click(await screen.findByRole('heading', { name: COASTAL_ALERT.title }));
    fireEvent.click(await screen.findByRole('heading', { name: COASTAL_MARKETS[0].name }));

    expect(onPicked).toHaveBeenCalledWith(COASTAL_ALERT, COASTAL_MARKETS[0]);
  });
});
