import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AUTOSAVE_DELAY_MS, useContentDrafts } from './useContentDrafts';
import { buildPayload } from './contentDraftPayload';
import { buildContentResponse } from './testFixtures';

const api = vi.hoisted(() => ({
  getAuto: vi.fn(), saveAuto: vi.fn(), list: vi.fn(), get: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn(),
}));
vi.mock('../../../services/apiClient', () => ({ apiClient: { contentDrafts: api } }));

const payloadFor = (caption: string) => buildPayload({
  content: buildContentResponse('groq'), activePlatform: 'instagram', selectedOption: null, qpStep: 'draft',
  draft: {
    caption, mediaDataUrl: null, platforms: [], visibility: 'public', commentsEnabled: true,
    paidPartnership: false, agreementChecked: false,
  },
  alertId: 'alert-1', windowOpenDate: null, fingerprint: 'fp',
});

beforeEach(() => {
  Object.values(api).forEach((m) => m.mockReset());
  api.getAuto.mockResolvedValue(null);
  api.saveAuto.mockResolvedValue({});
  api.list.mockResolvedValue([]);
});
afterEach(() => vi.useRealTimers());

describe('useContentDrafts', () => {
  it('is restoring until the market lookup settles, then offers the saved draft', async () => {
    api.getAuto.mockResolvedValue({ payload: payloadFor('saved'), updatedAt: '2026-10-22T00:00:00Z' });
    const { result } = renderHook(() => useContentDrafts('japan', true));

    expect(result.current.restoring).toBe(true);
    await waitFor(() => expect(result.current.restoring).toBe(false));
    expect(result.current.restored?.draft.caption).toBe('saved');
    expect(api.getAuto).toHaveBeenCalledWith('japan');
  });

  it('offers nothing when there is no draft, the payload is unreadable, or the lookup fails', async () => {
    const none = renderHook(() => useContentDrafts('japan', true));
    await waitFor(() => expect(none.result.current.restoring).toBe(false));
    expect(none.result.current.restored).toBeNull();

    api.getAuto.mockResolvedValue({ payload: { schemaVersion: 99 }, updatedAt: '2026-10-22T00:00:00Z' });
    const bad = renderHook(() => useContentDrafts('korea', true));
    await waitFor(() => expect(bad.result.current.restoring).toBe(false));
    expect(bad.result.current.restored).toBeNull();

    api.getAuto.mockRejectedValue(new Error('down'));
    const failed = renderHook(() => useContentDrafts('usa', true));
    await waitFor(() => expect(failed.result.current.restoring).toBe(false));
    expect(failed.result.current.restored).toBeNull();
  });

  it('does nothing while disabled', () => {
    const { result } = renderHook(() => useContentDrafts('japan', false));
    expect(result.current.restoring).toBe(false);
    expect(api.getAuto).not.toHaveBeenCalled();
  });

  it('debounces auto-saves into one write of the latest payload', async () => {
    const { result } = renderHook(() => useContentDrafts('japan', true));
    await waitFor(() => expect(result.current.restoring).toBe(false));
    vi.useFakeTimers();

    act(() => {
      result.current.scheduleSave('japan', 'alert-1', payloadFor('a'));
      result.current.scheduleSave('japan', 'alert-1', payloadFor('ab'));
      result.current.scheduleSave('japan', 'alert-1', payloadFor('abc'));
    });
    expect(api.saveAuto).not.toHaveBeenCalled();

    await act(async () => { vi.advanceTimersByTime(AUTOSAVE_DELAY_MS); });
    expect(api.saveAuto).toHaveBeenCalledTimes(1);
    expect(api.saveAuto.mock.calls[0][0]).toBe('japan');
    expect(api.saveAuto.mock.calls[0][1]).toBe('alert-1');
    expect(api.saveAuto.mock.calls[0][2].draft.caption).toBe('abc');
    expect(result.current.status).toBe('saved');
  });

  it('skips a save that changes nothing', async () => {
    api.getAuto.mockResolvedValue({ payload: payloadFor('same'), updatedAt: '2026-10-22T00:00:00Z' });
    const { result } = renderHook(() => useContentDrafts('japan', true));
    await waitFor(() => expect(result.current.restoring).toBe(false));
    vi.useFakeTimers();

    act(() => { result.current.scheduleSave('japan', 'alert-1', payloadFor('same')); });
    await act(async () => { vi.advanceTimersByTime(AUTOSAVE_DELAY_MS * 2); });
    expect(api.saveAuto).not.toHaveBeenCalled();
  });

  it('flushes a pending save when the studio unmounts', async () => {
    const { result, unmount } = renderHook(() => useContentDrafts('japan', true));
    await waitFor(() => expect(result.current.restoring).toBe(false));

    act(() => { result.current.scheduleSave('japan', 'alert-1', payloadFor('about to leave')); });
    expect(api.saveAuto).not.toHaveBeenCalled();
    unmount();

    expect(api.saveAuto).toHaveBeenCalledTimes(1);
    expect(api.saveAuto.mock.calls[0][2].draft.caption).toBe('about to leave');
  });

  it('flushes the old market save, under the old market, when the market changes', async () => {
    const { result, rerender } = renderHook(({ market }) => useContentDrafts(market, true), {
      initialProps: { market: 'japan' },
    });
    await waitFor(() => expect(result.current.restoring).toBe(false));

    act(() => { result.current.scheduleSave('japan', 'alert-1', payloadFor('japan edit')); });
    rerender({ market: 'korea' });

    expect(api.saveAuto).toHaveBeenCalledTimes(1);
    expect(api.saveAuto.mock.calls[0][0]).toBe('japan');
    await waitFor(() => expect(api.getAuto).toHaveBeenCalledWith('korea'));
  });

  it('reports a failed save and writes it again on retry', async () => {
    api.saveAuto.mockRejectedValueOnce(new Error('offline'));
    const { result } = renderHook(() => useContentDrafts('japan', true));
    await waitFor(() => expect(result.current.restoring).toBe(false));

    act(() => { result.current.scheduleSave('japan', 'alert-1', payloadFor('x')); });
    await act(async () => { await result.current.retry(); });
    await waitFor(() => expect(result.current.status).toBe('error'));

    await act(async () => { await result.current.retry(); });
    await waitFor(() => expect(result.current.status).toBe('saved'));
    expect(api.saveAuto).toHaveBeenCalledTimes(2);
  });

  it('saves, lists, renames and removes named drafts for the market', async () => {
    api.list.mockResolvedValue([
      { id: 'd1', kind: 'named', name: 'One', market: 'japan', demandAlertId: null, captionPreview: '', updatedAt: '2026-10-22T00:00:00Z' },
    ]);
    api.create.mockResolvedValue({});
    api.update.mockResolvedValue({});
    api.remove.mockResolvedValue(undefined);
    const { result } = renderHook(() => useContentDrafts('japan', true));
    await waitFor(() => expect(result.current.named).toHaveLength(1));

    api.create.mockResolvedValue({ id: 'd2', name: 'Two', existing: false });
    let saved: unknown;
    await act(async () => { saved = await result.current.saveAs('Two', 'alert-1', payloadFor('c')); });
    expect(api.create).toHaveBeenCalledWith('japan', 'alert-1', 'Two', expect.objectContaining({ schemaVersion: 1 }));
    // The saved draft comes back, so the studio can link to it and update it next time.
    expect(saved).toMatchObject({ id: 'd2', name: 'Two' });
    await act(async () => { await result.current.rename('d1', 'Renamed'); });
    expect(api.update).toHaveBeenCalledWith('d1', { name: 'Renamed' });
    await act(async () => { await result.current.remove('d1'); });
    expect(api.remove).toHaveBeenCalledWith('d1');
    expect(api.list.mock.calls.length).toBeGreaterThanOrEqual(4);
  });

  it('passes on the existing draft when identical work was already saved', async () => {
    api.create.mockResolvedValue({ id: 'd1', name: 'Earlier', existing: true });
    const { result } = renderHook(() => useContentDrafts('japan', true));
    await waitFor(() => expect(result.current.restoring).toBe(false));

    let saved: { existing?: boolean } | null = null;
    await act(async () => { saved = await result.current.saveAs('Again', 'alert-1', payloadFor('c')); });

    expect(saved).toMatchObject({ id: 'd1', existing: true });
  });

  it('updates a saved draft in place, keeping its name, then refreshes the list', async () => {
    api.update.mockResolvedValue({ id: 'd1', name: 'Kept name' });
    const { result } = renderHook(() => useContentDrafts('japan', true));
    await waitFor(() => expect(result.current.restoring).toBe(false));
    const listed = api.list.mock.calls.length;

    await act(async () => { await result.current.update('d1', payloadFor('edited')); });

    expect(api.update).toHaveBeenCalledWith('d1', { payload: expect.objectContaining({ schemaVersion: 1 }) });
    expect(api.list.mock.calls.length).toBe(listed + 1);
  });

  it('lets an update of a draft that no longer exists reject, so the caller can save a new one', async () => {
    api.update.mockRejectedValue(new Error('404'));
    const { result } = renderHook(() => useContentDrafts('japan', true));
    await waitFor(() => expect(result.current.restoring).toBe(false));

    await expect(result.current.update('gone', payloadFor('x'))).rejects.toThrow('404');
  });

  it('opens a named draft to its payload, or null when it is unreadable', async () => {
    const { result } = renderHook(() => useContentDrafts('japan', true));
    api.get.mockResolvedValueOnce({ payload: payloadFor('named') });
    expect((await result.current.open('d1'))?.draft.caption).toBe('named');
    api.get.mockResolvedValueOnce({ payload: { nope: true } });
    expect(await result.current.open('d2')).toBeNull();
  });
});
