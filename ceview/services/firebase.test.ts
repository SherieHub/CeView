import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetIdToken = vi.fn().mockResolvedValue('the-id-token');
const mockSignInWithPopup = vi.fn().mockResolvedValue({
  user: { getIdToken: mockGetIdToken },
});
const mockInitializeApp = vi.fn().mockReturnValue({ name: 'test-app' });
const mockGetApps = vi.fn().mockReturnValue([]);
const mockGetApp = vi.fn().mockReturnValue({ name: 'test-app' });
const mockGetAuth = vi.fn().mockReturnValue({ name: 'test-auth' });

vi.mock('firebase/app', () => ({
  initializeApp: (...args: unknown[]) => mockInitializeApp(...args),
  getApps: () => mockGetApps(),
  getApp: () => mockGetApp(),
}));

vi.mock('firebase/auth', () => ({
  getAuth: (...args: unknown[]) => mockGetAuth(...args),
  GoogleAuthProvider: vi.fn().mockImplementation(function GoogleAuthProvider(this: { providerId: string }) {
    this.providerId = 'google.com';
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
