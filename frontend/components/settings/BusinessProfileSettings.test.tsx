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
import { EMPTY_STRUCTURED, composeStory, composeUvp } from '../module-1/structured-profile/profileTemplates';
import { apiClient } from '../../services/apiClient';

/**
 * A profile from before structured inputs: prose description/UVP, no answers.
 * The V57 migration marks such paragraphs hand-edited, so the template never
 * overwrites them until the operator regenerates.
 */
const BASE_PROFILE: BusinessProfile = {
  ...EMPTY_STRUCTURED,
  descriptionEdited: true,
  uvpEdited: true,
  businessProfileId: 'bp-1',
  businessName: 'Sunset Cove Beach Resort',
  categories: ['Coastal & Island', 'Adventure & Nature'],
  coreServices: ['Scuba Diving', 'Island Hopping'],
  description: 'A twelve-room beachfront property above the reef wall.',
  uvp: 'The only eco-certified resort on this stretch of coast.',
  imagePreview: null,
  uniquenessScore: 0.82, // 0–1 scale; component formats ×100 for display
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

// Save now round-trips through apiClient.businessProfile.save (PUT
// /api/business-profile) instead of being a no-op — stub it so these
// component-behavior tests don't issue a real network request.
vi.mock('../../services/apiClient', () => ({
  apiClient: {
    businessProfile: {
      save: vi.fn((profile: BusinessProfile) => Promise.resolve(profile)),
    },
    // ContactNumberSection loads this on mount; it hides itself when the call fails.
    auth: {
      getProfile: vi.fn(() => Promise.reject(new Error('not under test'))),
    },
  },
}));

beforeEach(() => {
  profileState.profile = BASE_PROFILE;
  profileState.setProfile = vi.fn();
  vi.mocked(apiClient.businessProfile.save).mockClear();
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

/** The editable name in Basic Information (the Business Story shows it as text). */
const nameInput = () => screen.getByLabelText('Business name');

const ANSWERS = {
  storyBusinessType: 'beachfront resort',
  storyLocation: 'Moalboal, Cebu',
  storyExperience: 'stay near the sardine run and explore the reef with local guides',
  storyFacilities: 'twelve villas, a dive shop, and a kitchen using locally sourced ingredients',
  uvpDistinguisher: 'Our diving activities are guided by local Moalboal residents.',
  uvpSupportingFact: 'Our house reef is approximately 30 metres from the villas.',
  uvpGuestBenefit: 'Guests can access the reef conveniently and learn about the area from local guides.',
};

/** A profile saved through the structured form, paragraphs untouched. */
const STRUCTURED: Partial<BusinessProfile> = {
  ...ANSWERS,
  description: composeStory(BASE_PROFILE.businessName, BASE_PROFILE.coreServices, ANSWERS),
  uvp: composeUvp(ANSWERS),
  descriptionEdited: false,
  uvpEdited: false,
};

const storyBox = () => screen.getByRole('textbox', { name: 'Generated Business Story' });
const uvpBox = () => screen.getByRole('textbox', { name: 'Combined UVP' });
const save = () => fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

function categoryChip(name: string) {
  return screen.getByRole('button', { name });
}

describe('BusinessProfileSettings', () => {
  it('pre-fills the form from the current profile', () => {
    renderSettings();

    expect(nameInput()).toHaveValue(BASE_PROFILE.businessName);
    expect(screen.getByLabelText(/slogan/i)).toHaveValue(BASE_PROFILE.slogan);
    expect(screen.getByLabelText(/website/i)).toHaveValue(BASE_PROFILE.website);
    expect(categoryChip('Coastal & Island')).toHaveAttribute('aria-pressed', 'true');
    expect(categoryChip('Urban & City')).toHaveAttribute('aria-pressed', 'false');
  });

  it('shows core services read-only (no toggle control)', () => {
    renderSettings();

    // Once in Core Services, once as the Business Story's offerings — both read-only.
    expect(screen.getAllByText('Scuba Diving')).toHaveLength(2);
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

      fireEvent.change(nameInput(), {
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

    fireEvent.change(nameInput(), {
      target: { value: 'Renamed Resort' },
    });

    expect(screen.getByRole('heading', { name: BASE_PROFILE.businessName })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Renamed Resort' })).not.toBeInTheDocument();
    expect(screen.getByText(/^Uniqueness 82$/)).toBeInTheDocument(); // 0.82 -> formatted ×100
  });

  describe('profile photo', () => {
    function upload(file: File) {
      fireEvent.change(screen.getByTestId('profile-photo-input'), { target: { files: [file] } });
    }

    it('shows an uploaded photo at once and keeps it on Save', async () => {
      const { setProfile } = renderSettings();

      fireEvent.click(screen.getByRole('button', { name: 'Add profile photo' }));
      expect(screen.getByRole('menuitem', { name: /upload a photo/i })).toBeInTheDocument();
      upload(new File(['img'], 'logo.png', { type: 'image/png' }));

      const avatar = await screen.findByRole('button', { name: 'Change profile photo' });
      expect(avatar.querySelector('img')).toHaveAttribute('src', expect.stringMatching(/^data:image\//));
      expect(screen.getByText(/unsaved/i)).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
      expect(await screen.findByText(/business profile saved/i)).toBeInTheDocument();
      expect(setProfile).toHaveBeenCalledWith(
        expect.objectContaining({ imagePreview: expect.stringMatching(/^data:image\//) })
      );
    });

    it('turns away a file that is not an image', () => {
      renderSettings();

      upload(new File(['%PDF'], 'menu.pdf', { type: 'application/pdf' }));

      expect(screen.getByText(/choose an image file/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Add profile photo' })).toBeInTheDocument();
    });

    it('removes a saved photo, back to initials', () => {
      renderSettings({ imagePreview: 'data:image/png;base64,AAAA' });

      fireEvent.click(screen.getByRole('button', { name: 'Change profile photo' }));
      fireEvent.click(screen.getByRole('menuitem', { name: /remove photo/i }));

      expect(screen.getByRole('button', { name: 'Add profile photo' })).toHaveTextContent('SC');
    });
  });

  it('omits the score chip before a uniqueness score exists', () => {
    renderSettings({ uniquenessScore: null });

    expect(screen.queryByText(/^Uniqueness \d+$/)).not.toBeInTheDocument();
  });

  describe('Business Story and UVP', () => {
    it('replaces the free-text Brand Story with the structured sections', () => {
      renderSettings();
      expect(screen.getByRole('heading', { name: 'Business Story' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Unique Value Proposition' })).toBeInTheDocument();
      expect(screen.queryByText('Brand Story')).not.toBeInTheDocument();
    });

    it('keeps a legacy profile\'s prose as hand-edited text, with empty answers', () => {
      renderSettings();
      expect(storyBox()).toHaveValue(BASE_PROFILE.description);
      expect(uvpBox()).toHaveValue(BASE_PROFILE.uvp);
      expect(screen.getAllByText(/edited manually/i)).toHaveLength(2);
      expect(screen.getByLabelText('Location')).toHaveValue('');
    });

    it('saves a legacy profile with every answer still blank', async () => {
      const { setProfile } = renderSettings();
      fireEvent.change(screen.getByLabelText(/slogan/i), { target: { value: 'New slogan' } });
      save();
      expect(await screen.findByText(/business profile saved/i)).toBeInTheDocument();
      expect(setProfile).toHaveBeenCalledWith({ ...BASE_PROFILE, slogan: 'New slogan' });
    });

    it('blocks Save while only some answers are filled in', () => {
      const { setProfile } = renderSettings();
      fireEvent.change(screen.getByLabelText('Location'), { target: { value: 'Moalboal, Cebu' } });
      save();
      expect(screen.getByText(/answer every business story and uvp question, or leave them all blank/i)).toBeInTheDocument();
      expect(setProfile).not.toHaveBeenCalled();
      expect(apiClient.businessProfile.save).not.toHaveBeenCalled();
    });

    it('blocks Save when a paragraph is emptied', () => {
      const { setProfile } = renderSettings(STRUCTURED);
      fireEvent.change(uvpBox(), { target: { value: '  ' } });
      save();
      expect(screen.getByText(/business story and uvp can.t be empty/i)).toBeInTheDocument();
      expect(setProfile).not.toHaveBeenCalled();
    });

    it('prefills the answers and follows a business-name change in an untouched story', () => {
      renderSettings(STRUCTURED);
      expect(screen.getByLabelText('Location')).toHaveValue('Moalboal, Cebu');
      expect(storyBox()).toHaveValue(STRUCTURED.description);

      fireEvent.change(nameInput(), { target: { value: 'Sunset Cove' } });
      expect(storyBox()).toHaveValue(
        composeStory('Sunset Cove', BASE_PROFILE.coreServices, ANSWERS),
      );
    });

    it('regenerates a legacy paragraph once every answer is in, and saves the answers', async () => {
      const { setProfile } = renderSettings();
      fireEvent.change(screen.getByLabelText('Business type'), { target: { value: ANSWERS.storyBusinessType } });
      fireEvent.change(screen.getByLabelText('Location'), { target: { value: ANSWERS.storyLocation } });
      fireEvent.change(screen.getByLabelText(/experience during a visit/), { target: { value: ANSWERS.storyExperience } });
      fireEvent.change(screen.getByLabelText(/facilities, resources/), { target: { value: ANSWERS.storyFacilities } });
      fireEvent.change(screen.getByLabelText(/1\. What distinguishes/), { target: { value: ANSWERS.uvpDistinguisher } });
      fireEvent.change(screen.getByLabelText(/2\. What specific feature/), { target: { value: ANSWERS.uvpSupportingFact } });
      fireEvent.change(screen.getByLabelText(/3\. How does this benefit/), { target: { value: ANSWERS.uvpGuestBenefit } });

      // Still the legacy prose until the operator asks for the template.
      expect(storyBox()).toHaveValue(BASE_PROFILE.description);
      for (const button of screen.getAllByRole('button', { name: /regenerate from fields/i })) {
        fireEvent.click(button);
      }
      expect(storyBox()).toHaveValue(STRUCTURED.description);
      expect(uvpBox()).toHaveValue(STRUCTURED.uvp);

      save();
      expect(await screen.findByText(/business profile saved/i)).toBeInTheDocument();
      expect(setProfile).toHaveBeenCalledWith({ ...BASE_PROFILE, ...STRUCTURED });
    });

    it('never wipes prose that has no answers behind it, even if it is not flagged edited', () => {
      // e.g. a profile seeded through the test-support hook after the migration ran.
      renderSettings({ descriptionEdited: false, uvpEdited: false });
      fireEvent.change(nameInput(), { target: { value: 'Renamed Resort' } });
      expect(storyBox()).toHaveValue(BASE_PROFILE.description);
      expect(uvpBox()).toHaveValue(BASE_PROFILE.uvp);
    });

    it('counts the story as complete only once its answers are filled in', () => {
      renderSettings();
      expect(screen.getByText('Business story').parentElement).not.toHaveAttribute('data-done');
    });
  });
});
