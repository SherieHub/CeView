/**
 * The staged caption grows to its content instead of scrolling.
 *
 * jsdom reports scrollHeight as 0, so these assert the MECHANISM rather than a
 * pixel height: that the effect resets to `auto` before measuring, and that it
 * re-runs when the value changes without a keystroke (which is how staging an
 * option from the grid above reaches this field). The reset is the part worth
 * guarding — without it scrollHeight is measured against the current height and
 * the field can only ever grow, so deleting text leaves it stuck at its tallest.
 */
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import PublishComposer from './PublishComposer';
import { OverlayStackProvider } from '../../shared/useOverlayStack';
import type { PublishDraftState } from './contentStudioTypes';

const DRAFT: PublishDraftState = {
  caption: 'one line', mediaDataUrl: null, platforms: [], visibility: 'public',
  commentsEnabled: true, paidPartnership: false, agreementChecked: false,
};

/** The composer mounts a Modal for the full-size media, which joins the stack. */
function renderComposer(caption: string) {
  return render(
    <OverlayStackProvider>
    <PublishComposer
      draft={{ ...DRAFT, caption }}
      onDraftChange={vi.fn()}
      audit={{ status: 'idle', step: 0, result: null }}
      platform="instagram"
    />
    </OverlayStackProvider>,
  );
}

describe('PublishComposer — caption sizing', () => {
  it('does not leave the caption field scrollable', () => {
    renderComposer('a\nb\nc\nd\ne\nf\ng\nh');
    const ta = screen.getByLabelText('Staged caption') as HTMLTextAreaElement;
    // The height is set inline from the measured content; CSS hides the
    // scrollbar. Both together are what "no scrolling" means here.
    expect(ta.style.height).not.toBe('');
    expect(ta.className).toContain('textarea--caption');
  });

  it('re-measures when the caption changes without a keystroke', () => {
    const { rerender } = renderComposer('short');
    const ta = screen.getByLabelText('Staged caption') as HTMLTextAreaElement;

    // Record what the effect wrote, then stand in for a real layout engine by
    // reporting a taller content box on the next pass.
    const before = ta.style.height;
    Object.defineProperty(ta, 'scrollHeight', { configurable: true, value: 420 });

    rerender(
      <OverlayStackProvider><PublishComposer
        draft={{ ...DRAFT, caption: 'a much longer caption\n\nwith paragraphs' }}
        onDraftChange={vi.fn()}
        audit={{ status: 'idle', step: 0, result: null }}
        platform="instagram"
      /></OverlayStackProvider>,
    );

    expect(ta.style.height).toBe('420px');
    expect(ta.style.height).not.toBe(before);
  });

  // The `height: auto` reset before measuring is what lets the field shrink:
  // scrollHeight is measured against the CURRENT height, so without it the
  // field can only ever grow and deleting text leaves it stuck at its tallest.
  //
  // jsdom has no layout, so a shrink cannot be observed through scrollHeight —
  // it returns whatever it is told, reset or not. What IS observable is the
  // ORDER of writes to style.height, so that is what this asserts.
  it('resets the height before measuring, so the field can shrink', () => {
    const { rerender } = renderComposer('short');
    const ta = screen.getByLabelText('Staged caption') as HTMLTextAreaElement;

    const writes: string[] = [];
    const proto = Object.getPrototypeOf(ta.style) as CSSStyleDeclaration;
    const descriptor = Object.getOwnPropertyDescriptor(proto, 'height')!;
    Object.defineProperty(ta.style, 'height', {
      configurable: true,
      get: () => descriptor.get!.call(ta.style),
      set: (value: string) => {
        writes.push(value);
        descriptor.set!.call(ta.style, value);
      },
    });
    Object.defineProperty(ta, 'scrollHeight', { configurable: true, value: 260 });

    rerender(
      <OverlayStackProvider><PublishComposer
        draft={{ ...DRAFT, caption: 'a different caption' }}
        onDraftChange={vi.fn()}
        audit={{ status: 'idle', step: 0, result: null }}
        platform="instagram"
      /></OverlayStackProvider>,
    );

    expect(writes).toEqual(['auto', '260px']);
  });

  // The preview is cropped to fill its column, so the only way to see what the
  // crop is cutting is to open the image uncropped.
  it('opens the staged media full size in a modal', async () => {
    render(
      <OverlayStackProvider>
        <PublishComposer
          draft={{ ...DRAFT, mediaDataUrl: 'data:image/png;base64,zzz' }}
          onDraftChange={vi.fn()}
          audit={{ status: 'idle', step: 0, result: null }}
          platform="instagram"
        />
      </OverlayStackProvider>,
    );
    expect(screen.queryByRole('dialog')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'View media full size' }));

    const dialog = await screen.findByRole('dialog');
    const full = within(dialog).getByAltText('Publication media at full size') as HTMLImageElement;
    expect(full.src).toContain('base64,zzz');
    // object-fit: contain, not the column's cover crop.
    expect(full.className).toContain('media-full');
  });

  it('offers no maximize control when nothing is staged', () => {
    render(
      <OverlayStackProvider>
        <PublishComposer
          draft={DRAFT}
          onDraftChange={vi.fn()}
          audit={{ status: 'idle', step: 0, result: null }}
          platform="instagram"
        />
      </OverlayStackProvider>,
    );
    expect(screen.queryByRole('button', { name: 'View media full size' })).toBeNull();
    expect(screen.getByText('Upload PNG, JPG, or WEBP')).toBeTruthy();
  });

  it('removes the media without opening the modal', async () => {
    const onDraftChange = vi.fn();
    render(
      <OverlayStackProvider>
        <PublishComposer
          draft={{ ...DRAFT, mediaDataUrl: 'data:image/png;base64,zzz' }}
          onDraftChange={onDraftChange}
          audit={{ status: 'idle', step: 0, result: null }}
          platform="instagram"
        />
      </OverlayStackProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Remove media' }));
    expect(onDraftChange).toHaveBeenCalledWith({ mediaDataUrl: null, agreementChecked: false });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});
