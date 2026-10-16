import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ReactElement } from 'react';
import CaptionOptionGrid from './CaptionOptionGrid';
import { MOCK_CONTENT } from '../../../services/fixtures/content';
import { OverlayStackProvider } from '../../shared/useOverlayStack';

const IG = MOCK_CONTENT.captions.instagram;

/** Wrapped as the app wraps it; the expanded view itself needs no overlay stack. */
function renderGrid(ui: ReactElement) {
  return render(<OverlayStackProvider>{ui}</OverlayStackProvider>);
}

describe('CaptionOptionGrid', () => {
  it('renders one card per option with its name', () => {
    renderGrid(
      <CaptionOptionGrid captions={IG} selectedIndex={null} onSelect={vi.fn()} />,
    );
    expect(screen.getAllByRole('article').length).toBe(3);
    expect(screen.getByText('Witty, Trend-Conscious & High-Energy')).toBeTruthy();
  });

  // The grid is platform-agnostic and must not assume three: auto-fit rather
  // than a hard three-column track is what this covers. Built here rather than
  // read from a fixture — MOCK_CONTENT's naver entry used to be the only
  // two-option set, and it went with the platform.
  it('renders a two-option set without a placeholder card', () => {
    renderGrid(
      <CaptionOptionGrid
        captions={{
          optionNames: IG.optionNames.slice(0, 2),
          options: IG.options.slice(0, 2),
          optionMetadata: IG.optionMetadata.slice(0, 2),
          guide: IG.guide,
        }}
        selectedIndex={null}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getAllByRole('article').length).toBe(2);
  });

  it('sends the option text up on Select and marks the card selected', async () => {
    const onSelect = vi.fn();
    const { rerender } = renderGrid(
      <CaptionOptionGrid captions={IG} selectedIndex={null} onSelect={onSelect} />,
    );
    const cards = screen.getAllByRole('article');
    await userEvent.click(within(cards[1]).getByRole('button', { name: 'Select' }));

    expect(onSelect).toHaveBeenCalledWith(1, IG.options[1]);

    rerender(
      <OverlayStackProvider>
        <CaptionOptionGrid captions={IG} selectedIndex={1} onSelect={onSelect} />
      </OverlayStackProvider>,
    );
    expect(screen.getAllByRole('article')[1]).toHaveAttribute('data-selected', 'true');
    expect(within(screen.getAllByRole('article')[1]).getByRole('button', { name: 'Selected' })).toBeTruthy();
  });

  // Reading in full expands that option over the cards' own area — no modal,
  // nothing dimmed — and the cards stay mounted underneath, unchanged.
  it('expands one option in place over the cards, without a modal', async () => {
    renderGrid(
      <CaptionOptionGrid captions={IG} selectedIndex={null} onSelect={vi.fn()} />,
    );
    const card = screen.getAllByRole('article')[0];
    await userEvent.click(
      within(card).getByRole('button', { name: 'Read Witty, Trend-Conscious & High-Energy in full' }),
    );

    expect(screen.queryByRole('dialog')).toBeNull();
    const panel = screen.getByRole('region', { name: 'Witty, Trend-Conscious & High-Energy' });
    // A fragment, not the whole caption: these carry deliberate blank lines
    // between paragraphs and getByText's exact match works on normalised text.
    expect(within(panel).getByText(/starts the moment the boat cuts the engine/)).toBeTruthy();
    // The row is untouched underneath — still three cards.
    expect(screen.getAllByRole('article', { hidden: true })).toHaveLength(3);
  });

  it('puts the cards back on a click anywhere, or on Escape', async () => {
    const user = userEvent.setup();
    renderGrid(
      <div>
        <p>Elsewhere on the page</p>
        <CaptionOptionGrid captions={IG} selectedIndex={null} onSelect={vi.fn()} />
      </div>,
    );
    const open = () =>
      user.click(screen.getByRole('button', { name: 'Read Formal, Educational & Value-Driven in full' }));

    await open();
    expect(screen.getByRole('region')).toBeTruthy();
    await user.click(screen.getByText('Elsewhere on the page'));
    await waitFor(() => expect(screen.queryByRole('region')).toBeNull());

    await open();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('region')).toBeNull());
    // Focus returns to the control that opened it.
    expect(screen.getByRole('button', { name: 'Read Formal, Educational & Value-Driven in full' })).toHaveFocus();
  });

  it('stages the option from the expanded view and puts the cards back', async () => {
    const onSelect = vi.fn();
    renderGrid(
      <CaptionOptionGrid captions={IG} selectedIndex={null} onSelect={onSelect} />,
    );
    const card = screen.getAllByRole('article')[1];
    await userEvent.click(
      within(card).getByRole('button', { name: 'Read Formal, Educational & Value-Driven in full' }),
    );

    const panel = screen.getByRole('region');
    await userEvent.click(within(panel).getByRole('button', { name: 'Select' }));

    expect(onSelect).toHaveBeenCalledWith(1, IG.options[1]);
    await waitFor(() => expect(screen.queryByRole('region')).toBeNull());
  });
});
