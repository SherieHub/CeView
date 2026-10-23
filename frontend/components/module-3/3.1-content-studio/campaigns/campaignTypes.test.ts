import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MOCK_OMCS } from '../../../../services/fixtures/omcs';
import { blankPost, emptyCampaign, IDLE_AUDIT, prepState, reconcilePost, useCampaignDrafts } from './campaignTypes';
import type { PlannedPost } from './campaignTypes';

const campaign = emptyCampaign('Coastal & Island', '2026-10-17');
const approved: PlannedPost = {
  ...blankPost(campaign), caption: 'Visit our coast', mediaDataUrl: 'data:image/png;base64,test',
  status: 'approved', audit: { status: 'complete', step: 6, result: MOCK_OMCS },
};

describe('campaign approval integrity', () => {
  it.each(['caption', 'mediaDataUrl', 'platform', 'visual'] as const)('invalidates approval when %s changes', (field) => {
    const next = { ...approved, [field]: field === 'platform' ? 'facebook' : 'changed' } as PlannedPost;
    expect(reconcilePost(approved, next)).toMatchObject({ status: 'accepted', audit: IDLE_AUDIT });
  });
  it('keeps the audit when only a planned date changes', () => {
    expect(reconcilePost(approved, { ...approved, date: '2026-10-20' }).audit).toBe(approved.audit);
  });
  it('requires a completed audit even if a stale approval flag exists', () => {
    expect(prepState({ ...approved, audit: IDLE_AUDIT })).toBe('needs-audit');
    expect(prepState({ ...approved, mediaDataUrl: null })).toBe('needs-media');
  });
  it('protects both whole-plan edits and individual post patches', () => {
    const { result } = renderHook(useCampaignDrafts);
    act(() => result.current.upsert({ ...campaign, posts: [approved] }));
    act(() => result.current.upsert({ ...campaign, posts: [{ ...approved, caption: 'Edited in plan' }] }));
    expect(result.current.campaigns[0].posts[0].audit).toEqual(IDLE_AUDIT);
    act(() => result.current.patchPost(campaign.id, approved.id, { audit: approved.audit, status: 'approved' }));
    act(() => result.current.patchPost(campaign.id, approved.id, { visual: 'New direction' }));
    expect(result.current.campaigns[0].posts[0]).toMatchObject({ status: 'accepted', audit: IDLE_AUDIT });
  });
});
