import { describe, expect, it } from 'vitest';
import {
  MAX_POSTER_CHARS, buildPayload, composerFromSaved, isStale, parsePayload, profileFingerprint,
} from './contentDraftPayload';
import { MOCK_OMCS } from '../../../services/fixtures/omcs';
import { buildContentResponse } from './testFixtures';
import type { PublishDraftState } from './contentStudioTypes';

const DRAFT: PublishDraftState = {
  caption: 'Dive at golden hour', captionEn: 'English reading aid', mediaDataUrl: 'data:image/png;base64,AAAA',
  localVideoUrl: 'blob:http://x/1', mediaUpload: { status: 'ready', mediaId: 'm1', publicUrl: 'https://cdn/x.png' },
  platforms: ['instagram'], visibility: 'private', commentsEnabled: false, paidPartnership: false,
  agreementChecked: true, scheduledFor: '2026-11-01T09:00',
};

const payload = () => buildPayload({
  content: buildContentResponse('groq'), activePlatform: 'instagram', selectedOption: 1, qpStep: 'attach',
  draft: DRAFT, alertId: 'alert-1', windowOpenDate: '2026-11-01T00:00:00Z', fingerprint: 'fp',
});

describe('contentDraftPayload', () => {
  it('saves the captions, direction and edits but never media or the authorisation tick', () => {
    const saved = payload();
    expect(saved.content.captions.instagram.options.length).toBeGreaterThan(0);
    expect(saved.selectedOption).toBe(1);
    expect(saved.draft).toMatchObject({
      caption: 'Dive at golden hour', captionEn: 'English reading aid', visibility: 'private', commentsEnabled: false,
    });
    const text = JSON.stringify(saved);
    expect(text).not.toContain('data:image');
    expect(text).not.toContain('blob:');
    expect(saved.draft).not.toHaveProperty('agreementChecked');
    expect(saved.draft).not.toHaveProperty('mediaUpload');
  });

  it('restores a composer with no media and an unticked authorisation', () => {
    const restored = composerFromSaved(payload().draft);
    expect(restored.caption).toBe('Dive at golden hour');
    expect(restored.mediaDataUrl).toBeNull();
    expect(restored.agreementChecked).toBe(false);
  });

  describe('the paid-ad settings', () => {
    const NEW_AD = {
      objective: 'OUTCOME_ENGAGEMENT' as const, dailyBudgetMinor: 10_000, startTime: '2026-11-01T00:00:00.000Z', durationDays: 30,
      interests: [{ id: '6003020834693', name: 'Scuba diving' }], advantageAudience: true, attributionLinkId: 'l1', pinCampaign: true,
    };

    it('keeps the ad, with its interests and duration, through a save and restore', () => {
      const saved = buildPayload({
        content: buildContentResponse('groq'), activePlatform: 'instagram', selectedOption: 0, qpStep: 'attach',
        draft: { ...DRAFT, paidPartnership: true, ad: NEW_AD }, alertId: 'a', windowOpenDate: null, fingerprint: 'fp',
      });
      const restored = composerFromSaved(JSON.parse(JSON.stringify(saved.draft)));
      expect(restored.ad).toEqual(NEW_AD);
    });

    it('brings a draft saved with the old ad shape (end time and countries) up to date', () => {
      const old = {
        ...payload().draft,
        ad: {
          objective: 'OUTCOME_TRAFFIC', dailyBudgetMinor: 5000, startTime: '2026-11-01T00:00:00.000Z',
          endTime: '2026-11-09T00:00:00.000Z', countries: ['KR'], attributionLinkId: 'l1', pinCampaign: false,
        },
      };
      const restored = composerFromSaved(old as unknown as ReturnType<typeof payload>['draft']);
      expect(restored.ad).toEqual({
        objective: 'OUTCOME_TRAFFIC', dailyBudgetMinor: 5000, startTime: '2026-11-01T00:00:00.000Z', durationDays: 8,
        interests: [], advantageAudience: false, attributionLinkId: 'l1', pinCampaign: false,
      });
    });

    it('restores no ad when none was saved', () => {
      expect(composerFromSaved(payload().draft)).not.toHaveProperty('ad');
    });
  });

  it('never resumes on Validate, which needs media and a passing audit that are not saved', () => {
    const saved = buildPayload({
      content: buildContentResponse('groq'), activePlatform: 'tiktok', selectedOption: null, qpStep: 'validate',
      draft: DRAFT, alertId: 'a', windowOpenDate: null, fingerprint: 'fp',
    });
    expect(saved.qpStep).toBe('attach');
  });

  it('round-trips through JSON', () => {
    expect(parsePayload(JSON.parse(JSON.stringify(payload())))).toEqual(payload());
  });

  it('treats a payload from another schema version, or a damaged one, as no draft', () => {
    expect(parsePayload(null)).toBeNull();
    expect(parsePayload({})).toBeNull();
    expect(parsePayload({ ...payload(), schemaVersion: 2 })).toBeNull();
    expect(parsePayload({ ...payload(), activePlatform: 'naver' })).toBeNull();
    expect(parsePayload({ ...payload(), content: { captions: { instagram: { options: [] } } } })).toBeNull();
  });

  it('is stale for another surge window or a changed profile, and fresh otherwise', () => {
    const saved = payload();
    expect(isStale(saved, 'alert-1', 'fp')).toBe(false);
    expect(isStale(saved, 'alert-2', 'fp')).toBe(true);
    expect(isStale(saved, 'alert-1', 'fp2')).toBe(true);
  });

  it('fingerprints the profile fields and trend that feed generation, ignoring category order', () => {
    const base = { businessName: 'B', description: 'D', categories: ['a', 'b'] };
    expect(profileFingerprint(base, 'steady')).toBe(profileFingerprint({ ...base, categories: ['b', 'a'] }, 'steady'));
    expect(profileFingerprint(base, 'steady')).not.toBe(profileFingerprint(base, 'surging'));
    expect(profileFingerprint(base, 'steady')).not.toBe(profileFingerprint({ ...base, description: 'E' }, 'steady'));
  });
});

describe('contentDraftPayload — media and audit', () => {
  const COMPLETE = { status: 'complete' as const, step: 6, result: MOCK_OMCS };
  const withAudit = (over: Partial<Parameters<typeof buildPayload>[0]> = {}) => buildPayload({
    content: buildContentResponse('groq'), activePlatform: 'instagram', selectedOption: 1, qpStep: 'validate',
    draft: DRAFT, audit: COMPLETE, alertId: 'alert-1', windowOpenDate: null, fingerprint: 'fp', ...over,
  });

  it('saves the attached image as a reference to the stored copy, never its bytes', () => {
    const saved = withAudit();
    expect(saved.media).toEqual({ kind: 'image', mediaId: 'm1', publicUrl: 'https://cdn/x.png' });
    expect(JSON.stringify(saved)).not.toContain('data:image');
  });

  it('saves the finished audit with it, and resumes on Validate', () => {
    const saved = withAudit();
    expect(saved.audit).toEqual(MOCK_OMCS);
    expect(saved.qpStep).toBe('validate');
  });

  it('saves no media while it is still uploading, and no audit without media', () => {
    const uploading = withAudit({ draft: { ...DRAFT, mediaUpload: { status: 'uploading' } } });
    expect(uploading.media).toBeNull();
    expect(uploading.audit).toBeNull();
    expect(uploading.qpStep).toBe('attach');
  });

  it('does not save an audit that has not finished', () => {
    const running = withAudit({ audit: { status: 'running', step: 3, result: null } });
    expect(running.audit).toBeNull();
    expect(running.qpStep).toBe('attach');
  });

  it('keeps a video poster frame only while it is small enough', () => {
    const video = (poster: string) => withAudit({
      draft: { ...DRAFT, mediaType: 'video', mediaDataUrl: poster, mediaUpload: { status: 'ready', mediaId: 'v1', publicUrl: 'https://cdn/v.mp4' } },
    });
    expect(video('data:image/jpeg;base64,AAAA').media?.posterDataUrl).toBe('data:image/jpeg;base64,AAAA');
    expect(video(`data:image/jpeg;base64,${'A'.repeat(MAX_POSTER_CHARS)}`).media?.posterDataUrl ?? null).toBeNull();
  });

  it('restores an image as its stored copy, ready to publish, with the authorisation unticked', () => {
    const saved = withAudit();
    const composer = composerFromSaved(saved.draft, saved.media);
    expect(composer.mediaDataUrl).toBe('https://cdn/x.png');
    expect(composer.mediaType).toBe('image');
    expect(composer.mediaUpload).toEqual({ status: 'ready', mediaId: 'm1', publicUrl: 'https://cdn/x.png' });
    expect(composer.agreementChecked).toBe(false);
  });

  it('restores a video playing from its stored copy, with its poster when it was kept', () => {
    const saved = withAudit({
      draft: { ...DRAFT, mediaType: 'video', mediaDataUrl: 'data:image/jpeg;base64,AAAA', mediaUpload: { status: 'ready', mediaId: 'v1', publicUrl: 'https://cdn/v.mp4' } },
    });
    const composer = composerFromSaved(saved.draft, saved.media);
    expect(composer.mediaType).toBe('video');
    expect(composer.localVideoUrl).toBe('https://cdn/v.mp4');
    expect(composer.mediaDataUrl).toBe('data:image/jpeg;base64,AAAA');
  });

  it('restores no media for a draft saved without any', () => {
    expect(composerFromSaved(payload().draft).mediaDataUrl).toBeNull();
    expect(composerFromSaved(payload().draft, null).mediaUpload).toBeUndefined();
  });

  it('round-trips media and audit through JSON', () => {
    const saved = withAudit();
    const parsed = parsePayload(JSON.parse(JSON.stringify(saved)));
    expect(parsed?.media?.mediaId).toBe('m1');
    expect(parsed?.audit?.omcsScore).toBe(MOCK_OMCS.omcsScore);
    expect(parsed?.qpStep).toBe('validate');
  });

  it('still loads a draft saved before media was included', () => {
    const { media: _media, audit: _audit, ...old } = payload();
    void _media; void _audit;
    const parsed = parsePayload(JSON.parse(JSON.stringify(old)));
    expect(parsed).not.toBeNull();
    expect(parsed?.media ?? null).toBeNull();
    expect(parsed?.audit ?? null).toBeNull();
  });

  it('drops a damaged media or audit rather than the whole draft', () => {
    const saved = JSON.parse(JSON.stringify(withAudit()));
    const brokenMedia = parsePayload({ ...saved, media: { kind: 'image' } });
    expect(brokenMedia).not.toBeNull();
    expect(brokenMedia?.media).toBeNull();
    expect(brokenMedia?.audit).toBeNull(); // an audit means nothing without its media
    expect(brokenMedia?.qpStep).toBe('attach');

    const brokenAudit = parsePayload({ ...saved, audit: { status: 'Maybe' } });
    expect(brokenAudit?.media?.mediaId).toBe('m1');
    expect(brokenAudit?.audit).toBeNull();
    expect(brokenAudit?.qpStep).toBe('attach');
  });

  it('never resumes on Validate from a payload that lacks what Validate needs', () => {
    const saved = JSON.parse(JSON.stringify(withAudit()));
    expect(parsePayload({ ...saved, audit: null })?.qpStep).toBe('attach');
    expect(parsePayload({ ...saved, media: null })?.qpStep).toBe('attach');
  });
});
