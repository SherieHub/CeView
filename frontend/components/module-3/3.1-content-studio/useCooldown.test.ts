import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCooldown } from './useCooldown';

const KEY = 'ceview.cooldown.test';

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-23T10:00:00Z'));
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('useCooldown', () => {
  it('has no wait until one is started', () => {
    const { result } = renderHook(() => useCooldown(KEY));
    expect(result.current.secondsLeft).toBe(0);
  });

  it('counts down from the wait it was given, then ends', () => {
    const { result } = renderHook(() => useCooldown(KEY));

    act(() => { result.current.start(60_000); });
    expect(result.current.secondsLeft).toBe(60);

    act(() => { vi.advanceTimersByTime(10_000); });
    expect(result.current.secondsLeft).toBe(50);

    act(() => { vi.advanceTimersByTime(50_000); });
    expect(result.current.secondsLeft).toBe(0);
  });

  it('keeps the wait across leaving and coming back', () => {
    const first = renderHook(() => useCooldown(KEY));
    act(() => { first.result.current.start(60_000); });
    first.unmount();

    act(() => { vi.advanceTimersByTime(15_000); });
    const second = renderHook(() => useCooldown(KEY));

    expect(second.result.current.secondsLeft).toBe(45);
  });

  it('starts a new wait in place of the one running', () => {
    const { result } = renderHook(() => useCooldown(KEY));
    act(() => { result.current.start(60_000); });
    act(() => { vi.advanceTimersByTime(20_000); });

    act(() => { result.current.start(30_000); });

    expect(result.current.secondsLeft).toBe(30);
  });

  it('keeps each wait under its own key', () => {
    const a = renderHook(() => useCooldown('ceview.cooldown.a'));
    act(() => { a.result.current.start(60_000); });

    expect(renderHook(() => useCooldown('ceview.cooldown.b')).result.current.secondsLeft).toBe(0);
  });

  it('ignores a stored wait that has already passed, or is not a time at all', () => {
    localStorage.setItem(KEY, String(Date.now() - 5_000));
    expect(renderHook(() => useCooldown(KEY)).result.current.secondsLeft).toBe(0);

    localStorage.setItem(KEY, 'not a number');
    expect(renderHook(() => useCooldown(KEY)).result.current.secondsLeft).toBe(0);
  });

  it('still waits, for as long as the page lives, when storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    const { result } = renderHook(() => useCooldown(KEY));

    act(() => { result.current.start(60_000); });

    expect(result.current.secondsLeft).toBe(60);
  });
});
