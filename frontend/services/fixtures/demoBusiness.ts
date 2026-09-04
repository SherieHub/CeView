/**
 * The demo MSME operator — Sunset Cove Beach Resort.
 *
 * Single source for every screen that needs a plausible, fully-populated
 * business: the onboarding wizard's "Fill with demo business" shortcut, the
 * dev preview routes, and the tests that need steps 1-3 to already satisfy
 * stepValid() so later steps are reachable.
 *
 * Ports obPrefill() (ui-ux-prototype.html:2023-2035).
 *
 * This used to be defined three times — in BasicInfoStep.tsx, obDraft.tsx and
 * fixtures/profile.ts — with three different descriptions and UVPs for the same
 * fictional resort. Those two other definitions now re-export this one.
 *
 * The description and UVP lengths are load-bearing: stepValid() gates step 3 on
 * >= 50 and >= 30 words respectively, and the wizard tests walk through that
 * gate. Current copy is 78 and 40 words — shortening it will fail those tests.
 */
import type { ObDraft } from '../../components/module-1/onboarding/obDraft';

export const DEMO_BUSINESS: ObDraft = {
  businessName: 'Sunset Cove Beach Resort',
  industry: 'Accommodation & Staycation',
  slogan: 'Rest, thirty metres from the sardine run.',
  vibes: ['Serene & Restorative', 'Eco-Conscious'],
  coreServices: ['Scuba Diving', 'Island Hopping', 'Snorkeling', 'Beachfront Villas'],
  description:
    'Sunset Cove Beach Resort sits on the quiet southern stretch of Moalboal, a short walk from ' +
    'the sardine run that draws divers from across the world. We run a small beachfront property ' +
    'of twelve villas, a dive shop staffed entirely by local guides, and a kitchen that sources ' +
    'its fish and produce from the municipality every morning. Guests come for the reef and stay ' +
    'for the pace: no crowds, no scheduled entertainment, just clear water and long evenings.',
  uvp:
    'The only Moalboal resort where every dive guide is a Moalboal native, house reef access is ' +
    'thirty metres from the villa door, and the entire kitchen is sourced within the municipality ' +
    'each morning rather than trucked in from Cebu City.',
  socials: {
    instagram: '@sunsetcove.ph',
    tiktok: '@sunsetcove',
    facebook: 'SunsetCoveMoalboal',
  },
  logo: null,
  website: 'https://sunsetcove.ph',
  categories: [],
  uniquenessScore: null,
};
