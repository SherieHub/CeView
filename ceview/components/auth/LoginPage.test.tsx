import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LoginPage from './LoginPage';
import { AuthProvider } from '../../services/auth';

// Component test — renders LoginPage inside a real AuthProvider and drives it
// through the fetch boundary, mirroring apiClient.test.ts's mocking pattern.
// Verifies the form calls the login endpoint and surfaces backend errors
// inline rather than only logging them.
describe('LoginPage', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('submits email/password to the login endpoint on success', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ operatorId: 'op-1', token: 'tok-1' }),
      headers: { get: () => null },
    });

    render(
      <AuthProvider>
        <LoginPage onSwitchToRegister={() => {}} />
      </AuthProvider>,
    );

    fireEvent.change(screen.getByPlaceholderText('you@example.com'), { target: { value: 'a@b.com' } });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/auth/login'),
        expect.objectContaining({ method: 'POST' }),
      );
    });

    await waitFor(() => {
      expect(localStorage.getItem('ceview_token')).toBe('tok-1');
      expect(localStorage.getItem('ceview_operator_id')).toBe('op-1');
    });
  });

  it('shows an inline error message on invalid credentials instead of only logging it', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      text: async () => JSON.stringify({ error: 'invalid credentials' }),
      headers: { get: () => null },
    });

    render(
      <AuthProvider>
        <LoginPage onSwitchToRegister={() => {}} />
      </AuthProvider>,
    );

    fireEvent.change(screen.getByPlaceholderText('you@example.com'), { target: { value: 'a@b.com' } });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'wrongpass' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText(/invalid credentials/i)).toBeInTheDocument();
  });
});
