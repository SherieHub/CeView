/**
 * CARD — Onboarding: Wizard Shell & Step 1 Basic Info
 * Depends on: Foundation — Shell & Routing
 * Prototype reference: obStepBasic() / obPrefill() — ui-ux-prototype.html:1990-2035
 * Plan: docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/02-module-1.md
 *
 * Step 1 of the onboarding wizard — the three fields every later AI call
 * (classification, forecasting, caption generation) reads from first.
 * Styling follows LoginPage.tsx/CompleteProfilePage.tsx's hand-rolled
 * Tailwind pattern rather than the prototype's .field/.input/.select classes,
 * since those primitives aren't defined in styles/index.css yet and this
 * card's file list doesn't include that file.
 */
import { useObDraft } from '../obDraft';
import type { ObDraft } from '../obDraft';

/** Canonical tourism categories — matches ceview/constants.ts and docs/module-1/README.md. */
export const BUSINESS_CATEGORIES = [
  'Coastal & Island',
  'Adventure & Nature',
  'Cultural & Heritage',
  'Theme Parks / Entertainment',
  'Urban & City',
  'Culinary & Gastronomy',
  'Accommodation & Staycation',
];

/**
 * Demo business for the "Fill with demo business" shortcut. Re-exported rather
 * than defined here — one definition lives in services/fixtures/demoBusiness.ts
 * alongside the other fixtures. BasicInfoStep.test.tsx imports it from this
 * module, so the name stays.
 */
import { DEMO_BUSINESS } from '../../../../services/fixtures/demoBusiness';

export { DEMO_BUSINESS };

export default function BasicInfoStep() {
  const { draft, setDraft } = useObDraft();

  return (
    <>
      <p className="ob-step-eyebrow">Step 1 — Required</p>
      <h2 className="heading-lg" style={{ margin: '6px 0 8px' }}>
        Tell us about your business
      </h2>
      <p className="body-sm" style={{ marginBottom: 24, maxWidth: '56ch' }}>
        These three fields anchor every AI prompt CeView runs on your behalf — classification,
        forecasting and caption generation all read from them.
      </p>

      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="body-xs font-semibold">Business name</span>
          <input
            type="text"
            className="rounded-md border border-line px-3 py-2"
            placeholder="e.g. Sunset Cove Beach Resort"
            value={draft.businessName}
            onChange={(e) => setDraft({ ...draft, businessName: e.target.value })}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="body-xs font-semibold">
            Industry <span className="text-muted font-normal">— Primary tourism category</span>
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

        <label className="flex flex-col gap-1">
          <span className="body-xs font-semibold">
            Slogan <span className="text-muted font-normal">(optional)</span>
          </span>
          <input
            type="text"
            className="rounded-md border border-line px-3 py-2"
            placeholder="One line that captures what you offer"
            value={draft.slogan}
            onChange={(e) => setDraft({ ...draft, slogan: e.target.value })}
          />
        </label>

        {/* DEV-ONLY. This overwrites the operator's own answers with a
            fictional resort, which is a development shortcut, not a product
            feature — a real operator on step 1 could click it and lose what
            they had typed. `import.meta.env.DEV` is statically false in
            `vite build`, so the button and its data are tree-shaken out of
            production bundles. Same guard the /preview routes use. */}
        {import.meta.env.DEV && (
          <button
            type="button"
            className="body-sm w-fit rounded-full border border-line px-3 py-1.5"
            onClick={() => setDraft({ ...draft, ...DEMO_BUSINESS })}
          >
            Fill with demo business
          </button>
        )}
      </div>
    </>
  );
}
