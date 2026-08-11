/**
 * Fixture-mode integration tests — Foundation Card "Fixture Data Layer".
 * Asserts that when VITE_USE_FIXTURES=true, apiClient's posts/connections/
 * workspace/post-metrics methods resolve to the matching fixture shape
 * WITHOUT calling fetch (network boundary must be untouched in fixture mode).
 *
 * Run with: VITE_USE_FIXTURES=true npm run test:integration
 * (see 01-foundation.md for why this lives in tests/integration/ rather
 * than under components/ — npm run test:unit only scopes --dir components).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { api } from '../../services/apiClient';
import { MOCK_POSTS } from '../../services/fixtures/posts';
import { MOCK_MEMBERS } from '../../services/fixtures/members';

const FIXTURES_ON = import.meta.env.VITE_USE_FIXTURES === 'true';

describe.skipIf(!FIXTURES_ON)('apiClient fixture-mode methods (VITE_USE_FIXTURES=true)', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('listPosts resolves to MOCK_POSTS without calling fetch', async () => {
    const result = await api.listPosts();
    expect(result.posts).toEqual(MOCK_POSTS);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('listPosts returns posts with the SocialPost shape', async () => {
    const result = await api.listPosts();
    for (const post of result.posts) {
      expect(post).toMatchObject({
        id: expect.any(String),
        date: expect.any(String),
        platform: expect.any(String),
        caption: expect.any(String),
        status: expect.stringMatching(/^(published|draft)$/),
        reach: expect.any(Number),
        likes: expect.any(Number),
        comments: expect.any(Number),
        shares: expect.any(Number),
        engagementRate: expect.any(Number),
        series: expect.any(Array),
      });
    }
  });

  it('createPost returns a SocialPost shaped object without calling fetch', async () => {
    const created = await api.createPost({
      platform: 'instagram',
      caption: 'New draft caption',
      status: 'draft',
    });
    expect(created).toMatchObject({
      id: expect.any(String),
      platform: 'instagram',
      caption: 'New draft caption',
      status: 'draft',
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('listPlatformConnections resolves to a PlatformConnection[] without calling fetch', async () => {
    const result = await api.listPlatformConnections();
    expect(result.connections.length).toBeGreaterThan(0);
    for (const conn of result.connections) {
      expect(conn).toMatchObject({
        platform: expect.any(String),
        connected: expect.any(Boolean),
      });
    }
    expect(fetch).not.toHaveBeenCalled();
  });

  it('connectPlatform marks the given platform connected without calling fetch', async () => {
    const conn = await api.connectPlatform('tiktok', '@sunsetcove');
    expect(conn).toEqual({ platform: 'tiktok', connected: true, accountLabel: '@sunsetcove' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('disconnectPlatform marks the given platform disconnected without calling fetch', async () => {
    const conn = await api.disconnectPlatform('facebook');
    expect(conn).toEqual({ platform: 'facebook', connected: false });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('listWorkspaceMembers resolves to MOCK_MEMBERS without calling fetch', async () => {
    const result = await api.listWorkspaceMembers();
    expect(result.members).toEqual(MOCK_MEMBERS);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('getPostMetrics resolves to a PostMetric[] derived from the post series without calling fetch', async () => {
    const result = await api.getPostMetrics('p1');
    expect(result.metrics.length).toBeGreaterThan(0);
    for (const point of result.metrics) {
      expect(point).toMatchObject({
        date: expect.any(String),
        reach: expect.any(Number),
        likes: expect.any(Number),
        comments: expect.any(Number),
        shares: expect.any(Number),
      });
    }
    expect(fetch).not.toHaveBeenCalled();
  });

  it('getPostMetrics returns an empty series for an unknown post id', async () => {
    const result = await api.getPostMetrics('does-not-exist');
    expect(result.metrics).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });
});
