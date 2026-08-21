import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import CompleteProfilePage from './CompleteProfilePage';
import { AuthProvider } from '../../services/auth';

vi.stubEnv('VITE_USE_FIXTURES', 'false');

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status }));
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/complete-profile']}>
      <AuthProvider>
        <Routes>
          <Route path="/complete-profile" element={<CompleteProfilePage />} />
          <Route path="/dashboard" element={<div>Dashboard</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('CompleteProfilePage', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('submits the contact number and navigates on to /dashboard on success', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockReturnValue(jsonResponse({ profileCompleted: true }));
    renderPage();

    fireEvent.change(screen.getByLabelText(/contact number/i), { target: { value: '09171234567' } });
    fireEvent.click(screen.getByRole('button', { name: /continue|save/i }));

    await waitFor(() => expect(screen.getByText('Dashboard')).toBeInTheDocument());
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/auth/profile'),
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ contactNumber: '09171234567' }) }),
    );
  });

  it('shows an error message when the request fails', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockReturnValue(jsonResponse({ error: 'server exploded' }, 500));
    renderPage();

    fireEvent.change(screen.getByLabelText(/contact number/i), { target: { value: '09171234567' } });
    fireEvent.click(screen.getByRole('button', { name: /continue|save/i }));

    await waitFor(() => expect(screen.getByText(/something went wrong/i)).toBeInTheDocument());
  });
});
