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
import { DEMO_BUSINESS } from './demoBusiness';

export const DEMO_PROFILE: BusinessProfile = {
  // Spread rather than restated: this is the same fictional business as the
  // onboarding demo, so the identity fields have one definition. Only the
  // fields BusinessProfile adds beyond ObDraft are set here.
  ...DEMO_BUSINESS,
  businessProfileId: 'bp-demo-1',
  imagePreview: null,
  uniquenessScore: 82,
  categories: [
    'Accommodation & Staycation',
    'Coastal & Island',
    'Adventure & Nature',
    'Culinary & Gastronomy',
  ],
};
