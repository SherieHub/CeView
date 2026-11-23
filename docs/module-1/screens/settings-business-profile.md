# Screen — Settings → Business Profile

**Route:** `/settings/profile` (default tab of `/settings`) · **Module:** 1 · **Access:** authenticated.

**Prototype reference:** [`ui-ux-prototype.html:4217–4265`](../../../ui-ux-prototype.html#L4217)
(`profile` panel inside `renderSettings()`), [`:4117–4130`](../../../ui-ux-prototype.html#L4117)
(`pfSet`/`pfSave`/`pfToggleCategory`).

**Component:** `components/module-1/settings/BusinessProfileSettings.tsx` (new).

## Why this exists

This is the **only** place an operator edits their business profile after onboarding. There is no
standalone `BusinessProfile` screen in the sidebar anymore — see
[onboarding-wizard.md](onboarding-wizard.md) for why. This screen intentionally uses the same field
set as onboarding steps 1–3, minus the wizard's step gating: every field is independently editable
and there is a single Save.

## Layout

Identity header (avatar initials, business name, industry, and — once computed — the three score
chips: Uniqueness / Semantics / Category) followed by a flat form: business name, slogan, tourism
categories (toggle chip grid, ≥1 must remain selected — same rule as onboarding step 5, enforced with
the same toast), core services (read-only chip display in this screen; editing services is not
exposed here in the prototype and is out of scope unless product asks for it), Business Story and
Unique Value Proposition (the same structured forms and composed paragraphs as onboarding step 3 —
see [onboarding-wizard.md](onboarding-wizard.md#3--structured-inputs-stepsstructuredinputssteptsx)),
website. A single "Save changes" button at the bottom.

## Behavior

- Category toggle mirrors onboarding's rule: removing the last remaining category is blocked with a
  toast, not silently prevented.
- Save calls `apiClient.saveProfile` (`PUT /api/business-profile`) and re-syncs the sidebar
  identity (avatar initials, business name).
- Structured answers are all-or-nothing, as on the server: Save is refused inline unless they are
  all blank or all meet their minimums, and both paragraphs have text. A profile from before
  structured inputs has prose but no answers; its prose is shown as hand-edited and is never
  overwritten until the operator fills in the answers and clicks "Regenerate from fields".
- Changing the business name rebuilds any paragraph that is not hand-edited.
- **Known gap, carried from the prototype as-is:** saving here does **not** recompute the uniqueness
  score. The prototype only ever computes `uniquenessScore`/`semanticsScore`/`categoryScore` during
  onboarding (`obCompute`), so editing the description or UVP afterward strands a score that no
  longer reflects the current text. The copy under Save even says "Saving re-embeds your profile,
  which changes your uniqueness score" — but the prototype does not actually call the classify/
  uniqueness endpoints from here. Flagging this for product/backend: either (a) Save should trigger
  the same analyze→uniqueness round-trip the wizard's step 5 runs, or (b) the copy should be
  corrected. Do not silently pick one — raise it in review before wiring this screen for real.

## API calls

| Call | Endpoint |
|---|---|
| `apiClient.saveProfile` | `PUT /api/business-profile` |

(If the gap above is resolved in favor of re-scoring on save: also `apiClient.classifyAnalyze` +
`apiClient.classifyUniqueness`, same as onboarding step 5.)

## Backend detail

See [`docs/module-1/backend/BusinessProfileController.md`](../backend/BusinessProfileController.md)
and [`schema-delta.md`](../backend/schema-delta.md) for the columns this screen writes that don't
exist in `tbl_business_profile` yet (`slogan`, `website`, `logo`; `vibes` and `socials` are
onboarding-only fields not shown on this screen per the prototype).
