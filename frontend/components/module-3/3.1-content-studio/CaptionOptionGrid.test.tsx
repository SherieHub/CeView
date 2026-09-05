import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ReactElement } from 'react';
import CaptionOptionGrid from './CaptionOptionGrid';
import { MOCK_CONTENT } from '../../../services/fixtures/content';
import { OverlayStackProvider } from '../../shared/useOverlayStack';

const IG = MOCK_CONTENT.captions.instagram;

/** The grid mounts a Modal for the maximised view, which joins the overlay stack. */
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

  // Reading in full opens a modal rather than growing the card. In-place
  // expansion pushed the row to the tallest card's height and shifted the two
  // options the reader was comparing against — the comparison the row is for.
  it('opens one option in a modal without changing the row', async () => {
    renderGrid(
      <CaptionOptionGrid captions={IG} selectedIndex={null} onSelect={vi.fn()} />,
    );
    expect(screen.queryByRole('dialog')).toBeNull();

    const card = screen.getAllByRole('article')[0];
    await userEvent.click(
      within(card).getByRole('button', { name: 'Read Witty, Trend-Conscious & High-Energy in full' }),
    );

    const dialog = await screen.findByRole('dialog');
    // A fragment, not the whole caption: these carry deliberate blank lines
    // between paragraphs and getByText's exact match works on normalised text,
    // so the raw multi-paragraph string never matches.
    expect(within(dialog).getByText(/starts the moment the boat cuts the engine/)).toBeTruthy();
    expect(within(dialog).getByRole('heading', { name: 'Witty, Trend-Conscious & High-Energy' })).toBeTruthy();
    // The row is untouched — still three cards, none of them grown.
    expect(screen.getAllByRole('article')).toHaveLength(3);
  });

  it('stages the option from inside the modal and closes it', async () => {
    const onSelect = vi.fn();
    renderGrid(
      <CaptionOptionGrid captions={IG} selectedIndex={null} onSelect={onSelect} />,
    );
    const card = screen.getAllByRole('article')[1];
    await userEvent.click(
      within(card).getByRole('button', { name: 'Read Formal, Educational & Value-Driven in full' }),
    );

    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Select' }));

    expect(onSelect).toHaveBeenCalledWith(1, IG.options[1]);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});
