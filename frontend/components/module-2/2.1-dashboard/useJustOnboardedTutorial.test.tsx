import { render, screen, act } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useJustOnboardedTutorial } from './useJustOnboardedTutorial';
import { markJustOnboarded } from '../../../services/justOnboardedFlag';

function Harness() {
  const { open, close } = useJustOnboardedTutorial();
  return (
    <div>
      <span data-testid="open">{String(open)}</span>
      <button onClick={close}>close</button>
    </div>
  );
}

describe('useJustOnboardedTutorial', () => {
  it('opens when the justOnboarded flag was marked before mount', () => {
    markJustOnboarded();
    render(<Harness />);

    expect(screen.getByTestId('open').textContent).toBe('true');
  });

  it('stays closed when the flag was never marked', () => {
    render(<Harness />);
    expect(screen.getByTestId('open').textContent).toBe('false');
  });

  it('consumes the flag so a second mount does not reopen it', () => {
    markJustOnboarded();
    const { unmount } = render(<Harness />);
    expect(screen.getByTestId('open').textContent).toBe('true');
    unmount();

    render(<Harness />);
    expect(screen.getByTestId('open').textContent).toBe('false');
  });

  it('close() flips open back to false', () => {
    markJustOnboarded();
    render(<Harness />);
    expect(screen.getByTestId('open').textContent).toBe('true');

    act(() => {
      screen.getByText('close').click();
    });
    expect(screen.getByTestId('open').textContent).toBe('false');
  });
});
