/**
 * CARD — Foundation: Dashboard & Radar Shell (drawer half)
 * DoD: URL-driven open/close, and the timeframe/tab reset on market change.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useSearchParams } from 'react-router-dom';
import MarketRadarDrawer from './MarketRadarDrawer';
import { OverlayStackProvider } from '../../shared/useOverlayStack';
import { MOCK_MARKETS } from '../../../services/fixtures/markets';

function renderAt(search: string, onTargetMarket = vi.fn()) {
  const view = render(
    <MemoryRouter initialEntries={[`/dashboard${search}`]}>
      <OverlayStackProvider>
        <MarketRadarDrawer markets={MOCK_MARKETS} onTargetMarket={onTargetMarket} />
      </OverlayStackProvider>
    </MemoryRouter>,
  );
  return { ...view, onTargetMarket };
}

const drawer = () => document.querySelector('.drawer')!;

/**
 * Switches the ?market= param without remounting the drawer. rerender() with a
 * fresh MemoryRouter does NOT work here: initialEntries only applies on first
 * mount, so the URL would never actually change and the reset-on-change effect
 * would not fire — which is the behaviour under test.
 */
function MarketSwitcher() {
  const [, setSearchParams] = useSearchParams();
  return (
    <button type="button" onClick={() => setSearchParams({ market: 'japan' })}>
      go-japan
    </button>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('MarketRadarDrawer — URL as the source of truth', () => {
  it('stays closed with no market in the URL', () => {
    renderAt('');
    expect(drawer()).toHaveAttribute('data-open', 'false');
  });

  it('opens for the market named in the URL', () => {
    renderAt('?market=korea');

    expect(drawer()).toHaveAttribute('data-open', 'true');
    expect(screen.getByRole('heading', { name: 'South Korea' })).toBeInTheDocument();
  });

  // An id that matches nothing is treated as closed rather than rendering a
  // drawer with no content in it.
  it('stays closed for an unknown market id', () => {
    renderAt('?market=atlantis');
    expect(drawer()).toHaveAttribute('data-open', 'false');
  });

  // dismissTop() (Escape, and the shell's scrim) pops the overlay stack. Since
  // this drawer's open state lives in the URL rather than the stack, the two
  // have to be kept in step or Escape silently does nothing.
  it('closes on Escape', async () => {
    const user = userEvent.setup();
    renderAt('?market=korea');
    expect(drawer()).toHaveAttribute('data-open', 'true');

    await user.keyboard('{Escape}');

    expect(drawer()).toHaveAttribute('data-open', 'false');
  });

  it('closes when the close control is used', async () => {
    const user = userEvent.setup();
    renderAt('?market=korea');

    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(drawer()).toHaveAttribute('data-open', 'false');
  });

  // Regression: closing with the X left Drawer's "I was in the overlay stack"
  // flag set, because only the dismiss path (Escape/scrim) cleared it. On the
  // next open, the render before the push lands still sees inStack=false, read
  // that stale flag as "someone just dismissed me" and called onClose() — the
  // drawer shut itself on the frame it opened. Escape masked the bug by
  // clearing the flag on its way through.
  it('reopens after being closed by its own Close control', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/dashboard?market=korea']}>
        <OverlayStackProvider>
          <MarketSwitcher />
          <MarketRadarDrawer markets={MOCK_MARKETS} />
        </OverlayStackProvider>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(drawer()).toHaveAttribute('data-open', 'false');

    await user.click(screen.getByRole('button', { name: 'go-japan' }));

    expect(drawer()).toHaveAttribute('data-open', 'true');
    expect(screen.getByRole('heading', { name: 'Japan' })).toBeInTheDocument();
  });
});

describe('MarketRadarDrawer — state resets per market', () => {
  // Opening a second market must not inherit the first one's reading position.
  it('resets timeframe and tab when the market changes', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/dashboard?market=korea']}>
        <OverlayStackProvider>
          <MarketSwitcher />
          <MarketRadarDrawer markets={MOCK_MARKETS} />
        </OverlayStackProvider>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: '12WK' }));
    await user.click(screen.getByRole('tab', { name: 'Seasonal Patterns' }));
    expect(screen.getByRole('button', { name: '12WK' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('tab', { name: 'Seasonal Patterns' })).toHaveAttribute('aria-selected', 'true');

    await user.click(screen.getByRole('button', { name: 'go-japan' }));

    expect(screen.getByRole('heading', { name: 'Japan' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '4WK' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('tab', { name: 'Purchasing Power' })).toHaveAttribute('aria-selected', 'true');
  });

  // The two body slots are siblings; neither may reset the other. This is the
  // stated milestone for the insights-tabs card.
  it('keeps the chart timeframe when the insights tab changes', async () => {
    const user = userEvent.setup();
    renderAt('?market=korea');

    await user.click(screen.getByRole('button', { name: '12WK' }));
    await user.click(screen.getByRole('tab', { name: 'Seasonal Patterns' }));

    expect(screen.getByRole('button', { name: '12WK' })).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('MarketRadarDrawer — market switcher', () => {
  // The drawer covers the ranked list it was opened from, so those cards cannot
  // be clicked while it is open. Without this, comparing two markets meant
  // closing, re-reading the list and reopening.
  it('switches market without closing', async () => {
    const user = userEvent.setup();
    renderAt('?market=korea');

    await user.click(screen.getByRole('button', { name: 'Japan' }));

    expect(screen.getByRole('heading', { name: 'Japan' })).toBeInTheDocument();
    expect(drawer()).toHaveAttribute('data-open', 'true');
  });

  it('marks the market being shown', () => {
    renderAt('?market=japan');

    expect(screen.getByRole('button', { name: 'Japan' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'South Korea' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('resets the timeframe when switching, like any market change', async () => {
    const user = userEvent.setup();
    renderAt('?market=korea');

    await user.click(screen.getByRole('button', { name: '12WK' }));
    await user.click(screen.getByRole('button', { name: 'Japan' }));

    expect(screen.getByRole('button', { name: '4WK' })).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('MarketRadarDrawer — reachable while open', () => {
  // The regression this guards: the drawer opens over the right of the screen,
  // which is exactly where the dashboard's markets column lives. It covered
  // those rank cards 100% at every desktop width, so the obvious way to switch
  // market silently did nothing. Both the layout (.dash-screen makes room) and
  // the scrim (suppressed for a bare drawer) had to change; here we pin the
  // behaviour that depends on it — reopening for another market mid-flight.
  it('accepts a new market while already open', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/dashboard?market=korea']}>
        <OverlayStackProvider>
          <MarketSwitcher />
          <MarketRadarDrawer markets={MOCK_MARKETS} />
        </OverlayStackProvider>
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: 'South Korea' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'go-japan' }));

    expect(screen.getByRole('heading', { name: 'Japan' })).toBeInTheDocument();
    expect(drawer()).toHaveAttribute('data-open', 'true');
  });
});

describe('MarketRadarDrawer — header', () => {
  it('reports the market rank, route and distance', () => {
    const korea = MOCK_MARKETS.find((m) => m.id === 'korea')!;
    renderAt('?market=korea');

    const head = document.querySelector('.radar-head') as HTMLElement;
    expect(within(head).getByText(String(korea.rank))).toBeInTheDocument();
    expect(head).toHaveTextContent(korea.city);
    expect(head).toHaveTextContent(korea.nearestAirport);
  });

  it('hands the market up on "Target this market" and closes', async () => {
    const user = userEvent.setup();
    const { onTargetMarket } = renderAt('?market=korea');

    await user.click(screen.getByRole('button', { name: /Target this market/ }));

    expect(onTargetMarket).toHaveBeenCalledWith('korea');
    expect(drawer()).toHaveAttribute('data-open', 'false');
  });
});
