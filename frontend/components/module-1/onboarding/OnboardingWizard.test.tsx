import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import OnboardingWizard from './OnboardingWizard';

describe('OnboardingWizard — Step 1 validity gate', () => {
  it('shows Step 1 (Basic Info) by default with Back hidden and Continue disabled', () => {
    render(<OnboardingWizard />);

    expect(screen.getByText('Tell us about your business')).toBeInTheDocument();
    expect(screen.getByText('Back').closest('button')).not.toBeVisible();
    expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled();
  });

  it('enables Continue once business name and industry are both filled', () => {
    render(<OnboardingWizard />);

    fireEvent.change(screen.getByLabelText(/business name/i), { target: { value: 'Sunset Cove Beach Resort' } });
    expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/industry/i), { target: { value: 'Accommodation & Staycation' } });
    expect(screen.getByRole('button', { name: /continue/i })).toBeEnabled();
  });

  it('re-disables Continue if business name is cleared after being valid', () => {
    render(<OnboardingWizard />);

    fireEvent.change(screen.getByLabelText(/business name/i), { target: { value: 'Sunset Cove Beach Resort' } });
    fireEvent.change(screen.getByLabelText(/industry/i), { target: { value: 'Accommodation & Staycation' } });
    expect(screen.getByRole('button', { name: /continue/i })).toBeEnabled();

    fireEvent.change(screen.getByLabelText(/business name/i), { target: { value: '' } });
    expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled();
  });

  it('the "Fill with demo business" button fills the required fields and enables Continue', () => {
    render(<OnboardingWizard />);

    fireEvent.click(screen.getByRole('button', { name: /fill with demo business/i }));

    expect(screen.getByLabelText(/business name/i)).toHaveValue('Sunset Cove Beach Resort');
    expect(screen.getByRole('button', { name: /continue/i })).toBeEnabled();
  });

  it('shows the side rail with step 1 current and the other four pending', () => {
    render(<OnboardingWizard />);

    const current = screen.getByText('Basic Info').closest('[data-state]');
    expect(current).toHaveAttribute('data-state', 'current');

    for (const title of ['Brand Identity', 'Structured Inputs', 'Assets & Links', 'Analysis']) {
      const pending = screen.getByText(title).closest('[data-state]');
      expect(pending).toHaveAttribute('data-state', 'pending');
    }
  });
});
