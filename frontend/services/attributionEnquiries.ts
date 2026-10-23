import type { AttributionEnquiryInput } from '../types';
import { loadTokens } from './authStorage';
import { ApiError } from './apiError';

export type EnquiryOutcome = 'NEW' | 'BOOKED' | 'DECLINED';

/** What the operator tells the server about an enquiry. Figures only apply to BOOKED. */
export interface EnquiryOutcomeInput {
  outcome: 'BOOKED' | 'DECLINED';
  bookings?: number;
  revenue?: number;
}

export interface OperatorEnquiry {
  enquiryId: string;
  contactName: string;
  contactValue: string;
  partySize: number | null;
  requestedStart: string | null;
  requestedEnd: string | null;
  message: string | null;
  createdAt: string;
  /** NEW until the operator acts. The traveller's submit counts as one booking at zero revenue. */
  outcome: EnquiryOutcome;
  /** What this enquiry currently contributes to the evidence: 0 once declined. */
  bookings: number;
  revenue: number;
  /** False when the traveller clicked after the campaign window had closed. */
  clickInWindow: boolean;
}

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, { cache: 'no-store', ...init });
  // Carry the status: the public form must tell "this link is dead" (400) apart from "the server is
  // waking up" (5xx), and a network failure still surfaces as fetch's own TypeError.
  if (!response.ok) throw new ApiError({ status: response.status, method: init?.method ?? 'GET', path });
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
  setOutcome: (enquiryId: string, input: EnquiryOutcomeInput): Promise<OperatorEnquiry> => {
    const tokens = loadTokens();
    return request(`/api/attribution/enquiries/${encodeURIComponent(enquiryId)}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(tokens ? { Authorization: `Bearer ${tokens.accessToken}` } : {}),
      },
      body: JSON.stringify(input),
    });
  },
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
