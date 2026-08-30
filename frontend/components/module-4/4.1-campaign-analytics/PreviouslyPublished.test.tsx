import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { PostStoreProvider } from '../../../services/postStore';
import { OverlayStackProvider } from '../../shared/useOverlayStack';
import PreviouslyPublished from './PreviouslyPublished';
import type { PublishedPost } from '@/types';

const POSTS: PublishedPost[] = [
  { id: 'p1', date: '2026-08-04', platform: 'instagram', caption: 'IG post', status: 'published', reach: 31200, likes: 2810, comments: 142, shares: 890, engagementRate: 12.4, series: [8, 14, 22] },
  { id: 'p2', date: '2026-08-02', platform: 'tiktok', caption: 'TikTok post', status: 'published', reach: 45400, likes: 3520, comments: 120, shares: 915, engagementRate: 10.0, series: [12, 26, 38] },
  { id: 'p3', date: '2026-07-30', platform: 'facebook', caption: 'FB post', status: 'published', reach: 22100, likes: 1510, comments: 210, shares: 522, engagementRate: 10.1, series: [6, 11, 16] },
  { id: 'p4', date: '2026-07-28', platform: 'instagram', caption: 'IG post two', status: 'published', reach: 18600, likes: 1180, comments: 64, shares: 301, engagementRate: 8.8, series: [5, 9, 13] },
  { id: 'p5', date: '2026-08-12', platform: 'facebook', caption: 'Draft one', status: 'draft', reach: 0, likes: 0, comments: 0, shares: 0, engagementRate: 0, series: [] },
  { id: 'p6', date: '2026-08-18', platform: 'naver', caption: 'Draft two', status: 'draft', reach: 0, likes: 0, comments: 0, shares: 0, engagementRate: 0, series: [] },
];

vi.mock('../../../services/apiClient', () => ({
  apiClient: {
    posts: { list: vi.fn(() => Promise.resolve(POSTS)) },
  },
}));

function renderWithStore() {
  return render(
    <OverlayStackProvider>
      <PostStoreProvider>
        <PreviouslyPublished />
      </PostStoreProvider>
    </OverlayStackProvider>
  );
}

async function ready() {
  renderWithStore();
  await waitFor(() => expect(screen.getByText('IG post')).toBeInTheDocument());
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PreviouslyPublished', () => {
  it('shows exactly the filter tabs All / TikTok / Instagram / Facebook (no Naver tab)', async () => {
    await ready();

    expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'TikTok' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Instagram' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Facebook' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Naver' })).not.toBeInTheDocument();
  });

  it('the default "All" filter lists every published post and none of the drafts', async () => {
    await ready();

    expect(screen.getByText('IG post')).toBeInTheDocument();
    expect(screen.getByText('TikTok post')).toBeInTheDocument();
    expect(screen.getByText('FB post')).toBeInTheDocument();
    expect(screen.getByText('IG post two')).toBeInTheDocument();
    expect(screen.queryByText('Draft one')).not.toBeInTheDocument();
    expect(screen.queryByText('Draft two')).not.toBeInTheDocument();
  });

  it('clicking a platform tab narrows the list to that platform only', async () => {
    await ready();

    fireEvent.click(screen.getByRole('button', { name: 'Instagram' }));

    expect(screen.getByText('IG post')).toBeInTheDocument();
    expect(screen.getByText('IG post two')).toBeInTheDocument();
    expect(screen.queryByText('TikTok post')).not.toBeInTheDocument();
    expect(screen.queryByText('FB post')).not.toBeInTheDocument();
  });

  it('clicking a published row opens the analytics modal for that post', async () => {
    await ready();

    fireEvent.click(screen.getByText('IG post'));

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText('31,200')).toBeInTheDocument(); // p1's reach in the stat grid
  });

  it('shows an empty state when no posts match the current data', async () => {
    vi.mocked((await import('../../../services/apiClient')).apiClient.posts.list).mockResolvedValueOnce([]);
    render(
      <OverlayStackProvider>
        <PostStoreProvider>
          <PreviouslyPublished />
        </PostStoreProvider>
      </OverlayStackProvider>
    );

    await waitFor(() => expect(screen.getByText(/nothing published yet/i)).toBeInTheDocument());
  });
});
