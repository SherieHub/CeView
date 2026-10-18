import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import ContactNumberSection from './ContactNumberSection';
import { ToastProvider } from '../shared/Toast';

const mockGetProfile = vi.fn();
const mockCompleteProfile = vi.fn();
let configured = true;
let emitted: ((p: unknown) => void) | undefined;

vi.mock('../../services/apiClient', () => ({
  apiClient: {
    auth: {
      getProfile: (...a: unknown[]) => mockGetProfile(...a),
      completeProfile: (...a: unknown[]) => mockCompleteProfile(...a),
    },
  },
}));
vi.mock('../../services/firebase', () => ({ isFirebaseConfigured: () => configured }));
// The OTP flow itself is covered in PhoneVerifyField.test.tsx; here we just drive its callback.
vi.mock('../auth/PhoneVerifyField', () => ({
  default: (props: { onChange: (p: unknown) => void; initialNumber?: string; allowLater?: boolean }) => {
    emitted = props.onChange;
    return <div data-testid="field" data-initial={props.initialNumber} data-later={String(props.allowLater)} />;
  },
}));

function renderSection() {
  return render(
    <ToastProvider>
      <ContactNumberSection />
    </ToastProvider>,
  );
}

describe('ContactNumberSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    configured = true;
  });

  it('shows a Verified badge and no action for a verified number', async () => {
    mockGetProfile.mockResolvedValue({ contactNumber: '+639171234567', phoneVerified: true });
    renderSection();

    expect(await screen.findByText('Verified')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /verify number/i })).not.toBeInTheDocument();
  });

  it('verifies an unverified number and saves it with the Firebase token', async () => {
    mockGetProfile.mockResolvedValue({ contactNumber: '+639171234567', phoneVerified: false });
    mockCompleteProfile.mockResolvedValue({ profileCompleted: true });
    renderSection();

    expect(await screen.findByText('Not verified')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /verify number/i }));
    expect(screen.getByTestId('field')).toHaveAttribute('data-initial', '+639171234567');
    expect(screen.getByTestId('field')).toHaveAttribute('data-later', 'false');

    await act(async () => {
      emitted?.({ contactNumber: '+639171234567', phoneIdToken: 'tok' });
    });

    await waitFor(() => expect(screen.getByText('Verified')).toBeInTheDocument());
    expect(mockCompleteProfile).toHaveBeenCalledWith('+639171234567', { phoneIdToken: 'tok' });
  });

  it('says SMS is unavailable instead of offering Verify when Firebase is not configured', async () => {
    configured = false;
    mockGetProfile.mockResolvedValue({ contactNumber: '0917', phoneVerified: false });
    renderSection();

    expect(await screen.findByText(/isn.t available right now/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /verify number/i })).not.toBeInTheDocument();
  });

  it('renders nothing when the profile cannot be loaded', async () => {
    mockGetProfile.mockRejectedValue(new Error('boom'));
    renderSection();

    await waitFor(() => expect(mockGetProfile).toHaveBeenCalled());
    expect(screen.queryByText('Contact number')).not.toBeInTheDocument();
  });
});
