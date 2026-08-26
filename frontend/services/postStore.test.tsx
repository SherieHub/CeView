import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { PostStoreProvider, usePosts } from './postStore';
import { MOCK_POSTS } from './fixtures/posts';
import type { PostStore } from './postStore';

vi.mock('./apiClient', () => ({
  apiClient: {
    posts: {
      list: vi.fn(() => Promise.resolve(MOCK_POSTS)),
    },
  },
}));

import { apiClient } from './apiClient';

let captured: PostStore | null = null;

function Probe() {
  captured = usePosts();
  return null;
}

function renderProbe() {
  captured = null;
  return render(
    <PostStoreProvider>
      <Probe />
    </PostStoreProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(apiClient.posts.list).mockResolvedValue(MOCK_POSTS);
});

describe('usePosts', () => {
  it('throws when called outside the provider', () => {
    function Bare() {
      usePosts();
      return null;
    }
    expect(() => render(<Bare />)).toThrow('usePosts must be used within a PostStoreProvider');
  });
});

describe('PostStoreProvider — seeding', () => {
  it('starts with posts=null then seeds from apiClient.posts.list()', async () => {
    renderProbe();

    expect(captured?.posts).toBeNull();

    await waitFor(() => expect(captured?.posts).not.toBeNull());
    expect(captured?.posts).toEqual(MOCK_POSTS);
  });

  it('falls back to an empty array when the list fetch fails', async () => {
    vi.mocked(apiClient.posts.list).mockRejectedValue(new Error('network down'));
    renderProbe();

    await waitFor(() => expect(captured?.posts).not.toBeNull());
    expect(captured?.posts).toEqual([]);
  });
});

describe('PostStoreProvider — publish()', () => {
  it('appends one new post per selected platform, prepended before existing posts', async () => {
    renderProbe();
    await waitFor(() => expect(captured?.posts).not.toBeNull());
    const seededCount = captured!.posts!.length;

    let created: ReturnType<PostStore['publish']> = [];
    act(() => {
      created = captured!.publish({
        caption: 'New season, new sardines',
        mediaDataUrl: null,
        platforms: ['instagram', 'tiktok'],
      });
    });

    expect(created).toHaveLength(2);
    expect(created.map((p) => p.platform).sort()).toEqual(['instagram', 'tiktok']);
    created.forEach((post) => {
      expect(post.status).toBe('published');
      expect(post.caption).toBe('New season, new sardines');
      expect(post.reach).toBe(0);
      expect(post.likes).toBe(0);
      expect(post.comments).toBe(0);
      expect(post.shares).toBe(0);
      expect(post.engagementRate).toBe(0);
      expect(post.series).toEqual([]);
      expect(post.id).toContain('p-');
    });

    expect(captured!.posts).toHaveLength(seededCount + 2);
    // prepended: the two new posts come before every seeded post
    expect(captured!.posts!.slice(0, 2).map((p) => p.id)).toEqual(created.map((p) => p.id));
  });
});

describe('PostStoreProvider — metricsFor()', () => {
  it('returns the matching post when found', async () => {
    renderProbe();
    await waitFor(() => expect(captured?.posts).not.toBeNull());

    const target = MOCK_POSTS[0];
    expect(captured!.metricsFor(target.id)).toEqual(target);
  });

  it('returns null when no post matches', async () => {
    renderProbe();
    await waitFor(() => expect(captured?.posts).not.toBeNull());

    expect(captured!.metricsFor('does-not-exist')).toBeNull();
  });
});
