/**
 * Onboarding Step 3 — structured Business Story & UVP.
 *
 * The answers compose the template paragraphs (profileTemplates.ts); these
 * tests cover the step's wiring: the paragraphs follow the answers until the
 * operator edits them, Regenerate hands control back, and the composed text
 * is what lands in the draft.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { EMPTY_OB_DRAFT, ObDraftProvider, useObDraft } from '../obDraft';
import type { ObDraft } from '../obDraft';
import StructuredInputsStep from './StructuredInputsStep';
import { DEMO_BUSINESS } from '../../../../services/fixtures/demoBusiness';

const STORY_TEXT =
  'Sunset Cove Beach Resort is a beachfront resort located in Moalboal, Cebu. We offer ' +
  'Scuba Diving, Island Hopping, Snorkeling, and Beachfront Villas, where guests can stay near ' +
  'the sardine run and explore the reef with local guides. Our facilities and services include ' +
  'twelve villas, a dive shop, and a kitchen using locally sourced ingredients.';

let latest: ObDraft;
function DraftProbe() {
  latest = useObDraft().draft;
  return null;
}

function renderStep(initial: ObDraft) {
  return render(
    <ObDraftProvider initial={initial}>
      <StructuredInputsStep />
      <DraftProbe />
    </ObDraftProvider>,
  );
}

const storyBox = () => screen.getByRole('textbox', { name: 'Generated Business Story' });
const uvpBox = () => screen.getByRole('textbox', { name: 'Combined UVP' });
const type = (label: string | RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

/** Steps 1–2 done, step 3 untouched. */
const FRESH: ObDraft = {
  ...EMPTY_OB_DRAFT,
  businessName: DEMO_BUSINESS.businessName,
  industry: DEMO_BUSINESS.industry,
  vibes: DEMO_BUSINESS.vibes,
  coreServices: DEMO_BUSINESS.coreServices,
};

describe('StructuredInputsStep', () => {
  it('locks both paragraphs behind a placeholder until the answers are complete', () => {
    renderStep(FRESH);
    expect(storyBox()).toBeDisabled();
    expect(storyBox()).toHaveAttribute('placeholder', 'Fill in every field above to generate your story');
    expect(uvpBox()).toBeDisabled();
  });

  it('shows the business name read-only and generates the story once every answer is in', () => {
    renderStep(FRESH);
    expect(screen.getByTestId('story-business-name')).toHaveTextContent('Sunset Cove Beach Resort');

    type('Business type', DEMO_BUSINESS.storyBusinessType);
    type('Location', DEMO_BUSINESS.storyLocation);
    type(/experience during a visit/, DEMO_BUSINESS.storyExperience);
    expect(storyBox()).toBeDisabled(); // facilities still missing
    type(/facilities, resources/, DEMO_BUSINESS.storyFacilities);

    expect(storyBox()).toBeEnabled();
    expect(storyBox()).toHaveValue(STORY_TEXT);
    expect(latest.description).toBe(STORY_TEXT);
    expect(latest.storyLocation).toBe('Moalboal, Cebu');
  });

  it('generates the combined UVP from the three answers', () => {
    renderStep(FRESH);
    type(/1\. What distinguishes/, DEMO_BUSINESS.uvpDistinguisher);
    type(/2\. What specific feature/, DEMO_BUSINESS.uvpSupportingFact);
    type(/3\. How does this benefit/, DEMO_BUSINESS.uvpGuestBenefit);
    expect(uvpBox()).toHaveValue(DEMO_BUSINESS.uvp);
    expect(latest.uvp).toBe(DEMO_BUSINESS.uvp);
  });

  it('keeps a hand-edited paragraph when an answer changes, until Regenerate', async () => {
    renderStep(DEMO_BUSINESS);
    fireEvent.change(storyBox(), { target: { value: 'My own words.' } });
    expect(latest.descriptionEdited).toBe(true);

    type('Location', 'Badian, Cebu');
    expect(storyBox()).toHaveValue('My own words.');
    expect(screen.getByText(/edited manually/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /regenerate from fields/i }));
    expect(storyBox()).toHaveValue(STORY_TEXT.replace('Moalboal, Cebu', 'Badian, Cebu'));
    expect(latest.descriptionEdited).toBe(false);
  });

  it('refreshes an untouched paragraph on entry when steps 1–2 changed since', () => {
    renderStep({ ...DEMO_BUSINESS, businessName: 'Sunset Cove' });
    expect(storyBox()).toHaveValue(STORY_TEXT.replace('Sunset Cove Beach Resort', 'Sunset Cove'));
  });

  it('does not overwrite a hand-edited paragraph on entry', () => {
    renderStep({ ...DEMO_BUSINESS, description: 'Mine.', descriptionEdited: true });
    expect(storyBox()).toHaveValue('Mine.');
  });
});
