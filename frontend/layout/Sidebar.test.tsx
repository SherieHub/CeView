/**
 * Sidebar behaviour, pinned so the chrome restyle is provably cosmetic.
 *
 * The port moved the active-route highlight from a conditional className to
 * `aria-current="page"`. These assert the behaviour that has to survive that,
 * and they would have caught it if the restyle had quietly broken navigation,
 * the Settings disclosure, or sign-out.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import Sidebar from './Sidebar';
import { AuthProvider } from '../services/auth';
import { saveTokens } from '../services/authStorage';

function renderAt(path: string) {
  saveTokens({ accessToken: 'jwt-1', profileCompleted: true });
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <Sidebar />
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

  it('renders the unread badge from the nav table', () => {
    renderAt('/dashboard');

    const dashboard = screen.getByRole('button', { name: /Dashboard/ });
    expect(within(dashboard).getByText('2')).toBeInTheDocument();
  });

  it('clears the session on sign out', async () => {
    const user = userEvent.setup();
    renderAt('/dashboard');

    await user.click(screen.getByRole('button', { name: 'Sign out' }));

    expect(localStorage.getItem('ceview.auth')).toBeNull();
  });
});
