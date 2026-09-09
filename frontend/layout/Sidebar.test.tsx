/**
 * Sidebar behaviour, pinned so the chrome restyle is provably cosmetic.
 *
 * The port moved the active-route highlight from a conditional className to
 * `aria-current="page"`. These assert the behaviour that has to survive that,
 * and they would have caught it if the restyle had quietly broken navigation,
 * the Settings disclosure, or sign-out.
 */
import { useEffect } from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import Sidebar from './Sidebar';
import { AuthProvider } from '../services/auth';
import { UnreadAlertsProvider, useUnreadAlerts } from '../services/unreadAlertsStore';
import { saveTokens } from '../services/authStorage';

/**
 * Publishes an unread count into the shared store the way the dashboard does,
 * so the rail is exercised through its real source rather than a prop.
 */
function PublishUnread({ count }: { count: number | null }) {
  const { setUnreadCount } = useUnreadAlerts();
  useEffect(() => setUnreadCount(count), [count, setUnreadCount]);
  return null;
}

function renderAt(path: string, unread: number | null = null) {
  saveTokens({ accessToken: 'jwt-1', profileCompleted: true });
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <UnreadAlertsProvider>
          <PublishUnread count={unread} />
          <Sidebar />
        </UnreadAlertsProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('Sidebar', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('marks the current route with aria-current and leaves the others unmarked', () => {
    renderAt('/dashboard');

    expect(screen.getByRole('button', { name: /Dashboard/ })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: /Content Studio/ })).not.toHaveAttribute('aria-current');
  });

  it('follows the route rather than a fixed default', () => {
    renderAt('/calendar');

    expect(screen.getByRole('button', { name: /Calendar/ })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: /Dashboard/ })).not.toHaveAttribute('aria-current');
  });

  // The Settings screens were once an indented sub-list behind a disclosure.
  // They are peer rows now, so they are reachable with no preliminary click and
  // there is no "Settings" parent row naming the section a second time.
  it('lists every Settings destination as a peer nav item', () => {
    renderAt('/dashboard');

    expect(screen.getByRole('button', { name: 'Business Profile' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Platforms' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Workspace' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Settings' })).not.toBeInTheDocument();
  });

  it('marks the current Settings destination and only that one', () => {
    renderAt('/settings/workspace');

    expect(screen.getByRole('button', { name: 'Workspace' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Platforms' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('button', { name: 'Business Profile' })).not.toHaveAttribute('aria-current');
  });

  it('routes a Settings item to its own nested path', async () => {
    const user = userEvent.setup();
    renderAt('/dashboard');

    await user.click(screen.getByRole('button', { name: 'Platforms' }));

    expect(screen.getByRole('button', { name: 'Platforms' })).toHaveAttribute('aria-current', 'page');
  });

  // The rail used to carry a literal `badge: 2` in nav.ts, so every operator
  // was told they had two unread alerts — including on a dashboard whose feed
  // said "No notifications yet". The count now has one source: the dashboard's.
  it('renders the unread badge from the live count', () => {
    renderAt('/dashboard', 3);

    const dashboard = screen.getByRole('button', { name: /Dashboard/ });
    expect(within(dashboard).getByText(/^3/)).toBeInTheDocument();
  });

  it('shows no badge while the count is unknown or zero', () => {
    const { unmount } = renderAt('/dashboard');
    expect(
      within(screen.getByRole('button', { name: /Dashboard/ })).queryByText(/\d/),
    ).toBeNull();
    unmount();

    renderAt('/dashboard', 0);
    expect(
      within(screen.getByRole('button', { name: /Dashboard/ })).queryByText(/\d/),
    ).toBeNull();
  });

  it('clears the session on sign out', async () => {
    const user = userEvent.setup();
    renderAt('/dashboard');

    await user.click(screen.getByRole('button', { name: 'Sign out' }));

    expect(localStorage.getItem('ceview.auth')).toBeNull();
  });
});
