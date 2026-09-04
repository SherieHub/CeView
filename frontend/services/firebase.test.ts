import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetIdToken = vi.fn().mockResolvedValue('the-id-token');
const mockSignInWithPopup = vi.fn().mockResolvedValue({
  user: { getIdToken: mockGetIdToken },
});
const mockInitializeApp = vi.fn().mockReturnValue({ name: 'test-app' });
const mockGetApps = vi.fn().mockReturnValue([]);
const mockGetApp = vi.fn().mockReturnValue({ name: 'test-app' });
const mockGetAuth = vi.fn().mockReturnValue({ name: 'test-auth' });
/** Shared across provider instances so tests can assert what was requested. */
const mockSetCustomParameters = vi.fn();

vi.mock('firebase/app', () => ({
  initializeApp: (...args: unknown[]) => mockInitializeApp(...args),
  getApps: () => mockGetApps(),
  getApp: () => mockGetApp(),
}));

vi.mock('firebase/auth', () => ({
  getAuth: (...args: unknown[]) => mockGetAuth(...args),
  // setCustomParameters is part of the real GoogleAuthProvider surface and
  // signInWithGooglePopup calls it, so the double has to carry it — without it
  // every test here fails with "setCustomParameters is not a function" rather
  // than testing anything.
  GoogleAuthProvider: vi.fn().mockImplementation(function GoogleAuthProvider(this: {
    providerId: string;
    setCustomParameters: (params: Record<string, string>) => void;
  }) {
    this.providerId = 'google.com';
    this.setCustomParameters = mockSetCustomParameters;
  }),
  signInWithPopup: (...args: unknown[]) => mockSignInWithPopup(...args),
}));

describe('signInWithGooglePopup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetApps.mockReturnValue([]);
    mockGetIdToken.mockResolvedValue('the-id-token');
    mockSignInWithPopup.mockResolvedValue({ user: { getIdToken: mockGetIdToken } });
  });

  it('resolves with the Firebase ID token from a successful popup sign-in', async () => {
    const { signInWithGooglePopup } = await import('./firebase');

    const token = await signInWithGooglePopup();

    expect(token).toBe('the-id-token');
    expect(mockSignInWithPopup).toHaveBeenCalledTimes(1);
  });

  it('asks Google for the account chooser rather than reusing the browser session', async () => {
    // Load-bearing: without prompt=select_account Google silently reuses the
    // existing session, so a user can never switch accounts without signing
    // out of Google entirely. Nothing asserted this before, which is how the
    // setCustomParameters call reached CI with a mock that lacked it.
    const { signInWithGooglePopup } = await import('./firebase');

    await signInWithGooglePopup();

    expect(mockSetCustomParameters).toHaveBeenCalledWith({ prompt: 'select_account' });
  });

  it('initializes the Firebase app only once across repeated calls', async () => {
    mockGetApps.mockReturnValueOnce([]).mockReturnValue([{ name: 'test-app' }]);
    const { signInWithGooglePopup } = await import('./firebase');

    await signInWithGooglePopup();
    await signInWithGooglePopup();

    expect(mockInitializeApp).toHaveBeenCalledTimes(1);
  });

  it('propagates a popup failure (e.g. user closed the popup) to the caller', async () => {
    mockSignInWithPopup.mockRejectedValueOnce(new Error('popup-closed-by-user'));
    const { signInWithGooglePopup } = await import('./firebase');

    await expect(signInWithGooglePopup()).rejects.toThrow('popup-closed-by-user');
  });
});
