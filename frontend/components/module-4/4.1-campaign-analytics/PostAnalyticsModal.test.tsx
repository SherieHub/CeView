import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { PostStoreProvider } from '../../../services/postStore';
import { OverlayStackProvider } from '../../shared/useOverlayStack';
import PostAnalyticsModal from './PostAnalyticsModal';
import type { PublishedPost } from '@/types';

const LONG_CAPTION =
  'POV: you booked the resort you kept postponing and now every single one of your friends wants the exact same room for the exact same week';

const POSTS: PublishedPost[] = [
  { id: 'has-data', date: '2026-08-04', platform: 'instagram', caption: LONG_CAPTION, status: 'published', reach: 31200, likes: 2810, comments: 142, shares: 890, engagementRate: 12.4, series: [8, 14, 22, 29, 31, 30, 28] },
  { id: 'no-data', date: '2026-08-12', platform: 'facebook', caption: 'Draft pending rate confirmation.', status: 'draft', reach: 0, likes: 0, comments: 0, shares: 0, engagementRate: 0, series: [] },
];

vi.mock('../../../services/apiClient', () => ({
  apiClient: {
    posts: { list: vi.fn(() => Promise.resolve(POSTS)) },
  },
}));

function renderModal(postId: string, onClose = vi.fn()) {
  return render(
    <OverlayStackProvider>
      <PostStoreProvider>
        <PostAnalyticsModal postId={postId} onClose={onClose} />
      </PostStoreProvider>
    </OverlayStackProvider>
  );
}

async function readyDialog() {
  await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PostAnalyticsModal', () => {
  it('renders the reach-accumulation chart when the post has reach data', async () => {
    renderModal('has-data');
    await readyDialog();

    expect(screen.getByTestId('reach-chart')).toBeInTheDocument();
    expect(screen.queryByText(/no data yet/i)).not.toBeInTheDocument();
  });

  it('renders a "No data yet" empty state when the post has zero reach', async () => {
    renderModal('no-data');
    await readyDialog();

    expect(screen.getByText(/no data yet/i)).toBeInTheDocument();
    expect(screen.queryByTestId('reach-chart')).not.toBeInTheDocument();
  });

  it('shows the stat grid values for a post', async () => {
    renderModal('has-data');
    await readyDialog();

    expect(screen.getByText('31,200')).toBeInTheDocument(); // reach
    expect(screen.getByText('2,810')).toBeInTheDocument(); // likes
    expect(screen.getByText('142')).toBeInTheDocument(); // comments
    expect(screen.getByText('890')).toBeInTheDocument(); // shares
    expect(screen.getByText('12.4%')).toBeInTheDocument(); // engagement rate
  });

  it('truncates a caption longer than 110 characters with an ellipsis', async () => {
    renderModal('has-data');
    await readyDialog();

    const truncated = LONG_CAPTION.slice(0, 110) + '…';
    expect(screen.getByText(truncated)).toBeInTheDocument();
    expect(screen.queryByText(LONG_CAPTION)).not.toBeInTheDocument();
  });
});
