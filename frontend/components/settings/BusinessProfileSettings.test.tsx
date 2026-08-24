/**
 * CARD — Settings: Business Profile
 *
 * Covers the card's Definition of Done: the >=1-category-selected rule and
 * Save -> re-sync (setProfile with the edited form).
 *
 * useProfile is mocked rather than driven through the real ProfileProvider:
 * the provider fetches on mount and owns its own state, and these assertions
 * are about this component's behavior (what it renders from `profile`, and
 * what it hands back to `setProfile`), not the provider's fetch lifecycle.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import BusinessProfileSettings from './BusinessProfileSettings';
import { ToastProvider } from '../shared/Toast';
import type { BusinessProfile } from '../../types';

const BASE_PROFILE: BusinessProfile = {
  businessProfileId: 'bp-1',
  businessName: 'Sunset Cove Beach Resort',
  categories: ['Coastal & Island', 'Adventure & Nature'],
  coreServices: ['Scuba Diving', 'Island Hopping'],
  description: 'A twelve-room beachfront property above the reef wall.',
  uvp: 'The only eco-certified resort on this stretch of coast.',
  imagePreview: null,
  uniquenessScore: 82,
  slogan: 'Rest, thirty metres from the sardine run.',
  industry: 'Accommodation & Staycation',
  vibes: [],
  website: 'https://sunsetcove.ph',
  logo: null,
  socials: {},
};

const profileState = {
  profile: BASE_PROFILE,
  setProfile: vi.fn(),
  isLoading: false,
};

vi.mock('../../services/profileContext', () => ({
  useProfile: () => profileState,
}));

beforeEach(() => {
  profileState.profile = BASE_PROFILE;
  profileState.setProfile = vi.fn();
});

function renderSettings(overrides: Partial<BusinessProfile> = {}) {
  profileState.profile = { ...BASE_PROFILE, ...overrides };

  render(
    <ToastProvider>
      <BusinessProfileSettings />
    </ToastProvider>
  );

  return profileState;
}

function categoryChip(name: string) {
  return screen.getByRole('button', { name });
}

describe('BusinessProfileSettings', () => {
  it('pre-fills the form from the current profile', () => {
    renderSettings();

    expect(screen.getByLabelText(/business name/i)).toHaveValue(BASE_PROFILE.businessName);
    expect(screen.getByLabelText(/slogan/i)).toHaveValue(BASE_PROFILE.slogan);
    expect(screen.getByLabelText(/website/i)).toHaveValue(BASE_PROFILE.website);
    expect(categoryChip('Coastal & Island')).toHaveAttribute('aria-pressed', 'true');
    expect(categoryChip('Urban & City')).toHaveAttribute('aria-pressed', 'false');
  });

  it('shows core services read-only (no toggle control)', () => {
    renderSettings();

    expect(screen.getByText('Scuba Diving')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Scuba Diving' })).not.toBeInTheDocument();
  });

  describe('the >=1-category-selected rule', () => {
    it('deselects a category when more than one is selected', () => {
      renderSettings();

      fireEvent.click(categoryChip('Adventure & Nature'));

      expect(categoryChip('Adventure & Nature')).toHaveAttribute('aria-pressed', 'false');
      expect(categoryChip('Coastal & Island')).toHaveAttribute('aria-pressed', 'true');
    });

    it('selects an unselected category', () => {
      renderSettings();

      fireEvent.click(categoryChip('Urban & City'));

      expect(categoryChip('Urban & City')).toHaveAttribute('aria-pressed', 'true');
    });

    /**
     * The prototype blocks this with a toast rather than a disabled control —
     * the chip stays clickable and explains itself, per pfToggleCategory().
     */
    it('blocks removing the last remaining category, with a toast', () => {
      renderSettings({ categories: ['Coastal & Island'] });

      fireEvent.click(categoryChip('Coastal & Island'));

      expect(categoryChip('Coastal & Island')).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByText(/at least one category must stay selected/i)).toBeInTheDocument();
    });
  });

  describe('Save', () => {
    it('re-syncs the profile with the edited form', async () => {
      const { setProfile } = renderSettings();

      fireEvent.change(screen.getByLabelText(/business name/i), {
        target: { value: 'Sunset Cove Dive Resort' },
      });
      fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

      expect(await screen.findByText(/business profile saved/i)).toBeInTheDocument();
      expect(setProfile).toHaveBeenCalledTimes(1);
      expect(setProfile).toHaveBeenCalledWith({
        ...BASE_PROFILE,
        businessName: 'Sunset Cove Dive Resort',
      });
    });

    it('carries category edits into the saved profile', async () => {
      const { setProfile } = renderSettings();

      fireEvent.click(categoryChip('Urban & City'));
      fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

      expect(await screen.findByText(/business profile saved/i)).toBeInTheDocument();
      expect(setProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          categories: ['Coastal & Island', 'Adventure & Nature', 'Urban & City'],
        })
      );
    });
  });

  /**
   * The identity header reads `profile`, not `form` (per the card's pseudocode),
   * so it only changes once Save has pushed the edit back into context.
   */
  it('renders the identity header from the saved profile, not the in-progress form', () => {
    renderSettings();

    fireEvent.change(screen.getByLabelText(/business name/i), {
      target: { value: 'Renamed Resort' },
    });

    expect(screen.getByRole('heading', { name: BASE_PROFILE.businessName })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Renamed Resort' })).not.toBeInTheDocument();
    expect(screen.getByText(/^Uniqueness 82$/)).toBeInTheDocument();
  });

  it('omits the score chip before a uniqueness score exists', () => {
    renderSettings({ uniquenessScore: null });

    expect(screen.queryByText(/^Uniqueness \d+$/)).not.toBeInTheDocument();
  });
});
