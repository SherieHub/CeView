/**
 * Fixture data for the code-redemption endpoints (CVW-42), used when
 * VITE_USE_FIXTURES=true. Includes an upcoming code with nothing captured yet —
 * the state every operator sees right after an alert fires.
 */
import type {
  AttributionCodeSummary,
  AttributionLift,
  AttributionRedemption,
  CaptureKind,
  CaptureKindTotal,
  TrackedPeriodSummary,
} from '../../types';

const KINDS: CaptureKind[] = ['ENQUIRY', 'BOOKING_PLATFORM', 'CLICK_MATCHED', 'CODE_LOGGED'];

function byKind(totals: Partial<Record<CaptureKind, [number, number]>>): CaptureKindTotal[] {
  return KINDS.map((kind) => ({ kind, bookings: totals[kind]?.[0] ?? 0, revenue: totals[kind]?.[1] ?? 0 }));
}

export const MOCK_CODES: AttributionCodeSummary[] = [
  {
    attributionCodeId: '5b0d6c1e-3a2f-4e8d-9c11-7f2a4b6e8d01',
    code: 'KR-ACCO-1019',
    category: 'Accommodation & Staycation',
    targetMarket: 'korea',
    windowStart: '2026-10-19T00:00:00+08:00',
    windowEnd: '2026-11-02T00:00:00+08:00',
    status: 'ACTIVE',
    totalBookings: 6,
    totalRevenue: 98400,
    byKind: byKind({ ENQUIRY: [2, 0], CLICK_MATCHED: [1, 18400], CODE_LOGGED: [3, 80000] }),
    // More tracked than the one week reported so far — exercises the warning state.
    reportedBookings: 4,
    trackedExceedsReported: true,
  },
  {
    attributionCodeId: '9e4a2c77-1b5d-4f30-a8e2-3c6d9b1f2e02',
    code: 'JP-DIVE-1102',
    category: 'Dive Shop',
    targetMarket: 'japan',
    windowStart: '2026-11-02T00:00:00+08:00',
    windowEnd: '2026-11-16T00:00:00+08:00',
    status: 'UPCOMING',
    totalBookings: 0,
    totalRevenue: 0,
    byKind: byKind({}),
    reportedBookings: null,
    trackedExceedsReported: false,
  },
];

export function mockCodes(): AttributionCodeSummary[] {
  return MOCK_CODES.map((c) => ({ ...c, byKind: c.byKind.map((k) => ({ ...k })) }));
}

export function mockRedemptions(): AttributionRedemption[] {
  return [
    {
      redemptionId: 'a7c1e5d3-0b9f-4c2a-8e6d-1f3b5a7c9e01',
      attributionCodeId: MOCK_CODES[0].attributionCodeId,
      code: MOCK_CODES[0].code,
      source: 'MANUAL',
      kind: 'CODE_LOGGED',
      bookings: 1,
      revenue: 25000,
      eventAt: '2026-10-21T10:30:00+08:00',
      clickId: null,
      deletable: true,
    },
    {
      redemptionId: 'b8d2f6e4-1c0a-4d3b-9f7e-2a4c6b8d0f02',
      attributionCodeId: MOCK_CODES[0].attributionCodeId,
      code: MOCK_CODES[0].code,
      source: 'LINK',
      kind: 'ENQUIRY',
      bookings: 1,
      revenue: 0,
      eventAt: '2026-10-20T19:05:00+08:00',
      clickId: 'f0e1d2c3-b4a5-4968-8776-655443322110',
      deletable: false,
    },
  ];
}

export function mockLift(attributionCodeId: string): AttributionLift {
  const code = MOCK_CODES.find((c) => c.attributionCodeId === attributionCodeId) ?? MOCK_CODES[0];
  if (code.status === 'UPCOMING') {
    return {
      attributionCodeId: code.attributionCodeId,
      code: code.code,
      windowStart: code.windowStart,
      windowEnd: code.windowEnd,
      baselineStart: '2026-10-05',
      status: 'UPCOMING',
      windowPeriods: 0,
      baselinePeriods: 4,
      baselineWeeks: 4,
      shortBaseline: false,
      windowBookingsPerWeek: null,
      baselineBookingsPerWeek: 5,
      bookingsLiftPct: null,
      windowRevenuePerWeek: null,
      baselineRevenuePerWeek: 61000,
      revenueLiftPct: null,
    };
  }
  return {
    attributionCodeId: code.attributionCodeId,
    code: code.code,
    windowStart: code.windowStart,
    windowEnd: code.windowEnd,
    baselineStart: '2026-09-21',
    status: 'OK',
    windowPeriods: 1,
    baselinePeriods: 3,
    baselineWeeks: 3,
    shortBaseline: true,
    windowBookingsPerWeek: 7,
    baselineBookingsPerWeek: 5,
    bookingsLiftPct: 40,
    windowRevenuePerWeek: 98400,
    baselineRevenuePerWeek: 61000,
    revenueLiftPct: 61.3,
  };
}

export function mockTracked(periodStart: string, periodEnd: string): TrackedPeriodSummary {
  return {
    periodStart,
    periodEnd,
    trackedBookings: 3,
    automaticBookings: 1,
    clickMatchedBookings: 1,
    codeLoggedBookings: 1,
    trackedRevenue: 43400,
  };
}
