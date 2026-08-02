import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PrimaryButton from './PrimaryButton';

// Example unit test — pattern to copy: render a component in isolation and
// assert on its rendered output / interaction behavior.
describe('PrimaryButton', () => {
  it('renders its children and fires onClick when enabled', () => {
    const onClick = vi.fn();
    render(<PrimaryButton onClick={onClick}>Save</PrimaryButton>);

    const button = screen.getByRole('button', { name: 'Save' });
    fireEvent.click(button);

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('disables the button and blocks clicks while isLoading', () => {
    const onClick = vi.fn();
    render(<PrimaryButton isLoading onClick={onClick}>Save</PrimaryButton>);

    const button = screen.getByRole('button', { name: 'Save' });
    expect(button).toBeDisabled();

    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});
