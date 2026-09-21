import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useLinkPerformance } from './useLinkPerformance';
import { mockLinkPerformance, MOCK_LINKS } from './fixtures/attributionLinks';
import type { LinkPerformance } from '../types';

const performance = vi.hoisted(() => vi.fn());
vi.mock('./apiClient', () => ({ apiClient: { attributionLinks: { performance } } }));
beforeEach(() => performance.mockReset());
const data = mockLinkPerformance(MOCK_LINKS[0].linkId);

describe('useLinkPerformance', () => {
  it('does not request a null selection', () => {
    const { result } = renderHook(() => useLinkPerformance(null));
    expect(performance).not.toHaveBeenCalled();
    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(false);
  });
  it('loads, reports failures and retries', async () => {
    performance.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(data);
    const { result } = renderHook(() => useLinkPerformance('A'));
    await waitFor(() => expect(result.current.error).toBeInstanceOf(Error));
    expect(result.current.data).toBeNull();
    act(() => result.current.refresh());
    await waitFor(() => expect(result.current.data).toEqual(data));
    expect(result.current.error).toBeNull();
  });
  it('ignores old responses and clears data synchronously when selection changes', async () => {
    let resolveA!: (value: LinkPerformance) => void;
    performance.mockImplementationOnce(() => new Promise(resolve => { resolveA = resolve; }))
      .mockResolvedValueOnce({ ...data, linkId: 'B' });
    const { result, rerender } = renderHook(({ id }) => useLinkPerformance(id), { initialProps: { id: 'A' } });
    rerender({ id: 'B' });
    expect(result.current.data).toBeNull();
    await waitFor(() => expect(result.current.data?.linkId).toBe('B'));
    await act(async () => resolveA(data));
    expect(result.current.data?.linkId).toBe('B');
  });
  it('ignores completion after unmount', async () => {
    let resolve!: (value: LinkPerformance) => void;
    performance.mockImplementation(() => new Promise(r => { resolve = r; }));
    const { result, unmount } = renderHook(() => useLinkPerformance('A'));
    unmount();
    await act(async () => resolve(data));
    expect(result.current.data).toBeNull();
  });
});
