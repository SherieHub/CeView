import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ObDraftProvider } from '../obDraft';
import BrandIdentityStep from './BrandIdentityStep';

function renderStep() {
  return render(
    <ObDraftProvider>
      <BrandIdentityStep />
    </ObDraftProvider>
  );
}

describe('BrandIdentityStep — vibe/service gate and tag add/remove', () => {
  it('renders all 8 vibe chips, unpressed by default', () => {
    renderStep();

    const chips = screen.getAllByRole('button', { name: /Serene|Adventurous|Luxury|Family|Eco|Local|Youthful|Romantic/i });
    expect(chips).toHaveLength(8);
    chips.forEach((chip) => expect(chip).toHaveAttribute('aria-pressed', 'false'));
  });

  it('toggles a vibe chip on click and supports multi-select', () => {
    renderStep();

    const adventurous = screen.getByRole('button', { name: 'Adventurous' });
    const romantic = screen.getByRole('button', { name: 'Romantic' });

    fireEvent.click(adventurous);
    expect(adventurous).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(romantic);
    expect(romantic).toHaveAttribute('aria-pressed', 'true');
    expect(adventurous).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(adventurous);
    expect(adventurous).toHaveAttribute('aria-pressed', 'false');
    expect(romantic).toHaveAttribute('aria-pressed', 'true');
  });

  it('adds a service tag on Enter and clears the input', () => {
    renderStep();

    const input = screen.getByPlaceholderText(/type a service and press enter/i);
    fireEvent.change(input, { target: { value: 'Scuba Diving' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(screen.getByText('Scuba Diving')).toBeInTheDocument();
    expect(input).toHaveValue('');
  });

  it('does not add a tag for an empty or duplicate value', () => {
    renderStep();

    const input = screen.getByPlaceholderText(/type a service and press enter/i);

    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.queryAllByLabelText(/^Remove /)).toHaveLength(0);

    fireEvent.change(input, { target: { value: 'Island Hopping' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.change(input, { target: { value: 'Island Hopping' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(screen.getAllByText('Island Hopping')).toHaveLength(1);
  });

  it('removes a service tag when its ✕ button is clicked', () => {
    renderStep();

    const input = screen.getByPlaceholderText(/type a service and press enter/i);
    fireEvent.change(input, { target: { value: 'Sunset Cruise' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByText('Sunset Cruise')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Remove Sunset Cruise'));
    expect(screen.queryByText('Sunset Cruise')).not.toBeInTheDocument();
  });

  it('satisfies the >=1 vibe / >=1 service gate once one of each is set', () => {
    renderStep();

    const eco = screen.getByRole('button', { name: 'Eco-Conscious' });
    fireEvent.click(eco);
    expect(eco).toHaveAttribute('aria-pressed', 'true');

    const input = screen.getByPlaceholderText(/type a service and press enter/i);
    fireEvent.change(input, { target: { value: 'Farm-to-table Dining' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(eco).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Farm-to-table Dining')).toBeInTheDocument();
  });
});
