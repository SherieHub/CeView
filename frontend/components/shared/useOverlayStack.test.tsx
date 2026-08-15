import { describe, expect, it } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { OverlayStackProvider, useOverlayStack } from './useOverlayStack';
import type { ReactNode } from 'react';

const wrapper = ({ children }: { children: ReactNode }) => <OverlayStackProvider>{children}</OverlayStackProvider>;

describe('useOverlayStack', () => {
  it('starts empty with the scrim hidden', () => {
    const { result } = renderHook(() => useOverlayStack(), { wrapper });
    expect(result.current.stack).toEqual([]);
    expect(result.current.scrimVisible).toBe(false);
  });

  it('push adds an overlay and shows the scrim', () => {
    const { result } = renderHook(() => useOverlayStack(), { wrapper });
    act(() => result.current.push('drawer'));
    expect(result.current.stack).toEqual(['drawer']);
    expect(result.current.scrimVisible).toBe(true);
  });

  it('push is idempotent for an already-open overlay', () => {
    const { result } = renderHook(() => useOverlayStack(), { wrapper });
    act(() => result.current.push('drawer'));
    act(() => result.current.push('drawer'));
    expect(result.current.stack).toEqual(['drawer']);
  });

  it('dismissTop closes only the top-most overlay: modal over drawer, then drawer', () => {
    const { result } = renderHook(() => useOverlayStack(), { wrapper });
    act(() => result.current.push('drawer'));
    act(() => result.current.push('modal'));
    expect(result.current.stack).toEqual(['drawer', 'modal']);

    act(() => result.current.dismissTop());
    expect(result.current.stack).toEqual(['drawer']);
    expect(result.current.scrimVisible).toBe(true);

    act(() => result.current.dismissTop());
    expect(result.current.stack).toEqual([]);
    expect(result.current.scrimVisible).toBe(false);
  });

  it('pop removes a specific overlay regardless of stack position', () => {
    const { result } = renderHook(() => useOverlayStack(), { wrapper });
    act(() => result.current.push('sidebar'));
    act(() => result.current.push('modal'));
    act(() => result.current.pop('sidebar'));
    expect(result.current.stack).toEqual(['modal']);
  });
});
