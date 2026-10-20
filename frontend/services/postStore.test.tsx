import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { PostStoreProvider, usePosts } from './postStore';
import { MOCK_POSTS } from './fixtures/posts';
import type { PostStore } from './postStore';

vi.mock('./apiClient', () => ({
  apiClient: {
    posts: {
      publish: vi.fn(),
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
  it('adds only server persisted results, including platform failures', async () => {
    renderProbe();
    await waitFor(() => expect(captured?.posts).not.toBeNull());
    const result = [{ ...MOCK_POSTS[0], id: 'persisted', status: 'failed' as const, errorMessage: 'Reconnect' }];
    vi.mocked(apiClient.posts.publish).mockResolvedValue(result);
    const payload = { requestId: 'request', platforms: ['instagram'], captionsByPlatform: { instagram: 'Caption' }, mediaId: 'media', visibility: 'public' as const, approved: true as const };
    await act(async () => { await captured!.publish(payload); });
    expect(apiClient.posts.publish).toHaveBeenCalledWith(payload);
    expect(captured!.posts![0]).toEqual(result[0]);
  });
  it('preserves the existing list and rejects when publishing fails', async () => {
    renderProbe();
    await waitFor(() => expect(captured?.posts).not.toBeNull());
    vi.mocked(apiClient.posts.publish).mockRejectedValue(new Error('network down'));
    await expect(captured!.publish({ requestId: 'request', platforms: ['instagram'], captionsByPlatform: { instagram: 'Caption' }, mediaId: 'media', visibility: 'public', approved: true })).rejects.toThrow('network down');
    expect(captured!.posts).toEqual(MOCK_POSTS);
  });
});

describe('PostStoreProvider — metricsFor()', () => {
  it('keeps a confirmed write when an older list request finishes late', async () => {
    let resolveList!: (posts: typeof MOCK_POSTS) => void;
    vi.mocked(apiClient.posts.list).mockImplementationOnce(() => new Promise((resolve) => { resolveList = resolve; }));
    renderProbe();
    const confirmed = { ...MOCK_POSTS[0], id: 'new-confirmed' };
    act(() => captured!.add([confirmed]));
    await act(async () => { resolveList([]); });
    expect(captured!.posts).toEqual([confirmed]);
  });
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
