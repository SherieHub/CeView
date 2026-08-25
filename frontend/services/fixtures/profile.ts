/**
 * A fully-populated operator profile for the dev preview routes.
 *
 * The real `businessProfile.load()` fixture is EMPTY_BUSINESS_PROFILE_DTO — an
 * unonboarded operator — which is correct for exercising ProfileGate but makes
 * every post-onboarding screen unreachable locally: with `categories: []` the
 * gate redirects to /onboarding, and the dashboard's category filter would
 * match nothing anyway.
 *
 * Continues the same business as DEMO_OB_DRAFT (components/module-1/onboarding/
 * obDraft.tsx) so the preview routes tell one coherent story: this is what
 * Sunset Cove looks like after finishing the wizard.
 *
 * The four categories are chosen against MOCK_NOTIFICATIONS to produce a feed
 * worth looking at — 5 matching alerts, 3 unread, 2 of them confirmed surges —
 * and against CATEGORY_MARKET_SCORES so that re-ranking is visibly different
 * per alert (Accommodation leads with korea 87, Adventure & Nature with
 * usa 90). A profile matching only one category would hide both behaviours.
 */
import type { BusinessProfile } from '../../types';

export const DEMO_PROFILE: BusinessProfile = {
  businessProfileId: 'bp-demo-1',
  businessName: 'Sunset Cove Beach Resort',
  categories: [
    'Accommodation & Staycation',
    'Coastal & Island',
    'Adventure & Nature',
    'Culinary & Gastronomy',
  ],
  coreServices: ['Scuba Diving', 'Island Hopping', 'Snorkeling', 'Beachfront Villas'],
  description:
    'Sunset Cove Beach Resort sits on the quiet southern stretch of Moalboal, a short walk from ' +
    'the sardine run that draws divers from across the world. We run a small beachfront property ' +
    'of twelve villas, a dive shop staffed entirely by local guides, and a kitchen that sources ' +
    'its fish and produce from the municipality every morning.',
  uvp:
    'The only Moalboal resort where every dive guide is a Moalboal native, house reef access is ' +
    'thirty metres from the villa door, and the entire kitchen is sourced within the municipality ' +
    'each morning rather than trucked in from Cebu City.',
  imagePreview: null,
  uniquenessScore: 82,
  slogan: 'Rest, thirty metres from the sardine run.',
  industry: 'Accommodation & Staycation',
  vibes: ['Serene & Restorative', 'Eco-Conscious'],
  website: 'https://sunsetcove.ph',
  logo: null,
  socials: {
    instagram: '@sunsetcove.ph',
    tiktok: '@sunsetcove',
    facebook: 'SunsetCoveMoalboal',
    naver: '',
  },
};
