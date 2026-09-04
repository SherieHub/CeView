import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import StudioStepRail from './StudioStepRail';

let activeStep = 'attach';
vi.mock('./useStepProgress', () => ({ useStepProgress: () => activeStep }));

describe('StudioStepRail', () => {
  beforeEach(() => {
    activeStep = 'attach';
  });

  it('renders one anchor per step and marks the active one', () => {
    const { container } = render(<StudioStepRail />);

    const links = container.querySelectorAll('.step-rail a');
    expect(links.length).toBe(3);
    expect(links[0]).toHaveAttribute('href', '#studio-step-draft');
    expect(screen.getByText('Draft')).toBeTruthy();
    expect(screen.getByText('Attach')).toBeTruthy();
    expect(screen.getByText('Validate')).toBeTruthy();

    expect(links[1].getAttribute('aria-current')).toBe('step');
    expect(links[0].getAttribute('aria-current')).toBeNull();
    // Steps before the active one read as done, so the rail shows progress.
    expect(links[0].getAttribute('data-state')).toBe('done');
    expect(links[1].getAttribute('data-state')).toBe('current');
    expect(links[2].getAttribute('data-state')).toBe('todo');
  });

  it('is labelled as navigation for assistive tech', () => {
    render(<StudioStepRail />);
    expect(screen.getByRole('navigation', { name: 'Studio progress' })).toBeTruthy();
  });

  it('marks no steps as done when first step is active', () => {
    activeStep = 'draft';
    const { container } = render(<StudioStepRail />);

    const links = container.querySelectorAll('.step-rail a');
    expect(links[0].getAttribute('data-state')).toBe('current');
    expect(links[1].getAttribute('data-state')).toBe('todo');
    expect(links[2].getAttribute('data-state')).toBe('todo');

    expect(links[0].getAttribute('aria-current')).toBe('step');
    expect(links[1].getAttribute('aria-current')).toBeNull();
    expect(links[2].getAttribute('aria-current')).toBeNull();
  });

  it('marks steps done when last step is active', () => {
    activeStep = 'validate';
    const { container } = render(<StudioStepRail />);

    const links = container.querySelectorAll('.step-rail a');
    expect(links[0].getAttribute('data-state')).toBe('done');
    expect(links[1].getAttribute('data-state')).toBe('done');
    expect(links[2].getAttribute('data-state')).toBe('current');

    expect(links[2].getAttribute('aria-current')).toBe('step');
    expect(links[0].getAttribute('aria-current')).toBeNull();
    expect(links[1].getAttribute('aria-current')).toBeNull();
  });
});
