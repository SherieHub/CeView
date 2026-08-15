import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOverlayStack } from './useOverlayStack';

// Ports the semantics of ui-ux-prototype.html:1565-1613 (overlayStack array,
// syncScrim/dismissTop/openModal/closeModal/openDrawer/closeDrawer) into a
// React hook. Scrim visibility is derived from stack non-emptiness; Escape /
// dismissTop always closes only the top-most overlay.
describe('useOverlayStack', () => {
  it('starts with an empty stack and scrim off', () => {
    const { result } = renderHook(() => useOverlayStack());
    expect(result.current.stack).toEqual([]);
    expect(result.current.isScrimVisible).toBe(false);
  });

  it('push adds an overlay to the top of the stack and turns the scrim on', () => {
    const { result } = renderHook(() => useOverlayStack());
    act(() => result.current.push('drawer'));
    expect(result.current.stack).toEqual(['drawer']);
    expect(result.current.isScrimVisible).toBe(true);
  });

  it('push does not duplicate an overlay kind already in the stack', () => {
    const { result } = renderHook(() => useOverlayStack());
    act(() => {
      result.current.push('modal');
      result.current.push('modal');
    });
    expect(result.current.stack).toEqual(['modal']);
  });

  it('pushing drawer then modal keeps push order (modal on top)', () => {
    const { result } = renderHook(() => useOverlayStack());
    act(() => {
      result.current.push('drawer');
      result.current.push('modal');
    });
    expect(result.current.stack).toEqual(['drawer', 'modal']);
  });

  it('pop removes a specific overlay kind regardless of position', () => {
    const { result } = renderHook(() => useOverlayStack());
    act(() => {
      result.current.push('drawer');
      result.current.push('modal');
      result.current.pop('drawer');
    });
    expect(result.current.stack).toEqual(['modal']);
  });

  it('scrim turns off once the stack empties', () => {
    const { result } = renderHook(() => useOverlayStack());
    act(() => {
      result.current.push('modal');
      result.current.pop('modal');
    });
    expect(result.current.stack).toEqual([]);
    expect(result.current.isScrimVisible).toBe(false);
  });

  it('dismissTop closes only the top-most overlay (drawer then modal over it -> Escape closes modal only)', () => {
    const { result } = renderHook(() => useOverlayStack());
    act(() => {
      result.current.push('drawer');
      result.current.push('modal');
    });
    act(() => result.current.dismissTop());
    expect(result.current.stack).toEqual(['drawer']);
    expect(result.current.isScrimVisible).toBe(true);

    act(() => result.current.dismissTop());
    expect(result.current.stack).toEqual([]);
    expect(result.current.isScrimVisible).toBe(false);
  });

  it('dismissTop on an empty stack is a no-op', () => {
    const { result } = renderHook(() => useOverlayStack());
    act(() => result.current.dismissTop());
    expect(result.current.stack).toEqual([]);
  });

  it('isOpen reflects whether a given overlay kind is anywhere in the stack', () => {
    const { result } = renderHook(() => useOverlayStack());
    act(() => result.current.push('toast'));
    expect(result.current.isOpen('toast')).toBe(true);
    expect(result.current.isOpen('modal')).toBe(false);
  });
});
