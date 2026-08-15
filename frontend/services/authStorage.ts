/**
 * Thin localStorage wrapper for JWT persistence. Isolated from auth.tsx so
 * the storage mechanism can be swapped (e.g. httpOnly cookie) without
 * touching AuthProvider's logic.
 */
import type { AuthTokens } from '../types';

const STORAGE_KEY = 'ceview.auth';

export function loadTokens(): AuthTokens | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthTokens;
  } catch {
    return null;
  }
}

export function saveTokens(tokens: AuthTokens): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
}

export function clearTokens(): void {
  localStorage.removeItem(STORAGE_KEY);
}
