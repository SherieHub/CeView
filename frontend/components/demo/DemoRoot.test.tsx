/**
 * The public demo, mounted the way App.tsx mounts it: the real shell and
 * screens on sample data. Checks what a visitor sees first, the locked
 * account-only destinations, Reset, and — the point of the whole design —
 * that nothing calls the network.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../../services/auth';
import { OverlayStackProvider } from '../shared/useOverlayStack';
import { ToastProvider } from '../shared/Toast';
import { isDemoActive } from '../../services/demoMode';
import DemoRoot, { DemoBusinessProfile, DemoDashboard } from './DemoRoot';

const fetchSpy = vi.fn(() => Promise.reject(new Error('network must not be used in the demo')));

beforeEach(() => {
  fetchSpy.mockClear();
  vi.stubGlobal('fetch', fetchSpy);
  sessionStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderDemo(path = '/demo') {
  return render(
    <AuthProvider>
      <OverlayStackProvider>
        <ToastProvider>
          <MemoryRouter initialEntries={[path]}>
            <Routes>
              <Route path="/" element={<p>Landing page</p>} />
              <Route path="/demo" element={<DemoRoot />}>
                <Route index element={<DemoDashboard />} />
                <Route path="settings/profile" element={<DemoBusinessProfile />} />
              </Route>
            </Routes>
          </MemoryRouter>
        </ToastProvider>
      </OverlayStackProvider>
    </AuthProvider>,
  );
}

// The screens are lazily loaded; the first test pays their cold import.
describe('DemoRoot', { timeout: 20000 }, () => {
  it('says it is a demo on sample data, and welcomes the visitor without blocking the page', async () => {
    renderDemo();
    const bar = screen.getByRole('region', { name: 'Interactive demo' });
    expect(within(bar).getByText(/Sample data/)).toBeInTheDocument();
    expect(within(bar).getByText(/Nothing here is saved or posted/)).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Welcome to the CeView demo' })).toHaveAttribute('aria-modal', 'false');

    fireEvent.click(screen.getByRole('button', { name: 'Explore on my own' }));
    expect(screen.queryByRole('dialog', { name: 'Welcome to the CeView demo' })).not.toBeInTheDocument();
    expect(await screen.findByText(/Sunset Cove Beach Resort/, { selector: 'h1' }, { timeout: 8000 })).toBeInTheDocument();
  });

  it('locks the destinations that need a real account, and replaces Sign out with Exit demo', () => {
    renderDemo();
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('button', { name: /Platforms/ })).toBeDisabled();
    expect(within(nav).getByRole('button', { name: /Workspace/ })).toBeDisabled();
    expect(within(nav).getByRole('button', { name: /Content Studio/ })).toBeEnabled();
    expect(within(nav).getByRole('button', { name: 'Exit demo' })).toBeInTheDocument();
    expect(within(nav).queryByRole('button', { name: 'Sign out' })).not.toBeInTheDocument();
  });

  it('starts the guided tour from the welcome card', () => {
    renderDemo();
    fireEvent.click(screen.getByRole('button', { name: /Take the 2-minute tour/ }));
    expect(screen.getByRole('dialog', { name: 'Meet Sunset Cove Beach Resort' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Next/ }));
    expect(screen.getByRole('dialog', { name: 'A surge alert' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Skip tour' }));
    expect(screen.queryByRole('dialog', { name: 'A surge alert' })).not.toBeInTheDocument();
  });

  it('Reset puts back the sample business and confirms it', async () => {
    renderDemo('/demo/settings/profile');
    fireEvent.click(screen.getByRole('button', { name: 'Explore on my own' }));
    const name = await screen.findByLabelText(/business name/i, {}, { timeout: 8000 });
    fireEvent.change(name, { target: { value: 'Changed Name' } });
    expect(screen.getByLabelText(/business name/i)).toHaveValue('Changed Name');

    fireEvent.click(screen.getByRole('button', { name: 'Reset demo' }));
    expect(await screen.findByText(/Demo reset/)).toBeInTheDocument();
  });

  it('never calls the network, and switches demo mode off on the way out', async () => {
    const { unmount } = renderDemo();
    expect(isDemoActive()).toBe(true);
    await screen.findByText(/Sunset Cove Beach Resort/, { selector: 'h1' }, { timeout: 8000 });
    await waitFor(() => expect(document.querySelector('.alert-card')).not.toBeNull(), { timeout: 3000 });
    expect(fetchSpy).not.toHaveBeenCalled();
    unmount();
    expect(isDemoActive()).toBe(false);
  });
});
