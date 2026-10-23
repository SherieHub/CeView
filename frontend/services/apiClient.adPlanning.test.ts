/**
 * Paths, methods and bodies of the paid-ad planning calls (/api/ad-connections/meta/...): spend
 * limits, Meta's minimum budget, and interest search. The fetch layer itself is covered by
 * apiClient.auth.test.ts.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from './apiClient';

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
});
afterEach(() => {
  vi.unstubAllGlobals();
});

const calledPath = () => String(fetchMock.mock.calls[0][0]);
const calledInit = () => fetchMock.mock.calls[0][1] as RequestInit;

describe('apiClient.adConnections planning calls', () => {
  it('reads the spend limits', async () => {
    await apiClient.adConnections.limits.get();
    expect(calledPath()).toMatch(/\/api\/ad-connections\/meta\/limits$/);
    expect(calledInit()?.method ?? 'GET').toBe('GET');
  });

  it('saves the spend limits with PUT and the two amounts in minor units', async () => {
    await apiClient.adConnections.limits.save(50_000, 1_000_000);
    expect(calledPath()).toMatch(/\/api\/ad-connections\/meta\/limits$/);
    expect(calledInit().method).toBe('PUT');
    expect(JSON.parse(String(calledInit().body))).toEqual({ maxDailyMinor: 50_000, maxTotalMinor: 1_000_000 });
  });

  it('asks Meta\'s minimum for the chosen objective', async () => {
    await apiClient.adConnections.minimumBudget('OUTCOME_ENGAGEMENT');
    expect(calledPath()).toMatch(/\/api\/ad-connections\/meta\/minimum-budget\?objective=OUTCOME_ENGAGEMENT$/);
  });

  it('searches interests with the query encoded', async () => {
    await apiClient.adConnections.searchInterests('scuba & dive');
    expect(calledPath()).toMatch(/\/api\/ad-connections\/meta\/interests\?q=scuba%20%26%20dive$/);
  });
});
