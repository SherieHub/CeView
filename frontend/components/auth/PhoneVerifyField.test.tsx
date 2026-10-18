import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PhoneVerifyField, { MAX_SENDS } from './PhoneVerifyField';

const mockSend = vi.fn();
const mockConfirm = vi.fn();
let configured = true;

vi.mock('../../services/firebase', () => ({
  isFirebaseConfigured: () => configured,
  sendPhoneCode: (...args: unknown[]) => mockSend(...args),
  confirmPhoneCode: (...args: unknown[]) => mockConfirm(...args),
  toE164PH: (s: string) => (s.startsWith('0') ? `+63${s.slice(1)}` : s),
}));

describe('PhoneVerifyField', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    configured = true;
  });

  it('sends a code, verifies it, and reports the verified phone with its ID token', async () => {
    mockSend.mockResolvedValue({ confirm: vi.fn() });
    mockConfirm.mockResolvedValue('id-token');
    const onChange = vi.fn();
    render(<PhoneVerifyField id="p" variant="card" onChange={onChange} />);

    fireEvent.change(screen.getByLabelText(/contact number/i), { target: { value: '09171234567' } });
    fireEvent.click(screen.getByRole('button', { name: /send code/i }));
    await waitFor(() => expect(screen.getByLabelText(/6-digit code/i)).toBeInTheDocument());
    expect(mockSend).toHaveBeenCalledWith('+639171234567', 'p-recaptcha');

    fireEvent.change(screen.getByLabelText(/6-digit code/i), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: /^verify$/i }));

    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith({ contactNumber: '+639171234567', phoneIdToken: 'id-token' }),
    );
    expect(screen.getByRole('status')).toHaveTextContent(/verified/i);
  });

  it('shows a friendly error when the code is wrong and does not report a phone', async () => {
    mockSend.mockResolvedValue({ confirm: vi.fn() });
    mockConfirm.mockRejectedValue({ code: 'auth/invalid-verification-code' });
    const onChange = vi.fn();
    render(<PhoneVerifyField id="p" variant="card" onChange={onChange} />);

    fireEvent.change(screen.getByLabelText(/contact number/i), { target: { value: '09171234567' } });
    fireEvent.click(screen.getByRole('button', { name: /send code/i }));
    await waitFor(() => screen.getByLabelText(/6-digit code/i));
    fireEvent.change(screen.getByLabelText(/6-digit code/i), { target: { value: '000000' } });
    fireEvent.click(screen.getByRole('button', { name: /^verify$/i }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/incorrect/i));
    expect(onChange).not.toHaveBeenCalledWith(expect.objectContaining({ phoneIdToken: expect.anything() }));
  });

  it('falls back to a plain number input (no token) when Firebase is not configured', () => {
    configured = false;
    const onChange = vi.fn();
    render(<PhoneVerifyField id="p" variant="card" onChange={onChange} />);

    fireEvent.change(screen.getByLabelText(/contact number/i), { target: { value: '09171234567' } });

    expect(onChange).toHaveBeenLastCalledWith({ contactNumber: '09171234567' });
    expect(screen.queryByRole('button', { name: /send code/i })).not.toBeInTheDocument();
  });
  it('offers "Verify later" when SMS is unavailable and reports an unverified number', async () => {
    mockSend.mockRejectedValue({ code: 'auth/quota-exceeded' });
    const onChange = vi.fn();
    render(<PhoneVerifyField id="p" variant="card" onChange={onChange} />);

    fireEvent.change(screen.getByLabelText(/contact number/i), { target: { value: '09171234567' } });
    fireEvent.click(screen.getByRole('button', { name: /send code/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: /verify later/i })).toBeInTheDocument());
    expect(screen.getByRole('alert')).toHaveTextContent(/unavailable/i);

    fireEvent.click(screen.getByRole('button', { name: /verify later/i }));

    expect(onChange).toHaveBeenLastCalledWith({ contactNumber: '+639171234567', verifyLater: true });
    expect(screen.getByRole('status')).toHaveTextContent(/unverified/i);
  });

  it('does not offer "Verify later" for a plain invalid-number error', async () => {
    mockSend.mockRejectedValue({ code: 'auth/invalid-phone-number' });
    render(<PhoneVerifyField id="p" variant="card" onChange={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/contact number/i), { target: { value: '123' } });
    fireEvent.click(screen.getByRole('button', { name: /send code/i }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/invalid/i));
    expect(screen.queryByRole('button', { name: /verify later/i })).not.toBeInTheDocument();
  });

  it('stops sending after the client-side cap and offers "Verify later"', async () => {
    localStorage.setItem('cv.phoneVerify.sends', JSON.stringify(Array(MAX_SENDS).fill(Date.now())));
    render(<PhoneVerifyField id="p" variant="card" onChange={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/contact number/i), { target: { value: '09171234567' } });
    fireEvent.click(screen.getByRole('button', { name: /send code/i }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/too many codes/i));
    expect(mockSend).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /verify later/i })).toBeInTheDocument();
  });
});
