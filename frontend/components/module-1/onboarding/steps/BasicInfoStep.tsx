/**
 * CARD — Onboarding: Wizard Shell & Step 1 Basic Info
 * Prototype reference: obStepBasic() — ui-ux-prototype.html:1993-2034
 */
import { useObDraft } from '../obDraft';
import type { ObDraft } from '../obDraft';

export const BUSINESS_CATEGORIES = [
  'Coastal & Island',
  'Adventure & Nature',
  'Cultural & Heritage',
  'Theme Parks / Entertainment',
  'Urban & City',
  'Culinary & Gastronomy',
  'Accommodation & Staycation',
];

const SAMPLE_DESCRIPTION =
  'Sunset Cove is a twelve-room beachfront property on the western coast of Moalboal, Cebu, built ' +
  'directly above the reef wall where the Moalboal sardine run gathers year round. Guests can walk ' +
  'from breakfast into the water and be inside a shoal of more than a million fish within thirty ' +
  'metres of the shoreline. The property runs on solar power, filters and refills its own drinking ' +
  'water, and employs its staff entirely from the surrounding barangay. Rooms are deliberately ' +
  'simple: no televisions, wide shaded balconies, and hammocks facing the channel.';

const SAMPLE_UVP =
  'We are the only eco-certified resort on this stretch of coast with a certified marine biologist ' +
  'living on site, which means every guided dive is properly briefed, logged and conducted without ' +
  'touching the reef. Guests reach a world-class natural phenomenon in under a minute, without a ' +
  'boat transfer.';

export const DEMO_BUSINESS: ObDraft = {
  businessName: 'Sunset Cove Beach Resort',
  industry: 'Accommodation & Staycation',
  slogan: 'Rest, thirty metres from the sardine run.',
  vibes: ['Serene & Restorative', 'Eco-Conscious'],
  coreServices: ['Scuba Diving', 'Island Hopping', 'Snorkeling', 'Beachfront Villas'],
  description: SAMPLE_DESCRIPTION,
  uvp: SAMPLE_UVP,
  website: 'https://sunsetcove.ph',
  logo: null,
  socials: { instagram: '@sunsetcove.ph', facebook: 'SunsetCoveMoalboal', tiktok: '@sunsetcove', naver: '' },
};

export default function BasicInfoStep() {
  const { draft, setDraft } = useObDraft();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="eyebrow">Step 1 — Required</p>
        <h2 className="h-xl mt-1.5 mb-2">Tell us about your business</h2>
        <p className="body-sm max-w-[56ch]">
          These three fields anchor every AI prompt CeView runs on your behalf — classification,
          forecasting and caption generation all read from them.
        </p>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="body-xs font-bold">Business name</span>
        <input
          className="rounded-md border border-line px-3 py-2"
          value={draft.businessName}
          placeholder="e.g. Sunset Cove Beach Resort"
          onChange={(e) => setDraft({ ...draft, businessName: e.target.value })}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="body-xs font-bold">
          Industry <span className="font-normal opacity-70">Primary tourism category</span>
        </span>
        <select
          className="rounded-md border border-line px-3 py-2"
          value={draft.industry}
          onChange={(e) => setDraft({ ...draft, industry: e.target.value })}
        >
          <option value="">Select your primary category…</option>
          {BUSINESS_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="body-xs font-bold">
          Slogan <span className="font-normal opacity-70">Optional</span>
        </span>
        <input
          className="rounded-md border border-line px-3 py-2"
          value={draft.slogan}
          placeholder="One line that captures what you offer"
          onChange={(e) => setDraft({ ...draft, slogan: e.target.value })}
        />
      </label>

      <button
        type="button"
        className="body-sm w-fit rounded-full border border-line px-4 py-2"
        onClick={() => setDraft({ ...draft, ...DEMO_BUSINESS })}
      >
        Fill with demo business
      </button>
    </div>
  );
}
