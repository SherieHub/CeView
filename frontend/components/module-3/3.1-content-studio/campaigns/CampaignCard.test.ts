import { describe, expect, it } from 'vitest';
import { campaignStage } from './CampaignCard';
import { blankPost, emptyCampaign } from './campaignTypes';
import type { CampaignDraft } from './campaignTypes';

const withPosts = (stage: CampaignDraft['stage'], statuses: Array<'accepted' | 'approved' | 'skipped'>): CampaignDraft => {
  const c = emptyCampaign('Coastal & Island', '2026-10-18');
  return { ...c, stage, posts: statuses.map((status) => ({ ...blankPost(c), status })) };
};

describe('campaignStage', () => {
  it('calls a campaign still being reviewed a draft', () => {
    expect(campaignStage(withPosts('strategy', []))).toEqual({ label: 'Draft', tone: 'draft' });
    expect(campaignStage(withPosts('plan', ['accepted']))).toEqual({ label: 'Draft', tone: 'draft' });
  });

  it('is in progress while posts are being prepared or partly approved', () => {
    expect(campaignStage(withPosts('prepare', ['accepted'])).tone).toBe('progress');
    expect(campaignStage(withPosts('done', ['approved', 'accepted'])).tone).toBe('progress');
  });

  it('is planned when finalized with nothing approved, ready when every live post is', () => {
    expect(campaignStage(withPosts('done', ['accepted', 'accepted']))).toEqual({ label: 'Planned', tone: 'planned' });
    // A skipped post doesn't hold the campaign back.
    expect(campaignStage(withPosts('done', ['approved', 'skipped']))).toEqual({ label: 'Ready', tone: 'ready' });
  });
});
