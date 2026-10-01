/**
 * CARD — Onboarding: Step 1 Basic Info
 *
 * Covers the "Fill with demo business" shortcut. This assertion previously
 * lived in OnboardingWizard.test.tsx; it belongs here because it is a property
 * of this step, not of the wizard shell that mounts it.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import BasicInfoStep, { DEMO_BUSINESS } from './BasicInfoStep';
import { EMPTY_OB_DRAFT, ObDraftProvider, stepValid } from '../obDraft';

function renderStep() {
  return render(
    <ObDraftProvider>
      <BasicInfoStep />
    </ObDraftProvider>
  );
}

describe('BasicInfoStep', () => {
  it('starts blank', () => {
    renderStep();
    expect(screen.getByLabelText(/business name/i)).toHaveValue('');
    expect(screen.getByLabelText(/industry/i)).toHaveValue('');
  });

  it('"Fill with demo business" populates the required fields', () => {
    renderStep();

    fireEvent.click(screen.getByRole('button', { name: /fill with demo business/i }));

    expect(screen.getByLabelText(/business name/i)).toHaveValue(DEMO_BUSINESS.businessName);
    expect(screen.getByLabelText(/industry/i)).toHaveValue(DEMO_BUSINESS.industry);
  });

  it('writes typed values back into the draft', () => {
    renderStep();

    fireEvent.change(screen.getByLabelText(/business name/i), {
      target: { value: 'Sunset Cove Beach Resort' },
    });

    expect(screen.getByLabelText(/business name/i)).toHaveValue('Sunset Cove Beach Resort');
  });

  /**
   * The prefill is only useful if it actually unblocks the wizard — otherwise
   * it fills fields and leaves Continue dead, which is what the button exists
   * to avoid.
   */
  it('the demo prefill satisfies step 1 of the wizard gate', () => {
    expect(stepValid(EMPTY_OB_DRAFT, 0)).toBe(false);
    expect(stepValid(DEMO_BUSINESS, 0)).toBe(true);
  });
});
