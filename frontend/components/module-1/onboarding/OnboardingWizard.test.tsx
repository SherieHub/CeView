import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import OnboardingWizard from './OnboardingWizard';

describe('OnboardingWizard — Step 1 validity gate', () => {
  it('disables Continue on initial render (empty draft)', () => {
    render(<OnboardingWizard />);
    expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled();
  });

  it('keeps Continue disabled with only business name filled', () => {
    render(<OnboardingWizard />);
    fireEvent.change(screen.getByLabelText(/business name/i), { target: { value: 'Sunset Cove' } });
    expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled();
  });

  it('enables Continue once business name (>1 char) and industry are both filled', () => {
    render(<OnboardingWizard />);
    fireEvent.change(screen.getByLabelText(/business name/i), { target: { value: 'Sunset Cove' } });
    fireEvent.change(screen.getByLabelText(/industry/i), { target: { value: 'Coastal & Island' } });
    expect(screen.getByRole('button', { name: /continue/i })).toBeEnabled();
  });

  it('shows Step 1 as current and Steps 2-5 as pending on mount', () => {
    render(<OnboardingWizard />);
    const steps = screen.getAllByTestId('ob-step');
    expect(steps).toHaveLength(5);
    expect(steps[0]).toHaveAttribute('data-state', 'current');
    for (const step of steps.slice(1)) {
      expect(step).toHaveAttribute('data-state', 'pending');
    }
  });
});
