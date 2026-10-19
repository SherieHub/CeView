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
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PublishComposer from './PublishComposer';
import { captureVideoPoster } from './videoPoster';
import { OverlayStackProvider } from '../../shared/useOverlayStack';
import type { PublishDraftState } from './contentStudioTypes';

const uploadMediaMock = vi.fn();
vi.mock('../../../services/mediaUpload', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../services/mediaUpload')>()),
  uploadMedia: (...args: unknown[]) => uploadMediaMock(...args),
}));
vi.mock('./videoPoster', () => ({
  captureVideoPoster: vi.fn(() => Promise.resolve({
    posterDataUrl: 'data:image/jpeg;base64,POSTER', width: 1080, height: 1920, durationSeconds: 12,
  })),
}));

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
    const ta = screen.getByLabelText('Your caption') as HTMLTextAreaElement;
    // The height is set inline from the measured content; CSS hides the
    // scrollbar. Both together are what "no scrolling" means here.
    expect(ta.style.height).not.toBe('');
    expect(ta.className).toContain('textarea--caption');
  });

  it('re-measures when the caption changes without a keystroke', () => {
    const { rerender } = renderComposer('short');
    const ta = screen.getByLabelText('Your caption') as HTMLTextAreaElement;

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
    const ta = screen.getByLabelText('Your caption') as HTMLTextAreaElement;

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
    expect(screen.getByText('Upload an image or video')).toBeTruthy();
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
    expect(onDraftChange).toHaveBeenCalledWith(expect.objectContaining({ mediaDataUrl: null, agreementChecked: false }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});

describe('PublishComposer — media upload', () => {
  beforeEach(() => {
    uploadMediaMock.mockReset();
    URL.createObjectURL = vi.fn(() => 'blob:local-video');
    URL.revokeObjectURL = vi.fn();
  });

  function renderMediaComposer(onDraftChange = vi.fn(), draft: Partial<PublishDraftState> = {}) {
    const utils = render(
      <OverlayStackProvider>
        <PublishComposer
          draft={{ ...DRAFT, ...draft }}
          onDraftChange={onDraftChange}
          audit={{ status: 'idle', step: 0, result: null }}
          platform="instagram"
          part="media"
        />
      </OverlayStackProvider>,
    );
    const input = utils.container.querySelector('input[type="file"]') as HTMLInputElement;
    return { ...utils, input, onDraftChange };
  }

  it('stages an image locally, then uploads it and records the ready state', async () => {
    uploadMediaMock.mockResolvedValue({ mediaId: 'm1', publicUrl: 'https://cdn/m1.jpg', kind: 'image' });
    const { input, onDraftChange } = renderMediaComposer();

    await userEvent.upload(input, new File([new Uint8Array([1, 2, 3])], 'a.png', { type: 'image/png' }));

    await waitFor(() => expect(onDraftChange).toHaveBeenCalledWith(
      expect.objectContaining({ mediaType: 'image', localVideoUrl: null }),
    ));
    expect(onDraftChange).toHaveBeenCalledWith({ mediaUpload: { status: 'uploading' } });
    await waitFor(() => expect(onDraftChange).toHaveBeenCalledWith(
      { mediaUpload: { status: 'ready', mediaId: 'm1', publicUrl: 'https://cdn/m1.jpg' } },
    ));
  });

  it('stages a video as a poster frame plus a playback URL and passes its dimensions to the upload', async () => {
    uploadMediaMock.mockResolvedValue({ mediaId: 'v1', publicUrl: 'https://cdn/v1.mp4', kind: 'video' });
    const { input, onDraftChange } = renderMediaComposer();
    const file = new File([new Uint8Array([1])], 'clip.mp4', { type: 'video/mp4' });

    await userEvent.upload(input, file);

    await waitFor(() => expect(onDraftChange).toHaveBeenCalledWith(expect.objectContaining({
      mediaDataUrl: 'data:image/jpeg;base64,POSTER', mediaType: 'video', localVideoUrl: 'blob:local-video',
    })));
    expect(uploadMediaMock).toHaveBeenCalledWith(file, { width: 1080, height: 1920, durationSeconds: 12 });
  });

  it('rejects an unsupported file type with a clear message and does not upload', async () => {
    const { input } = renderMediaComposer();

    // applyAccept: false — the input's accept filter would otherwise swallow the file first.
    await userEvent.setup({ applyAccept: false }).upload(input, new File(['x'], 'a.gif', { type: 'image/gif' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/isn’t supported/);
    expect(uploadMediaMock).not.toHaveBeenCalled();
  });

  it('rejects an image over 8 MB', async () => {
    const { input } = renderMediaComposer();
    const big = new File([new Uint8Array(8 * 1024 * 1024 + 1)], 'big.jpg', { type: 'image/jpeg' });

    await userEvent.upload(input, big);

    expect(await screen.findByRole('alert')).toHaveTextContent(/over 8 MB/);
    expect(uploadMediaMock).not.toHaveBeenCalled();
  });

  it('reports a failed upload and offers a retry', async () => {
    // One mounted instance throughout: Retry re-runs the file picked below, which the
    // component remembers in a ref.
    uploadMediaMock.mockRejectedValueOnce(new Error('Upload failed (403). Please try again.'));
    const { input, onDraftChange, rerender } = renderMediaComposer();

    await userEvent.upload(input, new File([new Uint8Array([1])], 'a.png', { type: 'image/png' }));
    await waitFor(() => expect(onDraftChange).toHaveBeenCalledWith(
      { mediaUpload: { status: 'failed', message: 'Upload failed (403). Please try again.' } },
    ));

    // The parent would now re-render the composer with the failed state.
    rerender(
      <OverlayStackProvider>
        <PublishComposer
          draft={{ ...DRAFT, mediaDataUrl: 'data:image/png;base64,AAA', mediaType: 'image',
            mediaUpload: { status: 'failed', message: 'Upload failed (403). Please try again.' } }}
          onDraftChange={onDraftChange}
          audit={{ status: 'idle', step: 0, result: null }}
          platform="instagram"
          part="media"
        />
      </OverlayStackProvider>,
    );
    uploadMediaMock.mockResolvedValueOnce({ mediaId: 'm2', publicUrl: 'https://cdn/m2.png', kind: 'image' });

    await userEvent.click(screen.getByRole('button', { name: 'Retry upload' }));

    await waitFor(() => expect(onDraftChange).toHaveBeenCalledWith(
      { mediaUpload: { status: 'ready', mediaId: 'm2', publicUrl: 'https://cdn/m2.png' } },
    ));
  });

  it('removing the media clears the upload state and revokes the video URL', async () => {
    const { onDraftChange } = renderMediaComposer(vi.fn(), {
      mediaDataUrl: 'data:image/jpeg;base64,POSTER', mediaType: 'video', localVideoUrl: 'blob:local-video',
    });

    await userEvent.click(screen.getByRole('button', { name: 'Remove media' }));

    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:local-video');
    expect(onDraftChange).toHaveBeenCalledWith(expect.objectContaining({
      mediaDataUrl: null, localVideoUrl: null, mediaUpload: null,
    }));
  });

  it('shows the uploading and failed states', () => {
    const { rerender } = renderMediaComposer(vi.fn(), {
      mediaDataUrl: 'data:image/png;base64,AAA', mediaUpload: { status: 'uploading' },
    });
    expect(screen.getByText('Uploading media…')).toBeTruthy();

    rerender(
      <OverlayStackProvider>
        <PublishComposer draft={{ ...DRAFT, mediaDataUrl: 'data:image/png;base64,AAA',
          mediaUpload: { status: 'failed', message: 'Storage said no.' } }}
          onDraftChange={vi.fn()} audit={{ status: 'idle', step: 0, result: null }}
          platform="instagram" part="media" />
      </OverlayStackProvider>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Storage said no.');
    expect(screen.getByRole('button', { name: 'Retry upload' })).toBeTruthy();
  });

  it('keeps the previous video URL alive when reading the new file fails', async () => {
    vi.mocked(captureVideoPoster).mockRejectedValueOnce(new Error('boom'));
    // mediaDataUrl is null only so the file input is on screen to drive.
    const { input } = renderMediaComposer(vi.fn(), { mediaType: 'video', localVideoUrl: 'blob:old' });

    await userEvent.upload(input, new File([new Uint8Array([1])], 'clip.mp4', { type: 'video/mp4' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn’t read/);
    expect(URL.revokeObjectURL).not.toHaveBeenCalledWith('blob:old');
  });

  it('revokes the previous video URL once the replacement is committed', async () => {
    uploadMediaMock.mockResolvedValue({ mediaId: 'm1', publicUrl: 'https://cdn/m1.jpg', kind: 'image' });
    const { input, onDraftChange } = renderMediaComposer(vi.fn(), { mediaType: 'video', localVideoUrl: 'blob:old' });

    await userEvent.upload(input, new File([new Uint8Array([1])], 'a.png', { type: 'image/png' }));

    await waitFor(() => expect(onDraftChange).toHaveBeenCalledWith(expect.objectContaining({ mediaType: 'image' })));
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:old');
  });

  it('shows a "Preparing video…" status while the poster is captured', async () => {
    let release!: (v: unknown) => void;
    vi.mocked(captureVideoPoster).mockImplementationOnce(
      () => new Promise((resolve) => { release = resolve as (v: unknown) => void; }) as never,
    );
    uploadMediaMock.mockResolvedValue({ mediaId: 'v1', publicUrl: 'u', kind: 'video' });
    const { input } = renderMediaComposer();

    await userEvent.upload(input, new File([new Uint8Array([1])], 'clip.mp4', { type: 'video/mp4' }));
    const status = await screen.findByText('Preparing video…');
    expect(status.getAttribute('role')).toBe('status');

    release({ posterDataUrl: 'data:image/jpeg;base64,P', width: 1, height: 1, durationSeconds: 1 });
    await waitFor(() => expect(screen.queryByText('Preparing video…')).toBeNull());
  });

  it('clears "Preparing video…" when the video cannot be read', async () => {
    vi.mocked(captureVideoPoster).mockRejectedValueOnce(new Error('boom'));
    const { input } = renderMediaComposer();

    await userEvent.upload(input, new File([new Uint8Array([1])], 'clip.mp4', { type: 'video/mp4' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn’t read/);
    expect(screen.queryByText('Preparing video…')).toBeNull();
  });

  it('ignores the late result of an earlier pick once a newer file is chosen', async () => {
    let resolveA!: (v: unknown) => void;
    uploadMediaMock
      .mockImplementationOnce(() => new Promise((r) => { resolveA = r; }))
      .mockResolvedValueOnce({ mediaId: 'B', publicUrl: 'https://cdn/B.png', kind: 'image' });
    const { input, onDraftChange } = renderMediaComposer();

    await userEvent.upload(input, new File([new Uint8Array([1])], 'a.png', { type: 'image/png' }));
    await waitFor(() => expect(uploadMediaMock).toHaveBeenCalledTimes(1));
    await userEvent.upload(input, new File([new Uint8Array([2])], 'b.png', { type: 'image/png' }));
    await waitFor(() => expect(onDraftChange).toHaveBeenCalledWith(
      { mediaUpload: { status: 'ready', mediaId: 'B', publicUrl: 'https://cdn/B.png' } },
    ));

    resolveA({ mediaId: 'A', publicUrl: 'https://cdn/A.png', kind: 'image' });
    await Promise.resolve();
    await Promise.resolve();

    expect(onDraftChange).not.toHaveBeenCalledWith(
      { mediaUpload: { status: 'ready', mediaId: 'A', publicUrl: 'https://cdn/A.png' } },
    );
  });

  it('applies only the last attempt when Retry is clicked twice', async () => {
    uploadMediaMock.mockRejectedValueOnce(new Error('Upload failed (403). Please try again.'));
    const { input, onDraftChange, rerender } = renderMediaComposer();
    await userEvent.upload(input, new File([new Uint8Array([1])], 'a.png', { type: 'image/png' }));
    await waitFor(() => expect(onDraftChange).toHaveBeenCalledWith(
      { mediaUpload: { status: 'failed', message: 'Upload failed (403). Please try again.' } },
    ));
    rerender(
      <OverlayStackProvider>
        <PublishComposer
          draft={{ ...DRAFT, mediaDataUrl: 'data:image/png;base64,AAA', mediaType: 'image',
            mediaUpload: { status: 'failed', message: 'Upload failed (403). Please try again.' } }}
          onDraftChange={onDraftChange}
          audit={{ status: 'idle', step: 0, result: null }}
          platform="instagram"
          part="media"
        />
      </OverlayStackProvider>,
    );

    const resolvers: Array<(v: unknown) => void> = [];
    uploadMediaMock.mockImplementation(() => new Promise((r) => { resolvers.push(r); }));
    const retry = screen.getByRole('button', { name: 'Retry upload' });
    await userEvent.click(retry);
    await userEvent.click(retry);
    expect(resolvers).toHaveLength(2);

    resolvers[1]({ mediaId: 'second', publicUrl: 'https://cdn/2.png', kind: 'image' });
    await waitFor(() => expect(onDraftChange).toHaveBeenCalledWith(
      { mediaUpload: { status: 'ready', mediaId: 'second', publicUrl: 'https://cdn/2.png' } },
    ));
    resolvers[0]({ mediaId: 'first', publicUrl: 'https://cdn/1.png', kind: 'image' });
    await Promise.resolve();
    await Promise.resolve();

    expect(onDraftChange).not.toHaveBeenCalledWith(
      { mediaUpload: { status: 'ready', mediaId: 'first', publicUrl: 'https://cdn/1.png' } },
    );
  });
});

describe('PublishComposer — uploadToStorage={false} (image-only, no upload)', () => {
  beforeEach(() => {
    uploadMediaMock.mockReset();
    URL.createObjectURL = vi.fn(() => 'blob:local-video');
    URL.revokeObjectURL = vi.fn();
  });

  function renderLocal() {
    const onDraftChange = vi.fn();
    const utils = render(
      <OverlayStackProvider>
        <PublishComposer draft={DRAFT} onDraftChange={onDraftChange}
          audit={{ status: 'idle', step: 0, result: null }} platform="instagram" part="media"
          uploadToStorage={false} />
      </OverlayStackProvider>,
    );
    return { ...utils, onDraftChange, input: utils.container.querySelector('input[type="file"]') as HTMLInputElement };
  }

  it('offers images only, with image-only copy', () => {
    const { input } = renderLocal();
    expect(input.getAttribute('accept')).toBe('image/png,image/jpeg,image/webp');
    expect(screen.getByText('Upload an image')).toBeTruthy();
    expect(screen.getByText('Images up to 8 MB')).toBeTruthy();
  });

  it('stages an image as a data URL only and never uploads', async () => {
    const { input, onDraftChange } = renderLocal();

    await userEvent.upload(input, new File([new Uint8Array([1, 2])], 'a.png', { type: 'image/png' }));

    await waitFor(() => expect(onDraftChange).toHaveBeenCalledTimes(1));
    const patch = onDraftChange.mock.calls[0][0];
    expect(patch.mediaDataUrl).toContain('data:image/png');
    expect(patch.agreementChecked).toBe(false);
    expect(patch).not.toHaveProperty('mediaUpload');
    expect(patch).not.toHaveProperty('mediaType');
    expect(patch).not.toHaveProperty('localVideoUrl');
    expect(uploadMediaMock).not.toHaveBeenCalled();
  });

  it('rejects a video as unsupported', async () => {
    const { input, onDraftChange } = renderLocal();

    await userEvent.setup({ applyAccept: false }).upload(input, new File([new Uint8Array([1])], 'c.mp4', { type: 'video/mp4' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/isn’t supported/);
    expect(onDraftChange).not.toHaveBeenCalled();
    expect(uploadMediaMock).not.toHaveBeenCalled();
  });
});
