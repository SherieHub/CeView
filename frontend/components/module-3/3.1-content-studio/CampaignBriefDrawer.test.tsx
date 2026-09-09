import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import CampaignBriefDrawer from './CampaignBriefDrawer';
import { OverlayStackProvider } from '../../shared/useOverlayStack';
import { MOCK_CREATIVE_DIRECTION } from '../../../services/fixtures/creativeDirection';

function setup(open: boolean, onClose = vi.fn()) {
  // Spreads the render result so cases can reach `container` as well as the
  // spy — the ordering assertion below queries by class, which screen cannot do.
  const view = render(
    <OverlayStackProvider>
      <CampaignBriefDrawer
        open={open}
        onClose={onClose}
        showWelcome={false}
        direction={MOCK_CREATIVE_DIRECTION}
      />
    </OverlayStackProvider>,
  );
  return { ...view, onClose };
}

describe('CampaignBriefDrawer', () => {
  it('carries the visual direction and the shot list', () => {
    const { container } = setup(true);

    expect(screen.getByText('Visual direction')).toBeTruthy();
    expect(screen.getByText('Shot list')).toBeTruthy();

    // The title is split: an uppercase eyebrow for the kind of shot, and the
    // subject beside it. They are separate elements so the eyebrow can carry
    // its own type treatment without a nested span inside a heading.
    expect(screen.getByText('Hero')).toBeTruthy();
    expect(screen.getByText('Sardine Run, Mid-Shoal')).toBeTruthy();

    // Directives, not a narrative paragraph — one labelled line each.
    expect(screen.getAllByText('Placement')).toHaveLength(4);
    expect(screen.getAllByText('Action')).toHaveLength(4);
    expect(screen.getAllByText('Context')).toHaveLength(4);
    expect(container.querySelectorAll('.shot-narrative')).toHaveLength(0);

    // Lighting is an inset callout, one per shot.
    expect(container.querySelectorAll('.shot-lighting')).toHaveLength(4);
    expect(screen.getAllByText('Lighting constraint:')).toHaveLength(4);

    // Rules between shots, not boxes around them.
    expect(container.querySelectorAll('.shot')).toHaveLength(4);

    const blocks = [...container.querySelectorAll('.studio-block')];
    const headings = blocks.map((b) => b.querySelector('h3')?.textContent?.trim());
    expect(headings).toEqual(['Visual direction', 'Shot list']);

    // The rule that separates the shot list from the visual direction is drawn
    // by `.studio-block + .studio-block`, so it lands on the SECOND block only
    // — a border on every block would underline the panel header too.
    expect(blocks[0].previousElementSibling?.classList.contains('studio-block')).toBe(false);
    expect(blocks[1].previousElementSibling).toBe(blocks[0]);
  });

  // The FastAPI service still returns only label/description, so the structured
  // fields are optional and the drawer has to render a live response too.
  it('falls back to the narrative when the service sends no directives', () => {
    const narrativeOnly = {
      ...MOCK_CREATIVE_DIRECTION,
      shots: [{
        label: 'Hero — sardine run, mid-shoal',
        description: 'Underwater, inside the bait ball rather than beside it.',
        lighting: 'Ambient only.',
      }],
    };
    const { container } = render(
      <OverlayStackProvider>
        <CampaignBriefDrawer open onClose={vi.fn()} showWelcome={false} direction={narrativeOnly} />
      </OverlayStackProvider>,
    );

    expect(screen.getByText('Underwater, inside the bait ball rather than beside it.')).toBeTruthy();
    expect(container.querySelectorAll('.shot-specs')).toHaveLength(0);
    // No shotType, so the subject falls back to the raw label.
    expect(screen.getByText('Hero — sardine run, mid-shoal')).toBeTruthy();
    // The lighting callout still renders — it is not one of the optional fields.
    expect(container.querySelectorAll('.shot-lighting')).toHaveLength(1);
  });

  // This panel is scoped to MEDIA guidance. It briefly carried the moodboard and
  // the per-caption rationale too, which turned it into a catch-all the operator
  // had to scroll through to reach the shot list. Asserting their ABSENCE keeps
  // that scope from quietly creeping back.
  it('carries no moodboard and no copywriting rationale', () => {
    setup(true);
    expect(screen.queryByText('Moodboard')).toBeNull();
    expect(screen.queryByText('Copywriting matrix')).toBeNull();
    expect(screen.queryByText('Sea glass green')).toBeNull();
    expect(screen.queryByText('Business context')).toBeNull();
  });

  it('shows the welcome note only when asked', () => {
    render(
      <OverlayStackProvider>
        <CampaignBriefDrawer
          open
          onClose={vi.fn()}
          showWelcome
          direction={MOCK_CREATIVE_DIRECTION}
        />
      </OverlayStackProvider>,
    );
    expect(screen.getByTestId('brief-welcome')).toBeTruthy();
  });

  it('closes on the drawer control', async () => {
    const { onClose } = setup(true);
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalled();
  });
});
