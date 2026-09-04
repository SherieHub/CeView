import { render, screen, act } from '@testing-library/react';
import { describe, expect, it, beforeEach } from 'vitest';
import { useFirstRunDrawer, BRIEF_SEEN_KEY } from './useFirstRunDrawer';

function Probe() {
  const { open, showWelcome, showTooltip, openDrawer, closeDrawer } = useFirstRunDrawer();
  return (
    <div>
      <span data-testid="open">{String(open)}</span>
      <span data-testid="welcome">{String(showWelcome)}</span>
      <span data-testid="tooltip">{String(showTooltip)}</span>
      <button onClick={openDrawer}>open</button>
      <button onClick={closeDrawer}>close</button>
    </div>
  );
}

describe('useFirstRunDrawer', () => {
  beforeEach(() => localStorage.clear());

  it('auto-opens with a welcome on the first visit', () => {
    render(<Probe />);
    expect(screen.getByTestId('open')).toHaveTextContent('true');
    expect(screen.getByTestId('welcome')).toHaveTextContent('true');
    expect(screen.getByTestId('tooltip')).toHaveTextContent('false');
  });

  it('records the dismissal and stays closed afterwards', () => {
    const { unmount } = render(<Probe />);
    act(() => { screen.getByText('close').click(); });
    expect(screen.getByTestId('open')).toHaveTextContent('false');
    expect(localStorage.getItem(BRIEF_SEEN_KEY)).toBe('true');
    unmount();

    render(<Probe />);
    expect(screen.getByTestId('open')).toHaveTextContent('false');
    expect(screen.getByTestId('welcome')).toHaveTextContent('false');
    expect(screen.getByTestId('tooltip')).toHaveTextContent('false');
  });

  // The tooltip exists for exactly one situation: auto-open was skipped, so
  // the drawer never introduced itself. That happens when storage is blocked
  // (private mode, blocked site data) — we refuse to auto-open something whose
  // dismissal we would be unable to remember, because it would then ambush the
  // operator on every single load.
  it('falls back to the tooltip when storage is blocked and auto-open is skipped', () => {
    const orig = Storage.prototype.getItem;
    Storage.prototype.getItem = () => { throw new Error('blocked'); };
    try {
      expect(() => render(<Probe />)).not.toThrow();
      expect(screen.getByTestId('open')).toHaveTextContent('false');
      expect(screen.getByTestId('welcome')).toHaveTextContent('false');
      expect(screen.getByTestId('tooltip')).toHaveTextContent('true');
    } finally {
      Storage.prototype.getItem = orig;
    }
  });

  it('drops the tooltip once the drawer has been opened and dismissed', () => {
    render(<Probe />);
    expect(screen.getByTestId('tooltip')).toHaveTextContent('false');
    act(() => { screen.getByText('close').click(); });
    expect(screen.getByTestId('tooltip')).toHaveTextContent('false');
  });
});
