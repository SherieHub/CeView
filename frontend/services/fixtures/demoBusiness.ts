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
 * Step 3's structured answers are the ones in the Business Story / UVP
 * mockups, and the description/UVP are composed from them (syncComposed), so
 * this draft passes stepValid()'s step 3 gate — the wizard tests rely on it.
 */
import type { ObDraft } from '../../components/module-1/onboarding/obDraft';
import { syncComposed } from '../../components/module-1/structured-profile/profileTemplates';

export const DEMO_BUSINESS: ObDraft = syncComposed({
  businessName: 'Sunset Cove Beach Resort',
  industry: 'Accommodation & Staycation',
  slogan: 'Rest, thirty metres from the sardine run.',
  vibes: ['Serene & Restorative', 'Eco-Conscious'],
  coreServices: ['Scuba Diving', 'Island Hopping', 'Snorkeling', 'Beachfront Villas'],
  storyBusinessType: 'beachfront resort',
  storyLocation: 'Moalboal, Cebu',
  storyExperience: 'stay near the sardine run and explore the reef with local guides',
  storyFacilities: 'twelve villas, a dive shop, and a kitchen using locally sourced ingredients',
  uvpDistinguisher: 'Our diving activities are guided by local Moalboal residents.',
  uvpSupportingFact: 'Our house reef is approximately 30 metres from the villas.',
  uvpGuestBenefit: 'Guests can access the reef conveniently and learn about the area from local guides.',
  // Filled in by syncComposed from the answers above.
  description: '',
  uvp: '',
  descriptionEdited: false,
  uvpEdited: false,
  socials: {
    instagram: '@sunsetcove.ph',
    tiktok: '@sunsetcove',
    facebook: 'SunsetCoveMoalboal',
  },
  logo: null,
  website: 'https://sunsetcove.ph',
  categories: [],
  uniquenessScore: null,
  // Step 5 has not run for this draft, so there is no cohort verdict either.
  cohortInsufficient: false,
});
