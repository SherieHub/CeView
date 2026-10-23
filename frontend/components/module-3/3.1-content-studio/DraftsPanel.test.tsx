import { act, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ComponentProps } from 'react';
import DraftsPanel from './DraftsPanel';
import DraftsBar from './DraftsBar';
import SaveDraftButton, { SAVED_FEEDBACK_MS, quickDraftName, useQuickSaveDraft } from './SaveDraftButton';
import { ApiError } from '../../../services/apiError';
import { OverlayStackProvider } from '../../shared/useOverlayStack';
import type { ContentDraftSummary } from '../../../types';

const DRAFTS: ContentDraftSummary[] = [
  { id: 'd1', kind: 'named', name: 'Golden hour', market: 'japan', demandAlertId: null, captionPreview: 'Sunset swim', updatedAt: '2026-10-22T08:00:00Z' },
  { id: 'd2', kind: 'named', name: 'Reef wall', market: 'japan', demandAlertId: null, captionPreview: '', updatedAt: '2026-10-21T08:00:00Z' },
];

function setup(over: Partial<ComponentProps<typeof DraftsPanel>> = {}) {
  const props = {
    open: true, onClose: vi.fn(), marketName: 'Japan', drafts: DRAFTS, loadFailed: false, hasWork: false, canSave: true,
    onSave: vi.fn().mockResolvedValue(undefined), onOpen: vi.fn().mockResolvedValue(undefined),
    onRename: vi.fn().mockResolvedValue(undefined), onRemove: vi.fn().mockResolvedValue(undefined), ...over,
  };
  render(<OverlayStackProvider><DraftsPanel {...props} /></OverlayStackProvider>);
  return props;
}

describe('DraftsPanel', () => {
  it('lists the saved drafts for this market with their caption preview', () => {
    setup();
    expect(screen.getByText('Golden hour')).toBeInTheDocument();
    expect(screen.getByText('Sunset swim')).toBeInTheDocument();
    expect(screen.getByText('Reef wall')).toBeInTheDocument();
  });

  it('shows an empty state', () => {
    setup({ drafts: [] });
    expect(screen.getByText('No saved drafts yet.')).toBeInTheDocument();
  });

  it('saves the current work under a trimmed name, then clears the field', async () => {
    const { onSave } = setup();
    const save = screen.getByRole('button', { name: 'Save draft' });
    expect(save).toBeDisabled();

    await userEvent.type(screen.getByLabelText('Save current as'), '  My draft  ');
    await userEvent.click(save);

    await waitFor(() => expect(onSave).toHaveBeenCalledWith('My draft'));
    await waitFor(() => expect((screen.getByLabelText('Save current as') as HTMLInputElement).value).toBe(''));
  });

  it('cannot save before captions exist', () => {
    setup({ canSave: false });
    expect(screen.getByRole('button', { name: 'Save draft' })).toBeDisabled();
    expect(screen.getByText(/appear here to save/i)).toBeInTheDocument();
  });

  it('opens a draft straight away when there is nothing to replace', async () => {
    const { onOpen, onClose } = setup({ hasWork: false });
    await userEvent.click(screen.getByRole('button', { name: 'Open Golden hour' }));
    await waitFor(() => expect(onOpen).toHaveBeenCalledWith('d1'));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('asks before replacing a caption being worked on', async () => {
    const { onOpen } = setup({ hasWork: true });
    await userEvent.click(screen.getByRole('button', { name: 'Open Golden hour' }));
    expect(onOpen).not.toHaveBeenCalled();

    const group = screen.getByRole('group', { name: /Replace caption with Golden hour/ });
    await userEvent.click(within(group).getByRole('button', { name: 'Replace' }));
    await waitFor(() => expect(onOpen).toHaveBeenCalledWith('d1'));
  });

  it('renames a draft in place', async () => {
    const { onRename } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Rename Golden hour' }));
    const input = screen.getByLabelText('New name for Golden hour');
    await userEvent.clear(input);
    await userEvent.type(input, 'Sunrise');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onRename).toHaveBeenCalledWith('d1', 'Sunrise'));
  });

  it('asks before deleting, and cancel keeps the draft', async () => {
    const { onRemove } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Delete Reef wall' }));
    const group = screen.getByRole('group', { name: 'Delete Reef wall' });
    await userEvent.click(within(group).getByRole('button', { name: 'Cancel' }));
    expect(onRemove).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Delete Reef wall' }));
    const again = screen.getByRole('group', { name: 'Delete Reef wall' });
    await userEvent.click(within(again).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(onRemove).toHaveBeenCalledWith('d2'));
  });

  it('says so when an action fails', async () => {
    setup({ onOpen: vi.fn().mockRejectedValue(new Error('nope')) });
    await userEvent.click(screen.getByRole('button', { name: 'Open Golden hour' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/open that draft/i);
  });
});

describe('DraftsBar', () => {
  const baseProps = {
    status: 'saved' as const, savedAt: new Date(Date.now() - 2 * 60000), namedCount: 2, stale: false, hasWork: true,
    regenerating: false, onOpenDrafts: vi.fn(), onRegenerate: vi.fn(), onRetry: vi.fn(),
  };

  it('shows when the draft was last saved and how many drafts are kept', () => {
    render(<DraftsBar {...baseProps} />);
    expect(screen.getByRole('status')).toHaveTextContent('Draft saved · 2 min ago');
    expect(screen.getByRole('button', { name: 'Drafts (2)' })).toBeInTheDocument();
  });

  it('offers a retry when saving failed', async () => {
    const onRetry = vi.fn();
    render(<DraftsBar {...baseProps} status="error" onRetry={onRetry} />);
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalled();
  });

  it('regenerates straight away with no work to lose, and confirms first otherwise', async () => {
    const onRegenerate = vi.fn();
    const { rerender } = render(<DraftsBar {...baseProps} hasWork={false} onRegenerate={onRegenerate} />);
    await userEvent.click(screen.getByRole('button', { name: /Regenerate captions/ }));
    expect(onRegenerate).toHaveBeenCalledTimes(1);

    rerender(<DraftsBar {...baseProps} hasWork onRegenerate={onRegenerate} />);
    await userEvent.click(screen.getByRole('button', { name: /Regenerate captions/ }));
    expect(onRegenerate).toHaveBeenCalledTimes(1);
    const group = screen.getByRole('group', { name: 'Confirm regenerate' });
    await userEvent.click(within(group).getByRole('button', { name: 'Regenerate' }));
    expect(onRegenerate).toHaveBeenCalledTimes(2);
  });

  it('flags a stale draft', () => {
    render(<DraftsBar {...baseProps} stale />);
    expect(screen.getByRole('note')).toHaveTextContent(/earlier surge window/i);
  });
});

describe('DraftsPanel — which drafts are ready to publish', () => {
  const base = DRAFTS[0];

  it('marks a draft with an image and a passing audit as ready, with its score', () => {
    setup({ drafts: [{ ...base, hasMedia: true, mediaUrl: 'https://cdn/x.png', auditStatus: 'Pass', auditScore: 84 }] });
    expect(screen.getByText('Ready to publish · 84')).toBeInTheDocument();
    expect(document.querySelector('img.ds-item-thumb')).toHaveAttribute('src', 'https://cdn/x.png');
  });

  it('says what is missing otherwise', () => {
    setup({
      drafts: [
        { ...base, id: 'a', name: 'A', hasMedia: false, mediaUrl: null, auditStatus: null, auditScore: null },
        { ...base, id: 'b', name: 'B', hasMedia: true, mediaUrl: null, auditStatus: 'Fail', auditScore: 52 },
        { ...base, id: 'c', name: 'C', hasMedia: true, mediaUrl: null, auditStatus: null, auditScore: null },
      ],
    });
    expect(screen.getByText('No image · No audit yet')).toBeInTheDocument();
    expect(screen.getByText('Audit failed · 52')).toBeInTheDocument();
    expect(screen.getByText('No audit yet')).toBeInTheDocument();
    expect(screen.queryByText(/Ready to publish/)).toBeNull();
  });

  it('shows nothing about readiness for a backend that does not report it, and no thumbnail without an image', () => {
    setup({ drafts: [base] });
    expect(screen.queryByText(/Ready to publish|No image|No audit/)).toBeNull();
    expect(document.querySelector('img.ds-item-thumb')).toBeNull();
  });
});

describe('DraftsPanel — the draft the work is, and saving a copy', () => {
  it('tags the saved draft the work on screen is as Current', () => {
    setup({ currentDraftId: 'd2' });
    const current = screen.getAllByText('Current');
    expect(current).toHaveLength(1);
    expect(current[0].closest('.ds-item')).toHaveTextContent('Reef wall');
  });

  it('tags nothing when the work is not a saved draft', () => {
    setup({ currentDraftId: null });
    expect(screen.queryByText('Current')).toBeNull();
  });

  it('says so, and keeps the name, when identical work is already saved', async () => {
    const onSave = vi.fn().mockResolvedValue({ alreadySavedAs: 'Golden hour' });
    setup({ onSave });

    await userEvent.type(screen.getByLabelText('Save current as'), 'Another name');
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));

    expect(await screen.findByText(/already saved as “Golden hour”/)).toBeInTheDocument();
    expect((screen.getByLabelText('Save current as') as HTMLInputElement).value).toBe('Another name');
  });
});

describe('SaveDraftButton', () => {
  afterEach(() => vi.useRealTimers());

  it('is a filled primary button that saves on one click', async () => {
    const onSave = vi.fn();
    render(<SaveDraftButton state="idle" onSave={onSave} canSave />);
    const button = screen.getByRole('button', { name: 'Save draft' });
    expect(button).toHaveClass('btn-cta');
    await userEvent.click(button);
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('is disabled until there are captions to save, and while saving', () => {
    const { rerender } = render(<SaveDraftButton state="idle" onSave={vi.fn()} canSave={false} />);
    expect(screen.getByRole('button', { name: 'Save draft' })).toBeDisabled();
    rerender(<SaveDraftButton state="saving" onSave={vi.fn()} canSave />);
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();
  });

  it('confirms on the button itself, and says how to retry or what is wrong', () => {
    const { rerender } = render(
      <SaveDraftButton state="saved" outcome={{ kind: 'created', name: 'Japan' }} onSave={vi.fn()} canSave />,
    );
    expect(screen.getByRole('button', { name: 'Saved' })).toBeInTheDocument();
    expect(screen.getByText('Find it under Drafts')).toBeInTheDocument();

    rerender(<SaveDraftButton state="error" onSave={vi.fn()} canSave />);
    expect(screen.getByRole('button', { name: 'Retry save' })).toBeEnabled();
    expect(screen.getByText('Couldn’t save your draft.')).toBeInTheDocument();

    rerender(<SaveDraftButton state="limit" onSave={vi.fn()} canSave />);
    expect(screen.getByText(/Draft limit reached/)).toBeInTheDocument();
  });

  it('reads Save changes for work that was saved and then edited', () => {
    render(<SaveDraftButton state="idle" mode="update" onSave={vi.fn()} canSave />);
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled();
  });

  it('is a disabled Saved, naming the draft it matches, when nothing has changed since saving', async () => {
    const onSave = vi.fn();
    render(<SaveDraftButton state="idle" mode="clean" linkedName="Japan · Oct 23, 6:05 AM" onSave={onSave} canSave />);

    const button = screen.getByRole('button', { name: 'Saved' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('title', 'Up to date with “Japan · Oct 23, 6:05 AM”');
    await userEvent.click(button);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('says what a save did: updated, or already saved', () => {
    const { rerender } = render(
      <SaveDraftButton state="saved" mode="clean" outcome={{ kind: 'updated', name: 'Reef wall' }} onSave={vi.fn()} canSave />,
    );
    expect(screen.getByText('Updated “Reef wall”')).toBeInTheDocument();

    rerender(<SaveDraftButton state="saved" mode="clean" outcome={{ kind: 'existing', name: 'Reef wall' }} onSave={vi.fn()} canSave />);
    expect(screen.getByText('Already saved as “Reef wall”')).toBeInTheDocument();
  });

  it('can still be retried after a failed save, even if the work was linked and unchanged', () => {
    render(<SaveDraftButton state="error" mode="clean" onSave={vi.fn()} canSave />);
    expect(screen.getByRole('button', { name: 'Retry save' })).toBeEnabled();
  });

  it('names a quick draft by market and time', () => {
    const name = quickDraftName('Japan', new Date(2026, 9, 23, 15, 41));
    expect(name.startsWith('Japan · ')).toBe(true);
    expect(name).toMatch(/23/);
  });
});

describe('useQuickSaveDraft', () => {
  afterEach(() => vi.useRealTimers());

  it('goes saving, then saved, then back to idle after a moment', async () => {
    vi.useFakeTimers();
    let finish!: () => void;
    const outcome = { kind: 'created' as const, name: 'Japan' };
    const save = vi.fn(() => new Promise<typeof outcome>((resolve) => { finish = () => resolve(outcome); }));
    const { result } = renderHook(() => useQuickSaveDraft(save));

    act(() => { void result.current.run(); });
    expect(result.current.state).toBe('saving');

    await act(async () => { finish(); });
    expect(result.current.state).toBe('saved');
    expect(result.current.outcome).toEqual(outcome);

    act(() => { vi.advanceTimersByTime(SAVED_FEEDBACK_MS + 10); });
    expect(result.current.state).toBe('idle');
  });

  it('ignores a second click while a save is under way', async () => {
    let finish!: () => void;
    const save = vi.fn(() => new Promise<{ kind: 'created'; name: string }>((resolve) => {
      finish = () => resolve({ kind: 'created', name: 'Japan' });
    }));
    const { result } = renderHook(() => useQuickSaveDraft(save));

    act(() => { void result.current.run(); void result.current.run(); });
    await act(async () => { finish(); });

    expect(save).toHaveBeenCalledTimes(1);
  });

  it('reports a failure, and the draft limit separately', async () => {
    const failing = vi.fn().mockRejectedValue(new Error('offline'));
    const first = renderHook(() => useQuickSaveDraft(failing));
    await act(async () => { await first.result.current.run(); });
    expect(first.result.current.state).toBe('error');

    const limited = vi.fn().mockRejectedValue(
      new ApiError({ status: 409, method: 'POST', path: '/api/content/drafts', body: { code: 'MOD31_DRAFT_LIMIT' } }),
    );
    const second = renderHook(() => useQuickSaveDraft(limited));
    await act(async () => { await second.result.current.run(); });
    expect(second.result.current.state).toBe('limit');
  });
});

describe('DraftsBar — toolbar and caption cooldown', () => {
  const props = {
    status: 'saved' as const, savedAt: new Date(Date.now() - 60_000), namedCount: 1, stale: false, hasWork: false,
    regenerating: false, onOpenDrafts: vi.fn(), onRegenerate: vi.fn(), onRetry: vi.fn(),
  };

  it('puts Save draft at the far right, after Drafts', () => {
    render(
      <DraftsBar {...props} quickSave={{ state: 'idle', onSave: vi.fn(), canSave: true }} />,
    );
    const buttons = within(document.querySelector('.ds-actions') as HTMLElement).getAllByRole('button');
    const names = buttons.map((b) => b.textContent?.trim());
    expect(names.at(-1)).toBe('Save draft');
    expect(names.at(-2)).toBe('Drafts (1)');
    expect(screen.getByRole('button', { name: 'Save draft' })).toHaveClass('btn-cta');
  });

  it('saves when Save draft is pressed', async () => {
    const onSave = vi.fn();
    render(<DraftsBar {...props} quickSave={{ state: 'idle', onSave, canSave: true }} />);
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('offers no Save draft when it is not wired up', () => {
    render(<DraftsBar {...props} />);
    expect(screen.queryByRole('button', { name: 'Save draft' })).toBeNull();
  });

  it('shows Regenerate only on the caption step, keeping Drafts and Save draft on every step', () => {
    const { rerender } = render(
      <DraftsBar {...props} showRegenerate quickSave={{ state: 'idle', onSave: vi.fn(), canSave: true }} />,
    );
    expect(screen.getByRole('button', { name: /Regenerate captions/ })).toBeInTheDocument();

    rerender(<DraftsBar {...props} showRegenerate={false} quickSave={{ state: 'idle', onSave: vi.fn(), canSave: true }} />);
    expect(screen.queryByRole('button', { name: /Regenerate captions/ })).toBeNull();
    expect(screen.getByRole('button', { name: /^Drafts/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save draft' })).toBeInTheDocument();
  });

  it('abandons a half-answered "Replace these captions?" when the caption step is left', async () => {
    const { rerender } = render(<DraftsBar {...props} hasWork showRegenerate />);
    await userEvent.click(screen.getByRole('button', { name: /Regenerate captions/ }));
    expect(screen.getByRole('group', { name: 'Confirm regenerate' })).toBeInTheDocument();

    rerender(<DraftsBar {...props} hasWork showRegenerate={false} />);
    rerender(<DraftsBar {...props} hasWork showRegenerate />);

    expect(screen.queryByRole('group', { name: 'Confirm regenerate' })).toBeNull();
    expect(screen.getByRole('button', { name: /Regenerate captions/ })).toBeInTheDocument();
  });

  it('hides the stale-draft notice where its Regenerate control is not', () => {
    const { rerender } = render(<DraftsBar {...props} stale showRegenerate />);
    expect(screen.getByRole('note')).toBeInTheDocument();
    rerender(<DraftsBar {...props} stale showRegenerate={false} />);
    expect(screen.queryByRole('note')).toBeNull();
  });

  it('waits out the caption cooldown, with a countdown on the button', async () => {
    const onRegenerate = vi.fn();
    render(<DraftsBar {...props} cooldownSeconds={42} onRegenerate={onRegenerate} />);

    const button = screen.getByRole('button', { name: 'Regenerate captions (42s)' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('title', expect.stringMatching(/rate limit/i));
    await userEvent.click(button);
    expect(onRegenerate).not.toHaveBeenCalled();
  });

  it('is available again with the cooldown at zero', () => {
    render(<DraftsBar {...props} cooldownSeconds={0} />);
    expect(screen.getByRole('button', { name: 'Regenerate captions' })).toBeEnabled();
  });
});
