import type { AttributionEnquiryInput } from '../types';
import { loadTokens } from './authStorage';

export interface OperatorEnquiry {
  enquiryId: string;
  contactName: string;
  contactValue: string;
  partySize: number | null;
  requestedStart: string | null;
  requestedEnd: string | null;
  message: string | null;
  createdAt: string;
}

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, { cache: 'no-store', ...init });
  if (!response.ok) throw new Error('Unable to complete the enquiry request.');
  return response.json() as Promise<T>;
}

export const attributionEnquiries = {
  // Public calls deliberately send no operator token, even in a signed-in browser.
  context: (clickId: string, signal?: AbortSignal) =>
    request<{ businessName: string }>(
      `/api/public/attribution/enquiries/context?cv=${encodeURIComponent(clickId)}`, { signal },
    ),
  submit: (input: AttributionEnquiryInput) =>
    request<{ received: boolean }>('/api/public/attribution/enquiries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }),
  list: (signal?: AbortSignal): Promise<OperatorEnquiry[]> => {
    if (import.meta.env.VITE_USE_FIXTURES === 'true' && !import.meta.env.PROD) {
      return Promise.resolve([]);
    }
    const tokens = loadTokens();
    return request('/api/attribution/enquiries', {
      signal,
      headers: tokens ? { Authorization: `Bearer ${tokens.accessToken}` } : {},
    });
  },
};
