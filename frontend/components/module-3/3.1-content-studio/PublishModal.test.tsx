import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import PublishModal, { PREVIEW_FIT_MARGIN } from './PublishModal';
import { OverlayStackProvider } from '../../shared/useOverlayStack';
import type { PublishDraftState } from './contentStudioTypes';

const DRAFT: PublishDraftState = {
  caption: 'A staged caption', mediaDataUrl: 'data:image/png;base64,x', platforms: ['instagram'],
  visibility: 'public', commentsEnabled: true, paidPartnership: false, agreementChecked: false,
};

function setup(over: Partial<PublishDraftState> = {}, onConfirm = vi.fn(), onDraftChange = vi.fn()) {
  // Spreads the render result so cases can reach `container` as well as the
  // spies — the DOM assertions below query by class, which screen cannot do.
  const view = render(
    <OverlayStackProvider>
      <PublishModal
        open
        draft={{ ...DRAFT, ...over }}
        onDraftChange={onDraftChange}
        onClose={vi.fn()}
        onConfirm={onConfirm}
      />
    </OverlayStackProvider>,
  );
  return { ...view, onConfirm, onDraftChange };
}

describe('PublishModal', () => {
  it('splits decisions from their consequence', () => {
    const { container } = setup();
    const controls = container.querySelector('.pub-controls') as HTMLElement;
    const preview = container.querySelector('.pub-preview') as HTMLElement;

    // Everything that changes what gets published is on the left...
    expect(within(controls).getByRole('checkbox', { name: /Instagram/ })).toBeTruthy();
    expect(within(controls).getByLabelText('Final caption')).toBeTruthy();
    expect(within(controls).getByRole('checkbox', { name: /authorised to publish/ })).toBeTruthy();
    expect(within(controls).getByRole('radiogroup', { name: 'Visibility' })).toBeTruthy();

    // ...and only the result of it is on the right.
    expect(preview.querySelector('.device-frame')).not.toBeNull();
    expect(within(preview).queryByRole('checkbox')).toBeNull();
  });

  // The platform pills used to sit above the phone, which put the control that
  // changes the preview in the same place as the preview it changed. Selection
  // drives it from the left column now.
  it('previews the selected destination rather than carrying its own tabs', () => {
    const { container } = setup({ platforms: ['tiktok'] });

    expect(screen.queryByRole('tab', { name: 'TikTok Feed' })).toBeNull();
    // TikTok's 9/16 crop, taken from the destination.
    expect((container.querySelector('.device-media') as HTMLElement).style.aspectRatio).toBe('9 / 16');
  });

  it('falls back to Instagram before a destination is chosen', () => {
    const { container } = setup({ platforms: [] });
    expect((container.querySelector('.device-media') as HTMLElement).style.aspectRatio).toBe('4 / 5');
  });

  it('swaps the device frame from the size toggle', async () => {
    const { container } = setup();
    const frame = () => container.querySelector('.device-frame') as HTMLElement;

    expect(frame().getAttribute('data-device')).toBe('mobile');
    expect(container.querySelector('.device-notch')).not.toBeNull();
    expect(container.querySelector('.device-titlebar')).toBeNull();

    await userEvent.click(screen.getByRole('tab', { name: 'Desktop' }));

    expect(frame().getAttribute('data-device')).toBe('desktop');
    // A browser gets traffic lights, not a notch — that swap IS the signal.
    expect(container.querySelector('.device-titlebar')).not.toBeNull();
    expect(container.querySelector('.device-notch')).toBeNull();
  });

  it('carries the distribution controls that the composer gave up', async () => {
    const { onDraftChange } = setup();

    await userEvent.click(screen.getByRole('radio', { name: 'private' }));
    expect(onDraftChange).toHaveBeenCalledWith({ visibility: 'private' });

    await userEvent.click(screen.getByRole('checkbox', { name: /Run as Paid Ad/ }));
    expect(onDraftChange).toHaveBeenCalledWith({ paidPartnership: true });
  });

  it('blocks confirm until the agreement is ticked', () => {
    const { onConfirm } = setup();
    expect(screen.getByRole('button', { name: /Confirm & Publish/ })).toBeDisabled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('blocks confirm when no platform is selected', () => {
    setup({ agreementChecked: true, platforms: [] });
    expect(screen.getByRole('button', { name: /Confirm & Publish/ })).toBeDisabled();
  });

  it('confirms once authorised', async () => {
    const onConfirm = vi.fn();
    setup({ agreementChecked: true }, onConfirm);
    await userEvent.click(screen.getByRole('button', { name: /Confirm & Publish/ }));
    expect(onConfirm).toHaveBeenCalled();
  });

  // The desktop frame is 1100px wide by design; rather than overflow into
  // scrollbars it is measured against the canvas and scaled to fit. jsdom has
  // no layout, so these drive the measurement directly.
  it('scales the frame down to fit the canvas', async () => {
    const { container } = setup();
    const canvas = container.querySelector('.pub-canvas') as HTMLElement;
    const frame = container.querySelector('.device-frame') as HTMLElement;

    // A canvas half the frame's width and a third its height -> the tighter
    // axis wins, so the scale is 1/3.
    Object.defineProperty(frame, 'offsetWidth', { configurable: true, value: 900 });
    Object.defineProperty(frame, 'offsetHeight', { configurable: true, value: 1200 });
    Object.defineProperty(canvas, 'clientWidth', { configurable: true, value: 450 });
    Object.defineProperty(canvas, 'clientHeight', { configurable: true, value: 400 });

    await userEvent.click(screen.getByRole('tab', { name: 'Desktop' }));

    // Derived from the constant, not hardcoded: the margin is a design value
    // that may move, and a literal here would just have to be chased.
    expect(canvas.style.getPropertyValue('--preview-scale'))
      .toBe(String((1 / 3) * PREVIEW_FIT_MARGIN));
  });

  it('never scales UP a frame that already fits', async () => {
    const { container } = setup();
    const canvas = container.querySelector('.pub-canvas') as HTMLElement;
    const frame = container.querySelector('.device-frame') as HTMLElement;

    Object.defineProperty(frame, 'offsetWidth', { configurable: true, value: 300 });
    Object.defineProperty(frame, 'offsetHeight', { configurable: true, value: 500 });
    Object.defineProperty(canvas, 'clientWidth', { configurable: true, value: 1200 });
    Object.defineProperty(canvas, 'clientHeight', { configurable: true, value: 900 });

    await userEvent.click(screen.getByRole('tab', { name: 'Tablet' }));

    // Capped at 1 before the margin, so a frame that already fits is never
    // blown up — it just keeps its breathing room.
    expect(canvas.style.getPropertyValue('--preview-scale')).toBe(String(PREVIEW_FIT_MARGIN));
  });

  // A canvas that has not been laid out yet reports 0. Dividing by it would
  // collapse the preview to nothing on first paint.
  it('leaves the scale at 1:1 when nothing has been measured', () => {
    const { container } = setup();
    const canvas = container.querySelector('.pub-canvas') as HTMLElement;
    expect(canvas.style.getPropertyValue('--preview-scale')).toBe('1');
  });

  // The reported bug: pressing the same device button repeatedly produced a
  // different zoom each time, because the frame's `width` was transitioning
  // when the fit measured it. Only the transform animates now, so a given
  // device must always settle on the same scale.
  it('settles on the same scale each time a device is re-selected', async () => {
    const { container } = setup();
    const canvas = container.querySelector('.pub-canvas') as HTMLElement;
    const frame = container.querySelector('.device-frame') as HTMLElement;

    Object.defineProperty(canvas, 'clientWidth', { configurable: true, value: 800 });
    Object.defineProperty(canvas, 'clientHeight', { configurable: true, value: 600 });

    // Stand in for layout: each device reports its own settled size.
    const sizes: Record<string, [number, number]> = {
      mobile: [324, 700],
      tablet: [484, 900],
      desktop: [1100, 1500],
    };
    Object.defineProperty(frame, 'offsetWidth', {
      configurable: true,
      get: () => sizes[frame.getAttribute('data-device') ?? 'mobile'][0],
    });
    Object.defineProperty(frame, 'offsetHeight', {
      configurable: true,
      get: () => sizes[frame.getAttribute('data-device') ?? 'mobile'][1],
    });

    const scaleAfter = async (label: string) => {
      await userEvent.click(screen.getByRole('tab', { name: label }));
      return canvas.style.getPropertyValue('--preview-scale');
    };

    const first = await scaleAfter('Desktop');
    await scaleAfter('Mobile');
    const second = await scaleAfter('Desktop');
    await scaleAfter('Tablet');
    const third = await scaleAfter('Desktop');

    expect(first).toBe(second);
    expect(second).toBe(third);
    // 600/1500 is the tighter axis, so Desktop lands on the same value every
    // time — 0.4, less the fit margin.
    expect(first).toBe(String(0.4 * PREVIEW_FIT_MARGIN));
  });

  // The desktop preview rendered blank because the canvas reported zero height
  // and the old fit bailed out entirely, leaving the frame at 1:1 and
  // overflowing. An axis that reports 0 must simply not constrain.
  it('still fits on width when the canvas has no measurable height', async () => {
    const { container } = setup();
    const canvas = container.querySelector('.pub-canvas') as HTMLElement;
    const frame = container.querySelector('.device-frame') as HTMLElement;

    Object.defineProperty(frame, 'offsetWidth', { configurable: true, value: 1000 });
    Object.defineProperty(frame, 'offsetHeight', { configurable: true, value: 1400 });
    Object.defineProperty(canvas, 'clientWidth', { configurable: true, value: 500 });
    Object.defineProperty(canvas, 'clientHeight', { configurable: true, value: 0 });

    await userEvent.click(screen.getByRole('tab', { name: 'Desktop' }));

    // Width still constrains: 500/1000, less the margin. Emphatically not 1.
    expect(canvas.style.getPropertyValue('--preview-scale'))
      .toBe(String(0.5 * PREVIEW_FIT_MARGIN));
  });

  // The property that actually matters, and the one three rounds of clipping
  // kept violating: whatever the canvas and frame measure, the SCALED frame
  // must land inside the canvas on both axes. Checked across shapes that have
  // each caused a visible cut — a tall desktop frame in a short canvas, a wide
  // frame in a narrow one, and a frame already smaller than the space.
  it.each([
    ['tall frame, short canvas', 1100, 1600, 1300, 500],
    ['wide frame, narrow canvas', 1100, 700, 420, 900],
    ['frame already fits', 300, 620, 900, 800],
    ['square-ish canvas', 460, 900, 600, 600],
  ])('keeps the scaled frame inside the canvas — %s', async (_name, fw, fh, cw, ch) => {
    const { container } = setup();
    const canvas = container.querySelector('.pub-canvas') as HTMLElement;
    const frame = container.querySelector('.device-frame') as HTMLElement;

    Object.defineProperty(frame, 'offsetWidth', { configurable: true, value: fw });
    Object.defineProperty(frame, 'offsetHeight', { configurable: true, value: fh });
    Object.defineProperty(canvas, 'clientWidth', { configurable: true, value: cw });
    Object.defineProperty(canvas, 'clientHeight', { configurable: true, value: ch });

    // Any device switch re-runs the fit against the numbers above.
    await userEvent.click(screen.getByRole('tab', { name: 'Desktop' }));

    const k = Number(canvas.style.getPropertyValue('--preview-scale'));
    expect(k).toBeGreaterThan(0);
    expect(k).toBeLessThanOrEqual(1);
    expect(fw * k).toBeLessThanOrEqual(cw);
    expect(fh * k).toBeLessThanOrEqual(ch);
  });
});
