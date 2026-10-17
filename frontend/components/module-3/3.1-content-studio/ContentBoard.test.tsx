import type { ReactElement } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import ContentBoard from './ContentBoard';
import { OverlayStackProvider } from '../../shared/useOverlayStack';
// MOCK_POSTS, not previewFixtures' DEMO_BOARD_POSTS: previewFixtures.ts is
// marked for deletion once the design is signed off, and a permanent test must
// not break when it goes.
import { MOCK_POSTS } from '../../../services/fixtures/posts';
import type { PublishedPost } from '@/types';
import type { PublishDraftState } from './contentStudioTypes';

const DRAFT: PublishDraftState = {
  caption: 'x', mediaDataUrl: 'data:image/png;base64,x', platforms: ['instagram'],
  visibility: 'public', commentsEnabled: true, paidPartnership: false, agreementChecked: true,
};

// As the app mounts it: the post detail is a Modal on the shared overlay stack.
const renderBoard = (ui: ReactElement) => render(<OverlayStackProvider>{ui}</OverlayStackProvider>);

describe('ContentBoard publish disclosure', () => {
  it('hides the Publish button entirely before a passing audit', () => {
    renderBoard(<ContentBoard draft={DRAFT} posts={MOCK_POSTS} canPublish={false} onPublished={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /^Publish/ })).toBeNull();
  });

  it('reveals it once the audit passes', () => {
    renderBoard(<ContentBoard draft={DRAFT} posts={MOCK_POSTS} canPublish onPublished={vi.fn()} />);
    expect(screen.getByRole('button', { name: /^Publish/ })).toBeTruthy();
  });
});

describe('ContentBoard post detail', () => {
  const NEW: PublishedPost[] = [
    { id: 'n1', date: '2026-10-17', platform: 'instagram', caption: 'Fresh post', status: 'published', reach: 0, likes: 0, comments: 0, shares: 0, engagementRate: 0, series: [], mediaUrl: 'data:image/png;base64,x' },
    { id: 'n2', date: '2026-10-17', platform: 'facebook', caption: 'Fresh post', status: 'published', reach: 0, likes: 0, comments: 0, shares: 0, engagementRate: 0, series: [], mediaUrl: 'data:image/png;base64,x' },
  ];

  it('opens any post from its card', async () => {
    renderBoard(<ContentBoard draft={DRAFT} posts={MOCK_POSTS} canPublish={false} onPublished={vi.fn()} />);
    // Rows are sorted by date, so open this post by its own button.
    const first = MOCK_POSTS[0];
    await userEvent.click(screen.getByRole('button', { name: `View Instagram post from ${first.date}` }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(MOCK_POSTS[0].caption)).toBeTruthy();
    expect(within(dialog).getByText('Reach')).toBeTruthy();
  });

  it('arrives with a just-published post open, its siblings named and flagged', () => {
    renderBoard(
      <ContentBoard
        draft={DRAFT}
        posts={[...NEW, ...MOCK_POSTS]}
        canPublish={false}
        onPublished={vi.fn()}
        openPostId="n1"
        onOpenPost={vi.fn()}
        justPublished={['n1', 'n2']}
      />,
    );
    const dialog = screen.getByRole('dialog', { name: 'Published to Instagram' });
    expect(within(dialog).getByRole('status')).toHaveTextContent('Published to Instagram just now. Also published to Facebook.');
    expect(within(dialog).getByText(/No results yet/)).toBeTruthy();
    expect(screen.getAllByText('Just published')).toHaveLength(2);
  });

  it('shows a scheduled post with when it goes out', () => {
    const scheduled: PublishedPost = { ...NEW[0], id: 's1', status: 'scheduled', scheduledFor: '2099-03-14T10:30', date: '2099-03-14' };
    renderBoard(
      <ContentBoard draft={DRAFT} posts={[scheduled]} canPublish={false} onPublished={vi.fn()} openPostId="s1" onOpenPost={vi.fn()} justPublished={['s1']} />,
    );
    const dialog = screen.getByRole('dialog', { name: 'Scheduled for Instagram' });
    expect(within(dialog).getByRole('status')).toHaveTextContent(/Scheduled for Instagram — .*2099/);
    expect(screen.getByRole('tab', { name: /scheduled/ })).toBeTruthy();
  });
});

describe('ContentBoard toolbar', () => {
  const rows = () => screen.getAllByRole('listitem');

  it('searches captions and filters by platform and status', async () => {
    const user = userEvent.setup();
    renderBoard(<ContentBoard draft={DRAFT} posts={MOCK_POSTS} canPublish={false} onPublished={vi.fn()} />);
    expect(rows()).toHaveLength(MOCK_POSTS.length);

    await user.type(screen.getByRole('searchbox', { name: 'Search posts' }), 'sardines');
    expect(rows().every((r) => /sardine/i.test(r.textContent ?? ''))).toBe(true);
    await user.clear(screen.getByRole('searchbox', { name: 'Search posts' }));

    await user.selectOptions(screen.getByLabelText('Platform'), 'facebook');
    expect(rows().every((r) => r.textContent?.includes('Facebook'))).toBe(true);

    await user.selectOptions(screen.getByLabelText('Status'), 'draft');
    expect(rows()).toHaveLength(MOCK_POSTS.filter((p) => p.platform === 'facebook' && p.status === 'draft').length);
    // The pills follow the same status.
    expect(screen.getByRole('tab', { name: /draft/ })).toHaveAttribute('aria-selected', 'true');
  });

  it('offers to clear filters when nothing matches', async () => {
    const user = userEvent.setup();
    renderBoard(<ContentBoard draft={DRAFT} posts={MOCK_POSTS} canPublish={false} onPublished={vi.fn()} />);
    await user.type(screen.getByRole('searchbox', { name: 'Search posts' }), 'zzz-no-match');
    expect(screen.getByText('No posts match')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(rows()).toHaveLength(MOCK_POSTS.length);
  });

  it('sorts oldest first on request', async () => {
    const user = userEvent.setup();
    renderBoard(<ContentBoard draft={DRAFT} posts={MOCK_POSTS} canPublish={false} onPublished={vi.fn()} />);
    const dates = () => rows().map((r) => r.querySelector('.lib-meta .num')?.textContent ?? '');
    expect(dates()).toEqual([...dates()].sort().reverse());
    await user.selectOptions(screen.getByLabelText('Sort'), 'oldest');
    expect(dates()).toEqual([...dates()].sort());
  });

  it('copies a caption from the row menu', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    renderBoard(<ContentBoard draft={DRAFT} posts={MOCK_POSTS} canPublish={false} onPublished={vi.fn()} />);
    await user.click(screen.getAllByRole('button', { name: /^More actions/ })[0]);
    await user.click(screen.getByRole('menuitem', { name: 'Copy caption' }));
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(MOCK_POSTS.map((p) => p.caption)).toContain(writeText.mock.calls[0][0]);
  });
});
